#!/usr/bin/env python3
"""
validate-stack.py — Validate the local Compose stack startup and shutdown logs.

Starts the Compose stack, waits for API readiness, sends a smoke request,
queries Loki to confirm startup log presence, stops the API service to trigger
graceful shutdown, queries Loki to confirm shutdown log presence, then tears
the stack down. Exits 0 on success, 1 on any failure.

Usage:
    python scripts/validate-stack.py [--compose-file docker-compose.yml] [--timeout 120]

Requirements:
    - Docker and Docker Compose must be installed and on PATH.
    - Python 3.8+ (standard library only; no third-party packages required).
"""

import argparse
import json
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_COMPOSE_FILE = "docker-compose.yml"
DEFAULT_STARTUP_TIMEOUT = 120  # seconds to wait for API readiness
DEFAULT_POLL_INTERVAL = 3      # seconds between readiness polls

API_BASE_URL = "http://127.0.0.1:3000"
LOKI_BASE_URL = "http://127.0.0.1:3101"
LOKI_QUERY_PATH = "/loki/api/v1/query_range"

# The Loki stream label used by the telemetry implementation.
LOKI_SERVICE_LABEL = "conduit-api"

# How many seconds of log data to look back in Loki queries.
LOKI_LOOKBACK_SECONDS = 300

# Seconds to wait after stopping the API before querying Loki for shutdown logs.
SHUTDOWN_WAIT_SECONDS = 10

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


def http_get(url: str, timeout: int = 10) -> tuple:
    """Perform an HTTP GET and return (status_code, response_body)."""
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
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


def validate(compose_file: str, timeout: int, poll_interval: int) -> bool:
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
    # Step 3 — Send a smoke request to generate telemetry.
    # -----------------------------------------------------------------------
    log("Step 3: Sending smoke request GET / to generate telemetry...")
    status, _ = http_get(f"{API_BASE_URL}/", timeout=10)
    if status != 200:
        log(f"  WARN: Smoke request returned HTTP {status} (expected 200).")
    else:
        log(f"  Smoke request OK (HTTP {status}).")

    # -----------------------------------------------------------------------
    # Step 4 — Validate startup log in Loki.
    # -----------------------------------------------------------------------
    log("Step 4: Waiting 5s for telemetry flush before querying Loki...")
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
    # Step 5 — Stop the API service to trigger graceful shutdown.
    # -----------------------------------------------------------------------
    log("Step 5: Stopping API service to trigger graceful shutdown...")
    try:
        run_compose(compose_file, "stop", "api")
        log(f"  API stopped. Waiting {SHUTDOWN_WAIT_SECONDS}s for shutdown log flush...")
        time.sleep(SHUTDOWN_WAIT_SECONDS)
    except RuntimeError as exc:
        log(f"  ERROR stopping API: {exc}")
        failures.append("api_stop_failed")

    # -----------------------------------------------------------------------
    # Step 6 — Validate shutdown log in Loki.
    # -----------------------------------------------------------------------
    log("Step 6: Querying Loki for shutdown log (event=shutdown)...")
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
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    compose_file = args.compose_file
    timeout = args.timeout
    poll_interval = args.poll_interval

    log(f"validate-stack.py -- compose-file={compose_file}, timeout={timeout}s")

    success = False
    try:
        success = validate(compose_file, timeout, poll_interval)
    except Exception as exc:
        log(f"Unexpected error during validation: {exc}")
    finally:
        teardown(compose_file)

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
