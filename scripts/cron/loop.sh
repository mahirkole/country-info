#!/usr/bin/env bash
# Runs the update cycle every day at CYCLE_AT (UTC, default 03:17) inside a container; the host needs no cron.
# `CYCLE_ONCE=1` runs one cycle immediately and exits (useful for a first load or a manual run: docker compose run --rm -e CYCLE_ONCE=1 cycle).
set -uo pipefail
cd "$(dirname "$0")/../.."
AT=${CYCLE_AT:-03:17}
if [ -n "${CYCLE_ONCE:-}" ]; then exec bash scripts/cron/run-cycle.sh; fi
while true; do
  now=$(date -u +%s)
  next=$(date -u -d "today $AT" +%s)
  [ "$next" -le "$now" ] && next=$(date -u -d "tomorrow $AT" +%s)
  echo "next cycle at $(date -u -d "@$next" +%FT%TZ)"
  sleep $((next - now))
  bash scripts/cron/run-cycle.sh || echo "cycle exited with $?"
done
