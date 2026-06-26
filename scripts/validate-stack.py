#!/usr/bin/env python3
"""
validate-stack.py — Validate the local Compose stack telemetry.

Starts the Compose stack, waits for API readiness, calls the root health
endpoint and every OpenAPI operation once, queries Mimir to confirm the
per-endpoint request counter increased, queries Tempo for current-run service
traces, queries Loki to confirm startup log presence, stops the API service to
trigger graceful shutdown, queries Loki to confirm shutdown log presence, then
tears the stack down. Exits 0 on success, 1 on any failure.

Usage:
    python scripts/validate-stack.py [--compose-file docker-compose.yml] [--timeout 120]

Requirements:
    - Docker and Docker Compose must be installed and on PATH.
    - Python 3.8+ (standard library only; no third-party packages required).
"""

import argparse
import json
import os
import subprocess
import sys
import time
from typing import Dict, List, Optional, Tuple
import urllib.error
import urllib.parse
import urllib.request

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_COMPOSE_FILE = "docker-compose.yml"
DEFAULT_STARTUP_TIMEOUT = 120  # seconds to wait for API readiness
DEFAULT_POLL_INTERVAL = 3      # seconds between readiness polls

API_BASE_URL = os.environ.get("API_BASE_URL", "http://127.0.0.1:3000")
LOKI_BASE_URL = "http://127.0.0.1:3101"
LOKI_QUERY_PATH = "/loki/api/v1/query_range"
MIMIR_BASE_URL = "http://127.0.0.1:9009"
MIMIR_QUERY_PATH = "/prometheus/api/v1/query"
TEMPO_BASE_URL = "http://127.0.0.1:3200"
TEMPO_SEARCH_PATH = "/api/search"
OPENAPI_SPEC_PATH = "src/docs/openapi.json"

# The Loki stream label used by the telemetry implementation.
LOKI_SERVICE_LABEL = "conduit-api"
TEMPO_SERVICE_TAG = "service.name=conduit-api"

# How many seconds of log data to look back in Loki queries.
LOKI_LOOKBACK_SECONDS = 300

# Seconds to wait after stopping the API before querying Loki for shutdown logs.
SHUTDOWN_WAIT_SECONDS = 10
TELEMETRY_EXPORT_WAIT_SECONDS = 8
METRIC_POLL_ATTEMPTS = 8
METRIC_POLL_INTERVAL_SECONDS = 3
TRACE_POLL_ATTEMPTS = 8
TRACE_POLL_INTERVAL_SECONDS = 3

# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------


def log(message: str) -> None:
    """Print a timestamped validation message to stdout."""
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%S")
    print(f"[{timestamp}] {message}", flush=True)


def run_compose(compose_file: str, *args: str, check: bool = True) -> subprocess.CompletedProcess:
    """Run a docker compose sub-command and return the CompletedProcess result."""
    command = ["docker", "compose", "-f", compose_file] + list(args)
    log(f"  $ {' '.join(command)}")
    result = subprocess.run(command, capture_output=True, text=True)
    if result.stdout.strip():
        for line in result.stdout.strip().splitlines():
            log(f"    {line}")
    if result.returncode != 0 and check:
        if result.stderr.strip():
            for line in result.stderr.strip().splitlines():
                log(f"    STDERR: {line}")
        raise RuntimeError(
            f"Command failed (exit {result.returncode}): {' '.join(command)}"
        )
    return result


def http_get(url: str, timeout: int = 10) -> Tuple[int, str]:
    """Perform an HTTP GET and return (status_code, response_body)."""
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            return response.status, response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")
    except (urllib.error.URLError, OSError):
        return 0, ""


def http_request(
    method: str,
    url: str,
    payload: Optional[Dict[str, object]] = None,
    timeout: int = 10,
) -> Tuple[int, str]:
    """Perform an HTTP request and return (status_code, response_body)."""
    data = None
    headers = {}

    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(url, data=data, headers=headers, method=method.upper())

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")
    except (urllib.error.URLError, OSError):
        return 0, ""


def wait_for_api_readiness(timeout: int, poll_interval: int) -> bool:
    """Poll GET / until HTTP 200 is returned or timeout expires.

    Returns True when ready, False on timeout.
    """
    deadline = time.monotonic() + timeout
    url = f"{API_BASE_URL}/"
    log(f"Waiting for API readiness at {url} (timeout {timeout}s)...")
    while time.monotonic() < deadline:
        status, _ = http_get(url, timeout=5)
        if status == 200:
            log(f"  API is ready (HTTP {status}).")
            return True
        log(f"  Not ready yet (HTTP {status}). Retrying in {poll_interval}s...")
        time.sleep(poll_interval)
    log(f"  ERROR: API did not become ready within {timeout}s.")
    return False


def prometheus_label_value(value: str) -> str:
    """Escape a label value for a Prometheus query string."""
    return value.replace("\\", "\\\\").replace('"', '\\"')


def query_prometheus_value(query: str) -> float:
    """Query Mimir's Prometheus-compatible API and return the scalar sum value."""
    params = urllib.parse.urlencode({"query": query})
    url = f"{MIMIR_BASE_URL}{MIMIR_QUERY_PATH}?{params}"

    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            body = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, OSError, json.JSONDecodeError) as exc:
        log(f"  Mimir query error: {exc}")
        return 0.0

    results = body.get("data", {}).get("result", [])
    if not results:
        return 0.0

    value = results[0].get("value", [None, "0"])[1]
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def query_request_counter(method: str, route: str) -> float:
    """Return the current counter value for one Express route template."""
    query = (
        'sum(http_server_requests_total{'
        f'method="{prometheus_label_value(method.upper())}",'
        f'route="{prometheus_label_value(route)}"'
        "})"
    )
    return query_prometheus_value(query)


def openapi_path_to_request_path(path_template: str) -> str:
    """Convert /api/articles/{slug}/comments/{id} to a concrete test URL path."""
    replacements = {
        "{id}": "1",
        "{slug}": "telemetry-audit-slug",
        "{username}": "telemetry-audit-user",
    }
    path = path_template
    for key, value in replacements.items():
        path = path.replace(key, value)
    return path


def openapi_path_to_express_route(path_template: str) -> str:
    """Convert an OpenAPI path template to the Express route label used in metrics."""
    route = path_template
    for parameter in ("id", "slug", "username"):
        route = route.replace("{" + parameter + "}", ":" + parameter)
    return route


def load_openapi_operations(spec_path: str) -> List[Dict[str, object]]:
    """Load root health and OpenAPI operations as method/path/route tuples."""
    with open(spec_path, "r", encoding="utf-8") as spec_file:
        spec = json.load(spec_file)

    operations = [
        {
            "method": "GET",
            "path": "/",
            "route": "/",
        }
    ]
    for path_template, methods in spec.get("paths", {}).items():
        for method in methods:
            operations.append(
                {
                    "method": method.upper(),
                    "path": openapi_path_to_request_path(path_template),
                    "route": openapi_path_to_express_route(path_template),
                }
            )
    return operations


def payload_for_operation(method: str, path: str) -> Optional[Dict[str, object]]:
    """Return a minimal body that reaches the route without using real data."""
    if method not in {"POST", "PUT"}:
        return None

    if path == "/api/users" or path == "/api/users/login":
        return {"user": {}}

    if path.endswith("/comments"):
        return {"comment": {}}

    if path == "/api/articles" or path.startswith("/api/articles/"):
        return {"article": {}}

    return {}


def call_openapi_operations(spec_path: str) -> Tuple[List[Dict[str, object]], List[str]]:
    """Call root health and each OpenAPI operation once for telemetry evidence."""
    failures = []
    operations = load_openapi_operations(spec_path)

    log(f"  Loaded {len(operations)} telemetry operation(s) from {spec_path}.")
    for operation in operations:
        method = operation["method"]
        path = operation["path"]
        url = f"{API_BASE_URL}{path}"
        payload = payload_for_operation(method, path)
        before = query_request_counter(method, operation["route"])
        status, _ = http_request(method, url, payload=payload, timeout=10)
        operation["before_counter"] = before
        operation["status"] = status
        log(f"    {method} {path} -> HTTP {status}")

        if status == 0:
            failures.append(f"operation_unreachable:{method}:{path}")

    return operations, failures


def validate_request_counters(operations: List[Dict[str, object]]) -> List[str]:
    """Confirm each telemetry operation increments its route counter in Mimir."""
    failures = []
    pending = {
        (str(operation["method"]), str(operation["route"])): float(operation["before_counter"])
        for operation in operations
    }
    observed_values: Dict[Tuple[str, str], float] = {}

    log("  Waiting for metrics export before querying Mimir...")
    time.sleep(TELEMETRY_EXPORT_WAIT_SECONDS)

    for attempt in range(METRIC_POLL_ATTEMPTS):
        for key, before in list(pending.items()):
            method, route = key
            observed = query_request_counter(method, route)
            observed_values[key] = observed
            if observed >= before + 1:
                del pending[key]

        if not pending:
            break

        if attempt < METRIC_POLL_ATTEMPTS - 1:
            time.sleep(METRIC_POLL_INTERVAL_SECONDS)

    for operation in operations:
        method = str(operation["method"])
        route = str(operation["route"])
        before = float(operation["before_counter"])
        observed = observed_values.get((method, route), before)
        delta = observed - before

        if delta >= 1:
            log(f"    PASS: {method} {route} counter delta={delta:g}.")
            continue

        log(f"    FAIL: {method} {route} counter delta={delta:g}.")
        failures.append(f"request_counter_missing:{method}:{route}")

    return failures


def validate_tempo_traces(trace_window_start: int) -> List[str]:
    """Confirm Tempo has at least one current-run trace for this service."""
    for attempt in range(TRACE_POLL_ATTEMPTS):
        params = urllib.parse.urlencode(
            {
                "tags": TEMPO_SERVICE_TAG,
                "start": str(trace_window_start),
                "end": str(int(time.time()) + 5),
                "limit": "20",
            }
        )
        url = f"{TEMPO_BASE_URL}{TEMPO_SEARCH_PATH}?{params}"

        try:
            with urllib.request.urlopen(url, timeout=10) as response:
                body = json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, OSError, json.JSONDecodeError) as exc:
            log(f"  Tempo query error: {exc}")
            return ["tempo_trace_query_failed"]

        traces = body.get("traces") or body.get("data", {}).get("traces") or []
        if traces:
            log(
                "  PASS: Tempo returned "
                f"{len(traces)} trace(s) for {TEMPO_SERVICE_TAG}."
            )
            return []

        if attempt < TRACE_POLL_ATTEMPTS - 1:
            time.sleep(TRACE_POLL_INTERVAL_SECONDS)

    log("  FAIL: Tempo returned no traces after polling.")
    return ["tempo_traces_missing"]


def query_loki_for_event(event_value: str, lookback_seconds: int) -> list:
    """Query Loki for log lines where the 'event' stream label matches event_value.

    Returns a list of raw log line strings found within the lookback window.
    """
    now_ns = int(time.time() * 1_000_000_000)
    start_ns = now_ns - lookback_seconds * 1_000_000_000

    params = urllib.parse.urlencode(
        {
            "query": '{service="' + LOKI_SERVICE_LABEL + '",event="' + event_value + '"}',
            "start": str(start_ns),
            "end": str(now_ns),
            "limit": "50",
        }
    )
    url = f"{LOKI_BASE_URL}{LOKI_QUERY_PATH}?{params}"

    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            body = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, OSError, json.JSONDecodeError) as exc:
        log(f"  Loki query error for event='{event_value}': {exc}")
        return []

    lines = []
    for stream_result in body.get("data", {}).get("result", []):
        for _ts, line_text in stream_result.get("values", []):
            lines.append(line_text)
    return lines


# ---------------------------------------------------------------------------
# Main validation logic
# ---------------------------------------------------------------------------


def validate(compose_file: str, timeout: int, poll_interval: int, spec_path: str) -> bool:
    """Run the full validation suite. Returns True on success, False on failure."""
    failures = []

    # -----------------------------------------------------------------------
    # Step 1 — Start non-API services first, then the API.
    # -----------------------------------------------------------------------
    log("Step 1: Starting Compose services (postgres, loki, tempo, mimir, grafana)...")
    try:
        run_compose(compose_file, "up", "-d", "postgres", "loki", "tempo", "mimir", "grafana")
        log("  Infrastructure services started. Waiting 15s for Loki/Mimir to become ready...")
        time.sleep(15)
        log("  Building API service image from the current workspace...")
        run_compose(compose_file, "build", "api")
        log("  Starting API service...")
        run_compose(compose_file, "up", "-d", "api")
        log("  API service started.")
    except RuntimeError as exc:
        log(f"  ERROR starting services: {exc}")
        failures.append("compose_startup_failed")

    if failures:
        return False

    # -----------------------------------------------------------------------
    # Step 2 — Wait for API readiness.
    # -----------------------------------------------------------------------
    log("Step 2: Waiting for API readiness...")
    if not wait_for_api_readiness(timeout, poll_interval):
        failures.append("api_readiness_timeout")
        return False

    # -----------------------------------------------------------------------
    # Step 3 — Call root health and each OpenAPI operation once to generate
    # request telemetry.
    # -----------------------------------------------------------------------
    log("Step 3: Calling telemetry operations to generate endpoint telemetry...")
    resolved_spec_path = os.path.abspath(spec_path)
    trace_window_start = int(time.time()) - 5
    try:
        operations, operation_failures = call_openapi_operations(resolved_spec_path)
        failures.extend(operation_failures)
    except (OSError, json.JSONDecodeError) as exc:
        log(f"  ERROR loading/calling OpenAPI operations: {exc}")
        failures.append("openapi_operation_smoke_failed")
        operations = []

    # -----------------------------------------------------------------------
    # Step 4 — Validate per-endpoint counters in Mimir and traces in Tempo.
    # -----------------------------------------------------------------------
    log("Step 4: Validating request counters in Mimir and traces in Tempo...")
    if operations:
        failures.extend(validate_request_counters(operations))
    else:
        failures.append("request_counter_validation_skipped")

    failures.extend(validate_tempo_traces(trace_window_start))

    # -----------------------------------------------------------------------
    # Step 5 — Validate startup log in Loki.
    # -----------------------------------------------------------------------
    log("Step 5: Waiting 5s for telemetry flush before querying Loki...")
    time.sleep(5)
    log("  Querying Loki for startup log (event=startup)...")
    startup_lines = query_loki_for_event("startup", LOKI_LOOKBACK_SECONDS)
    if startup_lines:
        log(f"  PASS: {len(startup_lines)} startup log line(s) found in Loki.")
        for line in startup_lines[:3]:
            log(f"    {line[:200]}")
    else:
        log("  FAIL: No startup log lines found in Loki.")
        failures.append("startup_log_missing_in_loki")

    # -----------------------------------------------------------------------
    # Step 6 — Stop the API service to trigger graceful shutdown.
    # -----------------------------------------------------------------------
    log("Step 6: Stopping API service to trigger graceful shutdown...")
    try:
        run_compose(compose_file, "stop", "api")
        log(f"  API stopped. Waiting {SHUTDOWN_WAIT_SECONDS}s for shutdown log flush...")
        time.sleep(SHUTDOWN_WAIT_SECONDS)
    except RuntimeError as exc:
        log(f"  ERROR stopping API: {exc}")
        failures.append("api_stop_failed")

    # -----------------------------------------------------------------------
    # Step 7 — Validate shutdown log in Loki.
    # -----------------------------------------------------------------------
    log("Step 7: Querying Loki for shutdown log (event=shutdown)...")
    shutdown_lines = query_loki_for_event("shutdown", LOKI_LOOKBACK_SECONDS)
    if shutdown_lines:
        log(f"  PASS: {len(shutdown_lines)} shutdown log line(s) found in Loki.")
        for line in shutdown_lines[:3]:
            log(f"    {line[:200]}")
    else:
        log("  FAIL: No shutdown log lines found in Loki.")
        failures.append("shutdown_log_missing_in_loki")

    # -----------------------------------------------------------------------
    # Return result (teardown always happens in the caller's finally block).
    # -----------------------------------------------------------------------
    if failures:
        log(f"Validation FAILED. Failures: {', '.join(failures)}")
        return False

    log("All validation checks PASSED.")
    return True


def teardown(compose_file: str) -> None:
    """Tear down the full Compose stack regardless of validation outcome."""
    log("Teardown: Running docker compose down -v...")
    try:
        run_compose(compose_file, "down", "-v", check=False)
        log("  Stack torn down.")
    except Exception as exc:
        log(f"  WARN: Teardown encountered an error: {exc}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate the local Compose stack startup and shutdown logs.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--compose-file",
        default=DEFAULT_COMPOSE_FILE,
        help="Path to the Docker Compose file.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=DEFAULT_STARTUP_TIMEOUT,
        help="Seconds to wait for API readiness.",
    )
    parser.add_argument(
        "--poll-interval",
        type=int,
        default=DEFAULT_POLL_INTERVAL,
        help="Seconds between readiness poll attempts.",
    )
    parser.add_argument(
        "--openapi-spec",
        default=OPENAPI_SPEC_PATH,
        help="Path to the OpenAPI JSON spec used for endpoint telemetry validation.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    compose_file = args.compose_file
    timeout = args.timeout
    poll_interval = args.poll_interval
    spec_path = args.openapi_spec

    log(
        "validate-stack.py -- "
        f"compose-file={compose_file}, timeout={timeout}s, openapi-spec={spec_path}"
    )

    success = False
    try:
        success = validate(compose_file, timeout, poll_interval, spec_path)
    except Exception as exc:
        log(f"Unexpected error during validation: {exc}")
    finally:
        teardown(compose_file)

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
