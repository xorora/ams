"""Machine employee → Neon employee matching and creation."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from ebio_sync.access import fetch_employees
from ebio_sync.config import Config
from ebio_sync.name_matching import best_fuzzy_match, normalize_name

LOG = logging.getLogger("ebio_sync")

MatchMethod = str  # card | mapping | exact_name | fuzzy_name | created

UPSERT_MAPPING_SQL = """
INSERT INTO biometric_employee_mappings
    (source_emp_id, card_no, machine_emp_code, machine_emp_name, normalized_name,
     employee_id, match_method, match_score)
VALUES
    (%(source_emp_id)s, %(card_no)s, %(machine_emp_code)s, %(machine_emp_name)s,
     %(normalized_name)s, %(employee_id)s, %(match_method)s, %(match_score)s)
ON CONFLICT (source_emp_id) DO UPDATE SET
    card_no = EXCLUDED.card_no,
    machine_emp_code = EXCLUDED.machine_emp_code,
    machine_emp_name = EXCLUDED.machine_emp_name,
    normalized_name = EXCLUDED.normalized_name,
    employee_id = EXCLUDED.employee_id,
    match_method = EXCLUDED.match_method,
    match_score = EXCLUDED.match_score,
    updated_at = NOW()
"""

UPDATE_CARD_SQL = """
UPDATE employees
SET machine_card_no = %(card_no)s, updated_at = NOW()
WHERE id = %(employee_id)s
  AND (machine_card_no IS NULL OR machine_card_no <> %(card_no)s)
"""

CREATE_EMPLOYEE_SQL = """
INSERT INTO employees (employee_code, full_name, email, machine_card_no, company_id, is_active)
VALUES (%(employee_code)s, %(full_name)s, %(email)s, %(card_no)s, %(company_id)s, TRUE)
RETURNING id
"""

LOAD_COMPANIES_SQL = """
SELECT id, slug
FROM companies
WHERE slug = ANY(%s) AND is_active = TRUE
"""

LOAD_EMPLOYEES_SQL = """
SELECT e.id, e.employee_code, e.full_name, e.email, e.machine_card_no, c.slug
FROM employees AS e
JOIN companies AS c ON c.id = e.company_id
WHERE c.slug = ANY(%s)
"""

LOAD_MAPPINGS_SQL = """
SELECT source_emp_id, card_no, employee_id, match_method, match_score
FROM biometric_employee_mappings
"""


@dataclass(frozen=True)
class NeonEmployee:
    id: str
    employee_code: str
    full_name: str
    email: str
    machine_card_no: str | None
    company_slug: str
    normalized_name: str


@dataclass(frozen=True)
class MachineEmployee:
    source_emp_id: int
    emp_code: str | None
    emp_name: str
    card_no: str


@dataclass(frozen=True)
class PersistedMapping:
    source_emp_id: int
    card_no: str
    employee_id: str
    match_method: str
    match_score: float | None


@dataclass
class MatchOutcome:
    employee_id: str
    match_method: MatchMethod
    match_score: float | None
    created: bool = False


@dataclass
class NeonContext:
    employees: list[NeonEmployee]
    by_id: dict[str, NeonEmployee]
    by_card: dict[str, NeonEmployee]
    by_normalized_name: dict[str, list[NeonEmployee]]
    mappings_by_source: dict[int, PersistedMapping]
    company_ids: dict[str, str]
    taken_emails: set[str]
    taken_codes: set[str]


def format_employee_code(emp_code: str | None, source_emp_id: int) -> str:
    """Zero-pad numeric EmpCode to 3 digits; fallback to M-{Empid}."""
    if emp_code:
        code = str(emp_code).strip()
        if code.isdigit():
            return code.zfill(3)
        return code
    return f"M-{source_emp_id}"


def email_domain_for_slug(cfg: Config, slug: str) -> str:
    if slug == "crest-led":
        return cfg.email_domain_crest_led
    if slug == "xorora":
        return cfg.email_domain_xorora
    return f"{slug.replace('-', '')}.com"


def generate_unique_email(full_name: str, domain: str, taken_emails: set[str]) -> str:
    base_local = normalize_name(full_name) or "employee"
    email = f"{base_local}@{domain}".lower()
    if email not in taken_emails:
        taken_emails.add(email)
        return email

    suffix = 2
    while True:
        candidate = f"{base_local}-{suffix}@{domain}".lower()
        if candidate not in taken_emails:
            taken_emails.add(candidate)
            return candidate
        suffix += 1


def generate_unique_employee_code(base_code: str, taken_codes: set[str]) -> str:
    if base_code not in taken_codes:
        taken_codes.add(base_code)
        return base_code

    suffix = 2
    while True:
        candidate = f"{base_code}-{suffix}"
        if candidate not in taken_codes:
            taken_codes.add(candidate)
            return candidate
        suffix += 1


def _parse_machine_row(row: Any) -> MachineEmployee | None:
    source_emp_id, emp_code, emp_name, card_no = row
    if card_no is None:
        return None
    card = str(card_no).strip()
    if not card:
        return None
    name = str(emp_name).strip() if emp_name else ""
    if not name:
        LOG.warning("Skipping machine employee %s: empty name.", source_emp_id)
        return None
    return MachineEmployee(
        source_emp_id=int(source_emp_id),
        emp_code=str(emp_code).strip() if emp_code else None,
        emp_name=name,
        card_no=card,
    )


def _load_neon_context(pg_conn, cfg: Config) -> NeonContext:
    slugs = cfg.company_slugs
    with pg_conn.cursor() as cur:
        cur.execute(LOAD_COMPANIES_SQL, (slugs,))
        company_ids = {slug: str(row[0]) for row in cur.fetchall()}

        missing = [slug for slug in slugs if slug not in company_ids]
        if missing:
            raise RuntimeError(f"Company slug(s) not found in Neon: {', '.join(missing)}")

        cur.execute(LOAD_EMPLOYEES_SQL, (slugs,))
        employees: list[NeonEmployee] = []
        by_id: dict[str, NeonEmployee] = {}
        by_card: dict[str, NeonEmployee] = {}
        by_normalized_name: dict[str, list[NeonEmployee]] = {}
        taken_emails: set[str] = set()
        taken_codes: set[str] = set()

        for row in cur.fetchall():
            emp = NeonEmployee(
                id=str(row[0]),
                employee_code=str(row[1]),
                full_name=str(row[2]),
                email=str(row[3]).lower(),
                machine_card_no=str(row[4]).strip() if row[4] is not None else None,
                company_slug=str(row[5]),
                normalized_name=normalize_name(str(row[2])),
            )
            employees.append(emp)
            by_id[emp.id] = emp
            taken_emails.add(emp.email)
            taken_codes.add(emp.employee_code)
            if emp.machine_card_no:
                by_card[emp.machine_card_no] = emp
            by_normalized_name.setdefault(emp.normalized_name, []).append(emp)

        cur.execute(LOAD_MAPPINGS_SQL)
        mappings_by_source: dict[int, PersistedMapping] = {}
        for row in cur.fetchall():
            mapping = PersistedMapping(
                source_emp_id=int(row[0]),
                card_no=str(row[1]).strip(),
                employee_id=str(row[2]),
                match_method=str(row[3]),
                match_score=float(row[4]) if row[4] is not None else None,
            )
            mappings_by_source[mapping.source_emp_id] = mapping

    return NeonContext(
        employees=employees,
        by_id=by_id,
        by_card=by_card,
        by_normalized_name=by_normalized_name,
        mappings_by_source=mappings_by_source,
        company_ids=company_ids,
        taken_emails=taken_emails,
        taken_codes=taken_codes,
    )


def _pick_exact_name_match(
    machine: MachineEmployee,
    matches: list[NeonEmployee],
) -> NeonEmployee | None:
    if not matches:
        return None
    if len(matches) == 1:
        return matches[0]

    unlinked = [emp for emp in matches if not emp.machine_card_no]
    if len(unlinked) == 1:
        return unlinked[0]

    LOG.warning(
        "Ambiguous exact name match for machine employee %s (%r): %s Neon candidate(s).",
        machine.source_emp_id,
        machine.emp_name,
        len(matches),
    )
    return sorted(matches, key=lambda emp: emp.id)[0]


def match_machine_employee(
    machine: MachineEmployee,
    ctx: NeonContext,
    cfg: Config,
) -> MatchOutcome | None:
    """Resolve a machine employee to a Neon employee, or None to create one."""
    normalized = normalize_name(machine.emp_name)

    by_card = ctx.by_card.get(machine.card_no)
    if by_card is not None:
        return MatchOutcome(by_card.id, "card", None)

    mapping = ctx.mappings_by_source.get(machine.source_emp_id)
    if mapping is not None:
        if mapping.employee_id in ctx.by_id:
            return MatchOutcome(mapping.employee_id, "mapping", mapping.match_score)
        LOG.warning(
            "Persisted mapping for source_emp_id=%s points to missing employee %s; re-matching.",
            machine.source_emp_id,
            mapping.employee_id,
        )

    exact = _pick_exact_name_match(machine, ctx.by_normalized_name.get(normalized, []))
    if exact is not None:
        return MatchOutcome(exact.id, "exact_name", None)

    candidates = [(emp.id, emp.full_name) for emp in ctx.employees]
    employee_id, score = best_fuzzy_match(
        machine.emp_name,
        candidates,
        threshold=cfg.name_match_threshold,
    )
    if employee_id is not None:
        return MatchOutcome(employee_id, "fuzzy_name", score)

    return None


def _create_neon_employee(
    machine: MachineEmployee,
    ctx: NeonContext,
    cfg: Config,
    pg_conn,
    *,
    dry_run: bool,
) -> str:
    slug = cfg.new_employee_company_slug
    if slug not in ctx.company_ids:
        raise RuntimeError(
            f"EBIO_NEW_EMPLOYEE_COMPANY_SLUG={slug!r} is not in configured companies."
        )

    domain = email_domain_for_slug(cfg, slug)
    base_code = format_employee_code(machine.emp_code, machine.source_emp_id)
    employee_code = generate_unique_employee_code(base_code, ctx.taken_codes)
    email = generate_unique_email(machine.emp_name, domain, ctx.taken_emails)

    params = {
        "employee_code": employee_code,
        "full_name": machine.emp_name,
        "email": email,
        "card_no": machine.card_no,
        "company_id": ctx.company_ids[slug],
    }

    if dry_run:
        LOG.info(
            "Dry run: would create employee %s (%s) under %s.",
            employee_code,
            machine.emp_name,
            slug,
        )
        placeholder_id = f"dry-run-{machine.source_emp_id}"
        ctx.by_id[placeholder_id] = NeonEmployee(
            id=placeholder_id,
            employee_code=employee_code,
            full_name=machine.emp_name,
            email=email,
            machine_card_no=machine.card_no,
            company_slug=slug,
            normalized_name=normalize_name(machine.emp_name),
        )
        ctx.by_card[machine.card_no] = ctx.by_id[placeholder_id]
        return placeholder_id

    with pg_conn.cursor() as cur:
        cur.execute(CREATE_EMPLOYEE_SQL, params)
        row = cur.fetchone()
        if row is None:
            raise RuntimeError(f"Failed to create employee for source_emp_id={machine.source_emp_id}")
        employee_id = str(row[0])

    pg_conn.commit()
    LOG.info(
        "Created employee %s (%s, %s) under %s for machine Empid=%s.",
        employee_code,
        machine.emp_name,
        email,
        slug,
        machine.source_emp_id,
    )

    created = NeonEmployee(
        id=employee_id,
        employee_code=employee_code,
        full_name=machine.emp_name,
        email=email,
        machine_card_no=machine.card_no,
        company_slug=slug,
        normalized_name=normalize_name(machine.emp_name),
    )
    ctx.employees.append(created)
    ctx.by_id[employee_id] = created
    ctx.by_card[machine.card_no] = created
    ctx.by_normalized_name.setdefault(created.normalized_name, []).append(created)
    return employee_id


def _update_machine_card_no(
    employee_id: str,
    card_no: str,
    pg_conn,
    *,
    dry_run: bool,
) -> bool:
    if dry_run:
        return True

    with pg_conn.cursor() as cur:
        cur.execute(UPDATE_CARD_SQL, {"employee_id": employee_id, "card_no": card_no})
        updated = bool(cur.rowcount and cur.rowcount > 0)
    pg_conn.commit()
    return updated


def _upsert_mapping(
    machine: MachineEmployee,
    outcome: MatchOutcome,
    pg_conn,
    *,
    dry_run: bool,
) -> None:
    params = {
        "source_emp_id": machine.source_emp_id,
        "card_no": machine.card_no,
        "machine_emp_code": machine.emp_code,
        "machine_emp_name": machine.emp_name,
        "normalized_name": normalize_name(machine.emp_name),
        "employee_id": outcome.employee_id,
        "match_method": outcome.match_method,
        "match_score": outcome.match_score,
    }

    if dry_run:
        LOG.debug(
            "Dry run: would upsert mapping source_emp_id=%s → employee %s (%s).",
            machine.source_emp_id,
            outcome.employee_id,
            outcome.match_method,
        )
        return

    with pg_conn.cursor() as cur:
        cur.execute(UPSERT_MAPPING_SQL, params)
    pg_conn.commit()


def sync_employees(
    cfg: Config,
    pg_conn,
    access_conn,
    *,
    dry_run: bool = False,
) -> int:
    """Match or create machine employees in Neon and persist biometric mappings."""
    ctx = _load_neon_context(pg_conn, cfg)
    machine_rows = fetch_employees(access_conn)

    processed = 0
    stats: dict[str, int] = {
        "card": 0,
        "mapping": 0,
        "exact_name": 0,
        "fuzzy_name": 0,
        "created": 0,
        "cards_updated": 0,
        "skipped": 0,
    }

    for row in machine_rows:
        machine = _parse_machine_row(row)
        if machine is None:
            stats["skipped"] += 1
            continue

        try:
            outcome = match_machine_employee(machine, ctx, cfg)
            if outcome is None:
                employee_id = _create_neon_employee(machine, ctx, cfg, pg_conn, dry_run=dry_run)
                outcome = MatchOutcome(employee_id, "created", None, created=True)

            existing = ctx.by_id.get(outcome.employee_id)
            needs_card_update = (
                existing is None
                or existing.machine_card_no is None
                or existing.machine_card_no != machine.card_no
            )
            if needs_card_update:
                other = ctx.by_card.get(machine.card_no)
                if other is not None and other.id != outcome.employee_id:
                    LOG.error(
                        "Card %s already linked to employee %s; cannot assign to %s (source_emp_id=%s).",
                        machine.card_no,
                        other.id,
                        outcome.employee_id,
                        machine.source_emp_id,
                    )
                    stats["skipped"] += 1
                    continue

                if _update_machine_card_no(
                    outcome.employee_id, machine.card_no, pg_conn, dry_run=dry_run
                ):
                    stats["cards_updated"] += 1
                    emp = ctx.by_id.get(outcome.employee_id)
                    if emp is not None:
                        old_card = emp.machine_card_no
                        if old_card and old_card in ctx.by_card and ctx.by_card[old_card].id == emp.id:
                            del ctx.by_card[old_card]
                        updated = NeonEmployee(
                            id=emp.id,
                            employee_code=emp.employee_code,
                            full_name=emp.full_name,
                            email=emp.email,
                            machine_card_no=machine.card_no,
                            company_slug=emp.company_slug,
                            normalized_name=emp.normalized_name,
                        )
                        ctx.by_id[updated.id] = updated
                        ctx.by_card[machine.card_no] = updated

            _upsert_mapping(machine, outcome, pg_conn, dry_run=dry_run)
            ctx.mappings_by_source[machine.source_emp_id] = PersistedMapping(
                source_emp_id=machine.source_emp_id,
                card_no=machine.card_no,
                employee_id=outcome.employee_id,
                match_method=outcome.match_method,
                match_score=outcome.match_score,
            )
            stats[outcome.match_method] += 1
            processed += 1
        except Exception:
            LOG.exception(
                "Failed to sync machine employee source_emp_id=%s (%r).",
                machine.source_emp_id,
                machine.emp_name,
            )
            stats["skipped"] += 1

    LOG.info(
        "Employee sync: %s processed (%s by card, %s by mapping, %s by exact name, "
        "%s by fuzzy name, %s created, %s card updates, %s skipped).",
        processed,
        stats["card"],
        stats["mapping"],
        stats["exact_name"],
        stats["fuzzy_name"],
        stats["created"],
        stats["cards_updated"],
        stats["skipped"],
    )
    return processed
