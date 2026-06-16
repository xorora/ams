"""Employee name normalization and fuzzy matching helpers."""

from __future__ import annotations

import re

try:
    from rapidfuzz import fuzz
except ImportError:  # pragma: no cover - optional until requirements.txt updated
    fuzz = None  # type: ignore[assignment]


def normalize_name(name: str) -> str:
    """Strip non-alphanumeric characters and lowercase."""
    return re.sub(r"[^a-z0-9]", "", name.lower())


def best_fuzzy_match(
    machine_name: str,
    candidates: list[tuple[str, str]],
    *,
    threshold: int,
) -> tuple[str | None, float | None]:
    """Return (employee_id, score) for the highest-scoring candidate above threshold."""
    if fuzz is None or not candidates:
        return None, None

    normalized = normalize_name(machine_name)
    best_id: str | None = None
    best_score = 0.0

    for employee_id, neon_name in candidates:
        score = fuzz.token_sort_ratio(normalized, normalize_name(neon_name))
        if score > best_score:
            best_score = score
            best_id = employee_id

    if best_score >= threshold:
        return best_id, best_score
    return None, None
