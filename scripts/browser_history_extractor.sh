#!/bin/bash
#
# macOS browser history extractor for Action1 / RMM use.
#
# Action1 upload:
#   Configuration -> Script Library -> + New Script -> Bash -> Upload this file.
#
# Supported browsers:
#   Chrome, Chrome Canary, Edge, Edge Beta, Edge Dev, Brave,
#   Opera, Opera GX, Vivaldi, Chromium, Firefox
#
set -o pipefail

# Action1 note: Bash scripts cannot use the Script Library parameter wizard.
# Either pass flags below in this block, or append them after the upload.
# When no CLI args are supplied, these defaults are used automatically.
ACTION1_DEFAULT_LIMIT=500
ACTION1_DEFAULT_FORMAT="json"
ACTION1_DEFAULT_OUTPUT="/var/tmp/browser_history.json"
ACTION1_DEFAULT_DIAGNOSTICS="/var/tmp/browser_history_diag.log"
ACTION1_DEFAULT_PRINT=1
ACTION1_DEFAULT_PRINT_FORMAT="table"
ACTION1_DEFAULT_PRINT_LIMIT=50

LIST_BROWSERS=0
SHOW_CANDIDATES=0
VERBOSE=0
PRINT_OUTPUT=0
PRINT_FORMAT="table"
PRINT_LIMIT=50
LIMIT=0
FORMAT="json"
OUTPUT=""
DIAGNOSTICS=""
BROWSER_FILTER=()

EXIT_CODE=0

log_diag() {
    [[ -n "$DIAGNOSTICS" ]] || return 0
    printf '%s\n' "$*" >> "$DIAGNOSTICS"
}

log_msg() {
    if [[ "$VERBOSE" -eq 1 ]]; then
        printf '%s\n' "$*" >&2
    fi
    log_diag "$*"
}

usage() {
    cat <<'EOF'
macOS browser history extractor for Action1 / RMM use.

Options:
  --list-browsers       List detected browser profiles and exit
  --browser NAME        Filter by browser name (repeatable)
  --limit N             Maximum rows per browser profile (0 = no limit)
  --format FORMAT       Output format: json or csv (default: json)
  --output, -o PATH     Output file path (default: stdout)
  --print               Print results to the screen (stdout)
  --print-format FMT    Screen format: table, summary, or json (default: table)
  --print-limit N       Max rows to show on screen for table/json (default: 50)
  --show-candidates     Print checked browser paths
  --verbose             Print diagnostic details to stderr
  --diagnostics PATH    Append diagnostic details to a log file
  -h, --help            Show this help
EOF
}

if [[ $# -eq 0 ]]; then
    set -- \
        --limit "$ACTION1_DEFAULT_LIMIT" \
        --format "$ACTION1_DEFAULT_FORMAT" \
        --output "$ACTION1_DEFAULT_OUTPUT" \
        --diagnostics "$ACTION1_DEFAULT_DIAGNOSTICS" \
        --verbose
    if [[ "$ACTION1_DEFAULT_PRINT" -eq 1 ]]; then
        set -- "$@" --print --print-format "$ACTION1_DEFAULT_PRINT_FORMAT" --print-limit "$ACTION1_DEFAULT_PRINT_LIMIT"
    fi
fi

while [[ $# -gt 0 ]]; do
    case "$1" in
        --list-browsers) LIST_BROWSERS=1; shift ;;
        --browser)
            [[ $# -lt 2 ]] && { echo "error: --browser requires a value" >&2; exit 2; }
            BROWSER_FILTER+=("$2"); shift 2 ;;
        --limit)
            [[ $# -lt 2 ]] && { echo "error: --limit requires a value" >&2; exit 2; }
            LIMIT="$2"; shift 2 ;;
        --format)
            [[ $# -lt 2 ]] && { echo "error: --format requires a value" >&2; exit 2; }
            FORMAT="$2"; shift 2 ;;
        --output|-o)
            [[ $# -lt 2 ]] && { echo "error: --output requires a value" >&2; exit 2; }
            OUTPUT="$2"; shift 2 ;;
        --show-candidates) SHOW_CANDIDATES=1; shift ;;
        --print) PRINT_OUTPUT=1; shift ;;
        --print-format)
            [[ $# -lt 2 ]] && { echo "error: --print-format requires a value" >&2; exit 2; }
            PRINT_FORMAT="$2"; shift 2 ;;
        --print-limit)
            [[ $# -lt 2 ]] && { echo "error: --print-limit requires a value" >&2; exit 2; }
            PRINT_LIMIT="$2"; shift 2 ;;
        --verbose) VERBOSE=1; shift ;;
        --diagnostics)
            [[ $# -lt 2 ]] && { echo "error: --diagnostics requires a value" >&2; exit 2; }
            DIAGNOSTICS="$2"; shift 2 ;;
        -h|--help) usage; exit 0 ;;
        *) echo "error: unknown argument: $1" >&2; usage >&2; exit 2 ;;
    esac
done

case "$FORMAT" in
    json|csv) ;;
    *) echo "error: --format must be json or csv" >&2; exit 2 ;;
esac

case "$PRINT_FORMAT" in
    table|summary|json) ;;
    *) echo "error: --print-format must be table, summary, or json" >&2; exit 2 ;;
esac

if ! [[ "$PRINT_LIMIT" =~ ^[0-9]+$ ]]; then
    echo "error: --print-limit must be a non-negative integer" >&2
    exit 2
fi

if ! [[ "$LIMIT" =~ ^[0-9]+$ ]]; then
    echo "error: --limit must be a non-negative integer" >&2
    exit 2
fi

get_browser_profiles() {
    SHOW_CANDIDATES="$SHOW_CANDIDATES" python3 - "${BROWSER_FILTER[@]}" <<'PY'
import configparser
import json
import os
import pwd
import sys

show_candidates = os.environ.get("SHOW_CANDIDATES") == "1"
browser_filter = {name.lower() for name in sys.argv[1:] if name.strip()}

CHROMIUM_BASES = [
    ("Chrome", "Google/Chrome"),
    ("Chrome Canary", "Google/Chrome Canary"),
    ("Edge", "Microsoft Edge"),
    ("Edge Beta", "Microsoft Edge Beta"),
    ("Edge Dev", "Microsoft Edge Dev"),
    ("Brave", "BraveSoftware/Brave-Browser"),
    ("Opera", "com.operasoftware.Opera"),
    ("Opera GX", "com.operasoftware.OperaGX"),
    ("Opera", "Opera Software/Opera Stable"),
    ("Opera GX", "Opera Software/Opera GX Stable"),
    ("Vivaldi", "Vivaldi"),
    ("Chromium", "Chromium"),
]

def write_candidate(browser_name, path):
    if not show_candidates:
        return
    status = "found" if os.path.exists(path) else "missing"
    print(f"[{status}] {browser_name}: {path}", file=sys.stderr)

def mac_user_roots():
    seen = set()
    roots = []

    def add_root(username, home):
        home = os.path.realpath(home)
        app_support = os.path.join(home, "Library", "Application Support")
        if not os.path.isdir(app_support):
            return
        key = app_support.lower()
        if key in seen:
            return
        seen.add(key)
        roots.append((username, app_support))

    try:
        add_root(os.environ.get("USER") or pwd.getpwuid(os.getuid()).pw_name, os.path.expanduser("~"))
    except Exception:
        pass

    users_root = "/Users"
    if os.path.isdir(users_root):
        skip = {"Shared", "Guest", ".localized", "root"}
        for entry in sorted(os.listdir(users_root)):
            if entry in skip or entry.startswith("."):
                continue
            home = os.path.join(users_root, entry)
            if os.path.isdir(home):
                add_root(entry, home)

    return sorted(roots, key=lambda item: item[0].lower())

def chromium_profile_names(user_data_path):
    local_state = os.path.join(user_data_path, "Local State")
    if not os.path.isfile(local_state):
        return {}
    try:
        with open(local_state, encoding="utf-8") as fh:
            state = json.load(fh)
    except Exception:
        return {}
    info = (((state or {}).get("profile") or {}).get("info_cache") or {})
    names = {}
    for key, value in info.items():
        if isinstance(value, dict) and value.get("name"):
            names[key] = str(value["name"])
        else:
            names[key] = key
    return names

def chromium_profiles(mac_user, browser_name, base_path):
    write_candidate(browser_name, base_path)
    if not os.path.isdir(base_path):
        return []

    user_data_path = base_path
    nested = os.path.join(base_path, "User Data")
    if os.path.isdir(nested):
        user_data_path = nested

    profile_names = chromium_profile_names(user_data_path)
    profiles = []
    seen = set()

    try:
        entries = sorted(os.listdir(user_data_path))
    except OSError:
        entries = []

    for entry in entries:
        dir_path = os.path.join(user_data_path, entry)
        if not os.path.isdir(dir_path):
            continue
        history_path = os.path.join(dir_path, "History")
        if not os.path.isfile(history_path) or not os.access(history_path, os.R_OK):
            continue
        resolved = os.path.realpath(history_path)
        if resolved in seen:
            continue
        seen.add(resolved)
        profiles.append((mac_user, browser_name, profile_names.get(entry, entry), history_path))

    root_history = os.path.join(user_data_path, "History")
    if os.path.isfile(root_history) and os.access(root_history, os.R_OK):
        resolved_root = os.path.realpath(root_history)
        if resolved_root not in seen:
            profiles.append((mac_user, browser_name, "Default", root_history))

    return profiles

def firefox_profile_display_name(profiles_ini, folder_name):
    if not os.path.isfile(profiles_ini):
        return folder_name.split("\\")[-1]
    parser = configparser.ConfigParser()
    parser.read(profiles_ini, encoding="utf-8")
    for section in parser.sections():
        path = parser.get(section, "Path", fallback="").replace("/", "\\")
        if path == folder_name:
            name = parser.get(section, "Name", fallback="").strip()
            return name or folder_name.split("\\")[-1]
    return folder_name.split("\\")[-1]

def firefox_profiles(mac_user, firefox_root):
    write_candidate("Firefox", firefox_root)
    profiles_path = os.path.join(firefox_root, "Profiles")
    if not os.path.isdir(profiles_path):
        return []

    profiles_ini = os.path.join(firefox_root, "profiles.ini")
    profiles = []

    try:
        entries = sorted(os.listdir(profiles_path))
    except OSError:
        entries = []

    for entry in entries:
        dir_path = os.path.join(profiles_path, entry)
        if not os.path.isdir(dir_path):
            continue
        places_path = os.path.join(dir_path, "places.sqlite")
        if not os.path.isfile(places_path) or not os.access(places_path, os.R_OK):
            continue
        folder_name = f"Profiles\\{entry}"
        display_name = firefox_profile_display_name(profiles_ini, folder_name)
        profiles.append((mac_user, "Firefox", display_name, places_path))

    return profiles

all_profiles = []
seen_paths = set()

for mac_user, app_support in mac_user_roots():
    for browser_name, relative_path in CHROMIUM_BASES:
        base_path = os.path.join(app_support, relative_path)
        for profile in chromium_profiles(mac_user, browser_name, base_path):
            resolved = os.path.realpath(profile[3])
            if resolved in seen_paths:
                continue
            seen_paths.add(resolved)
            all_profiles.append(profile)

    firefox_root = os.path.join(app_support, "Mozilla", "Firefox")
    for profile in firefox_profiles(mac_user, firefox_root):
        resolved = os.path.realpath(profile[3])
        if resolved in seen_paths:
            continue
        seen_paths.add(resolved)
        all_profiles.append(profile)

if browser_filter:
    all_profiles = [profile for profile in all_profiles if profile[1].lower() in browser_filter]

all_profiles.sort(key=lambda item: (item[0].lower(), item[1].lower(), item[2].lower()))

for mac_user, browser, profile, history_path in all_profiles:
    print(f"{mac_user}\t{browser}\t{profile}\t{history_path}")
PY
}

run_as_mac_user() {
    local mac_user="$1"
    shift

    local current_user=""
    current_user="$(id -un 2>/dev/null || true)"

    if [[ "$current_user" == "$mac_user" ]]; then
        "$@"
        return $?
    fi

    if [[ "$(id -u)" -eq 0 ]] && id "$mac_user" &>/dev/null; then
        sudo -u "$mac_user" "$@"
        return $?
    fi

    "$@"
    return $?
}

can_read_as_user() {
    local mac_user="$1"
    local target_path="$2"
    run_as_mac_user "$mac_user" test -r "$target_path"
}

copy_sqlite_bundle() {
    local mac_user="$1"
    local database_path="$2"
    local dest_dir="$3"
    local base_name
    base_name="$(basename "$database_path")"

    if ! run_as_mac_user "$mac_user" cp -f "$database_path" "$dest_dir/$base_name"; then
        return 1
    fi

    local suffix
    for suffix in "-wal" "-shm" "-journal"; do
        if run_as_mac_user "$mac_user" test -f "${database_path}${suffix}"; then
            run_as_mac_user "$mac_user" cp -f "${database_path}${suffix}" "$dest_dir/${base_name}${suffix}" || true
        fi
    done

    return 0
}

prepare_sqlite_snapshot() {
    local mac_user="$1"
    local database_path="$2"
    local temp_dir="$3"
    local base_name dest_db
    base_name="$(basename "$database_path")"
    dest_db="$temp_dir/$base_name"

    if run_as_mac_user "$mac_user" sqlite3 "$database_path" ".backup '$dest_db'" 2>/dev/null && [[ -s "$dest_db" ]]; then
        log_msg "sqlite backup ok: $database_path (as $mac_user)"
        return 0
    fi

    if copy_sqlite_bundle "$mac_user" "$database_path" "$temp_dir" && [[ -s "$dest_db" ]]; then
        log_msg "sqlite copy ok: $database_path (as $mac_user)"
        return 0
    fi

    log_msg "snapshot failed: $database_path (runner=$(id -un 2>/dev/null || echo unknown), owner=$mac_user)"
    return 1
}

invoke_sqlite_query() {
    local mac_user="$1"
    local database_path="$2"
    local query="$3"

    command -v sqlite3 >/dev/null 2>&1 || { echo "error: sqlite3 not found" >&2; exit 1; }

    if ! can_read_as_user "$mac_user" "$database_path"; then
        log_msg "not readable as ${mac_user}: $database_path"
        return 1
    fi

    local temp_dir
    if ! temp_dir="$(run_as_mac_user "$mac_user" mktemp -d "${TMPDIR:-/tmp}/browser_history.XXXXXX" 2>/dev/null)"; then
        temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/browser_history.XXXXXX")"
    fi
    local base_name
    base_name="$(basename "$database_path")"

    if ! prepare_sqlite_snapshot "$mac_user" "$database_path" "$temp_dir"; then
        run_as_mac_user "$mac_user" rm -rf "$temp_dir" 2>/dev/null || rm -rf "$temp_dir"
        return 1
    fi

    local output
    if ! output="$(run_as_mac_user "$mac_user" sqlite3 -separator $'\t' -noheader "$temp_dir/$base_name" "$query" 2>&1)"; then
        log_msg "sqlite query failed for $database_path: $output"
        run_as_mac_user "$mac_user" rm -rf "$temp_dir" 2>/dev/null || rm -rf "$temp_dir"
        return 1
    fi

    run_as_mac_user "$mac_user" rm -rf "$temp_dir" 2>/dev/null || rm -rf "$temp_dir"
    printf '%s\n' "$output"
    return 0
}

collect_history() {
    local mac_user="$1" browser="$2" profile="$3" history_path="$4" row_limit="$5"
    local limit_clause=""
    [[ "$row_limit" -gt 0 ]] && limit_clause="LIMIT $row_limit"

    local raw=""
    if [[ "$browser" == "Firefox" ]]; then
        if ! raw="$(invoke_sqlite_query "$mac_user" "$history_path" "
SELECT moz_places.url, COALESCE(moz_places.title, ''), moz_historyvisits.visit_date
FROM moz_historyvisits
JOIN moz_places ON moz_historyvisits.place_id = moz_places.id
WHERE moz_places.url IS NOT NULL AND moz_places.url != ''
ORDER BY moz_historyvisits.visit_date DESC
$limit_clause;")"; then
            return 1
        fi
        if [[ -z "$raw" ]]; then
            return 0
        fi
        local raw_file=""
        raw_file="$(mktemp "${TMPDIR:-/tmp}/browser_history_raw.XXXXXX")"
        printf '%s\n' "$raw" > "$raw_file"
        if ! python3 - "$mac_user" "$browser" "$profile" "$raw_file" <<'PY'
import sys
from datetime import datetime, timezone
mac_user, browser, profile, raw_file = sys.argv[1:5]
def firefox_time(raw):
    try:
        microseconds = int(raw)
    except (TypeError, ValueError):
        return ""
    if microseconds <= 0:
        return ""
    try:
        return datetime.fromtimestamp(microseconds / 1_000_000, tz=timezone.utc).isoformat().replace("+00:00", "Z")
    except (OverflowError, OSError, ValueError):
        return ""
with open(raw_file, "r", encoding="utf-8", errors="replace") as fh:
    for line in fh:
        line = line.rstrip("\n")
        if not line:
            continue
        parts = line.split("\t", 2)
        while len(parts) < 3:
            parts.append("")
        print("\t".join([mac_user, browser, profile, parts[0], parts[1], firefox_time(parts[2]), ""]))
PY
        then
            rm -f "$raw_file"
            return 1
        fi
        rm -f "$raw_file"
        return 0
    fi

    if ! raw="$(invoke_sqlite_query "$mac_user" "$history_path" "
SELECT
    urls.url,
    COALESCE(urls.title, ''),
    COALESCE(urls.visit_count, 0),
    urls.last_visit_time
FROM urls
WHERE urls.url IS NOT NULL AND urls.url != ''
ORDER BY urls.last_visit_time DESC
$limit_clause;")"; then
        return 1
    fi
    if [[ -z "$raw" ]]; then
        return 0
    fi
    local raw_file=""
    raw_file="$(mktemp "${TMPDIR:-/tmp}/browser_history_raw.XXXXXX")"
    printf '%s\n' "$raw" > "$raw_file"
    if ! python3 - "$mac_user" "$browser" "$profile" "$raw_file" <<'PY'
import sys
from datetime import datetime, timezone, timedelta
mac_user, browser, profile, raw_file = sys.argv[1:5]
def chromium_time(raw):
    try:
        microseconds = int(raw)
    except (TypeError, ValueError):
        return ""
    if microseconds <= 0:
        return ""
    try:
        epoch = datetime(1601, 1, 1, tzinfo=timezone.utc)
        return (epoch + timedelta(microseconds=microseconds)).isoformat().replace("+00:00", "Z")
    except OverflowError:
        return ""
with open(raw_file, "r", encoding="utf-8", errors="replace") as fh:
    for line in fh:
        line = line.rstrip("\n")
        if not line:
            continue
        parts = line.split("\t", 3)
        while len(parts) < 4:
            parts.append("")
        try:
            visit_count = str(int(parts[2] or 0))
        except ValueError:
            visit_count = "0"
        print("\t".join([mac_user, browser, profile, parts[0], parts[1], chromium_time(parts[3]), visit_count]))
PY
    then
        rm -f "$raw_file"
        return 1
    fi
    rm -f "$raw_file"
}

write_result() {
    python3 - "$1" "$2" "$3" <<'PY'
import csv, json, sys
from datetime import datetime, timezone

output_path, output_format, entries_file = sys.argv[1], sys.argv[2], sys.argv[3]
entries = []
with open(entries_file, "r", encoding="utf-8", errors="replace") as fh:
    for line in fh:
        line = line.rstrip("\n")
        if not line:
            continue
        parts = line.split("\t", 6)
        while len(parts) < 7:
            parts.append("")
        visit_count_value = None
        if parts[6] != "":
            try:
                visit_count_value = int(parts[6])
            except ValueError:
                visit_count_value = None
        entries.append({
            "mac_user": parts[0], "browser": parts[1], "profile": parts[2],
            "url": parts[3], "title": parts[4], "visit_time": parts[5],
            "visit_count": visit_count_value,
        })

def sort_key(item):
    value = item.get("visit_time") or ""
    if not value:
        return datetime.min.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)

entries.sort(key=sort_key, reverse=True)
fieldnames = ["mac_user", "browser", "profile", "url", "title", "visit_time", "visit_count"]

if output_format == "csv":
    if output_path:
        with open(output_path, "w", encoding="utf-8", newline="") as fh:
            writer = csv.DictWriter(fh, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(entries)
    else:
        writer = csv.DictWriter(sys.stdout, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(entries)
else:
    payload = json.dumps(entries, ensure_ascii=False, indent=2)
    if output_path:
        with open(output_path, "w", encoding="utf-8") as fh:
            fh.write(payload + "\n")
    else:
        sys.stdout.write(payload + ("\n" if not payload.endswith("\n") else ""))

print(len(entries))
PY
}

print_results() {
    python3 - "$1" "$2" "$3" "$4" <<'PY'
import json, sys
from collections import Counter
from datetime import datetime, timezone

output_path, print_format, print_limit_s, output_format = sys.argv[1:5]
try:
    print_limit = int(print_limit_s)
except ValueError:
    print_limit = 50

def load_entries():
    if output_format == "json":
        with open(output_path, "r", encoding="utf-8", errors="replace") as fh:
            data = json.load(fh)
        return data if isinstance(data, list) else []
    entries = []
    import csv
    with open(output_path, "r", encoding="utf-8", errors="replace", newline="") as fh:
        for row in csv.DictReader(fh):
            visit_count = row.get("visit_count") or ""
            if visit_count != "":
                try:
                    visit_count = int(visit_count)
                except ValueError:
                    visit_count = None
            else:
                visit_count = None
            entries.append({
                "mac_user": row.get("mac_user", ""),
                "browser": row.get("browser", ""),
                "profile": row.get("profile", ""),
                "url": row.get("url", ""),
                "title": row.get("title", ""),
                "visit_time": row.get("visit_time", ""),
                "visit_count": visit_count,
            })
    return entries

def sort_key(item):
    value = item.get("visit_time") or ""
    if not value:
        return datetime.min.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)

def clip(text, width):
    text = (text or "").replace("\n", " ").replace("\r", " ").strip()
    if len(text) <= width:
        return text
    if width <= 1:
        return text[:width]
    return text[: width - 1] + "…"

def fmt_time(value):
    value = value or ""
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(value).strftime("%Y-%m-%d %H:%M:%S")
    except ValueError:
        return value[:19] if value else "-"

entries = sorted(load_entries(), key=sort_key, reverse=True)
total = len(entries)
by_profile = Counter(f"{e.get('mac_user','')}/{e.get('browser','')}/{e.get('profile','')}" for e in entries)
by_browser = Counter(f"{e.get('browser','')}" for e in entries)

print("")
print("========== BROWSER HISTORY ==========")
print(f"Total entries: {total}")
print(f"Export file: {output_path}")
print("")

if print_format == "summary":
    print("By browser:")
    for name, count in sorted(by_browser.items(), key=lambda item: (-item[1], item[0])):
        print(f"  {name}: {count}")
    print("")
    print("By profile:")
    for name, count in sorted(by_profile.items(), key=lambda item: (-item[1], item[0])):
        print(f"  {name}: {count}")
    print("")
    if total:
        latest = entries[0]
        print("Most recent visit:")
        print(f"  {fmt_time(latest.get('visit_time'))} | {latest.get('mac_user')} | {latest.get('browser')} | {latest.get('profile')}")
        print(f"  {clip(latest.get('title'), 100)}")
        print(f"  {latest.get('url', '')}")
elif print_format == "json":
    shown = entries if print_limit == 0 else entries[:print_limit]
    payload = json.dumps(shown, ensure_ascii=False, indent=2)
    print(payload)
    if print_limit and total > print_limit:
        print("")
        print(f"(showing {print_limit} of {total}; use --print-limit 0 for all rows on screen)")
else:
    shown = entries if print_limit == 0 else entries[:print_limit]
    header = f"{'#':>3}  {'When':<19}  {'User':<10}  {'Browser':<8}  {'Profile':<14}  Title / URL"
    print(header)
    print("-" * len(header))
    for idx, entry in enumerate(shown, start=1):
        when = fmt_time(entry.get("visit_time"))
        user = clip(entry.get("mac_user"), 10)
        browser = clip(entry.get("browser"), 8)
        profile = clip(entry.get("profile"), 14)
        title = clip(entry.get("title"), 72)
        url = clip(entry.get("url"), 120)
        print(f"{idx:>3}  {when:<19}  {user:<10}  {browser:<8}  {profile:<14}  {title}")
        print(f"      {url}")
    print("")
    print("By profile:")
    for name, count in sorted(by_profile.items(), key=lambda item: (-item[1], item[0])):
        print(f"  {name}: {count}")
    if print_limit and total > print_limit:
        print("")
        print(f"(showing {len(shown)} of {total} newest entries; full data is in {output_path})")

print("========== END BROWSER HISTORY ==========")
PY
}

main() {
    if [[ -n "$DIAGNOSTICS" ]]; then
        : > "$DIAGNOSTICS"
        log_diag "browser_history_extractor started at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
        log_diag "running as: $(id)"
    fi

    local profiles
    profiles="$(get_browser_profiles)"
    local profile_count=0
    if [[ -n "${profiles//[$'\t\n ']}" ]]; then
        profile_count="$(printf '%s\n' "$profiles" | sed '/^$/d' | wc -l | tr -d ' ')"
    fi
    log_msg "profiles found: ${profile_count:-0}"

    if [[ -z "${profiles//[$'\t\n ']}" ]]; then
        echo "warning: No browser history databases found." >&2
        echo "warning: On macOS, grant Full Disk Access to the Action1 agent if browsers are installed." >&2
        EXIT_CODE=1
        return 0
    fi

    if [[ "$LIST_BROWSERS" -eq 1 ]]; then
        printf '%s\n' "$profiles"
        return 0
    fi

    local mac_user browser profile history_path count
    local rows_from_profile=0 profiles_read=0 profiles_failed=0
    local entries_file lines_before lines_after
    entries_file="$(mktemp "${TMPDIR:-/tmp}/browser_history_entries.XXXXXX")"
    : > "$entries_file"

    while IFS=$'\t' read -r mac_user browser profile history_path; do
        [[ -n "$history_path" ]] || continue
        rows_from_profile=0
        lines_before="$(wc -l < "$entries_file" | tr -d ' ')"
        if collect_history "$mac_user" "$browser" "$profile" "$history_path" "$LIMIT" >> "$entries_file"; then
            lines_after="$(wc -l < "$entries_file" | tr -d ' ')"
            rows_from_profile=$((lines_after - lines_before))
            if [[ "$rows_from_profile" -gt 0 ]]; then
                profiles_read=$((profiles_read + 1))
                log_msg "read ${rows_from_profile} rows from ${mac_user}/${browser}/${profile}"
            else
                profiles_failed=$((profiles_failed + 1))
                log_msg "0 rows from ${mac_user}/${browser}/${profile} (${history_path})"
            fi
        else
            profiles_failed=$((profiles_failed + 1))
            echo "warning: failed to read ${mac_user}/${browser}/${profile} (${history_path})" >&2
        fi
    done <<< "$profiles"

    count="$(write_result "$OUTPUT" "$FORMAT" "$entries_file")"
    rm -f "$entries_file"
    if [[ -n "$OUTPUT" ]]; then
        echo "Wrote ${count:-0} entries to $OUTPUT"
    fi
    if [[ "$PRINT_OUTPUT" -eq 1 ]]; then
        if [[ -n "$OUTPUT" ]] && [[ -f "$OUTPUT" ]]; then
            print_results "$OUTPUT" "$PRINT_FORMAT" "$PRINT_LIMIT" "$FORMAT"
        elif [[ -z "$OUTPUT" ]]; then
            echo "warning: --print has no effect without --output file; results were already sent to stdout" >&2
        else
            echo "warning: output file not found: $OUTPUT" >&2
        fi
    fi
    echo "Summary: ${profile_count:-0} profile(s) detected, ${profiles_read:-0} readable, ${profiles_failed:-0} empty/failed"
    if [[ -n "$DIAGNOSTICS" ]]; then
        echo "Diagnostics: $DIAGNOSTICS"
    fi

    if [[ "${count:-0}" -eq 0 ]]; then
        EXIT_CODE=1
        echo "warning: No history rows extracted. Common fixes:" >&2
        echo "warning: 1) Grant Full Disk Access to Action1 in System Settings -> Privacy & Security" >&2
        echo "warning: 2) Close browsers and rerun (SQLite WAL files may be locked while open)" >&2
        echo "warning: 3) Confirm Chrome/Firefox/Edge is installed for the scanned Mac user" >&2
    fi
}

main
exit "$EXIT_CODE"
