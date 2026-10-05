#!/usr/bin/env bash
# One update cycle: license watch -> refresh what is due -> (1st of month) enrichment -> publish file bundles -> e-mail digests.
# Run from cron / a systemd timer next to the API (see docs/OPERATIONS.md). Webhooks are delivered by the running `serve` process.
# Exit code 1 when any step failed (details are in the output and, when NOTIFY_WEBHOOK_URL is set, in the alert).
set -uo pipefail
cd "$(dirname "$0")/../.."
exec 9>"${CYCLE_LOCK:-/tmp/country-info-cycle.lock}"
flock -n 9 || { echo "another cycle is running"; exit 0; }

# Test/ops knobs: REFRESH_ARGS (default "--due"), SKIP_STEPS (space-separated step names to leave out, e.g. "check-licenses enrich").
status=0
skip() { [[ " ${SKIP_STEPS:-} " == *" $1 "* ]]; }
# refresh and check-licenses alert for themselves (exit 1 = sources need attention); a crash (exit >= 2) or any other failing step is alerted below.
step() { # step <name> <command...>: run, remember failure, keep going
  local name=$1; shift
  if skip "$name"; then echo "::: $name (skipped)"; return; fi
  echo "::: $name"
  "$@"; local rc=$?
  if [ $rc -ne 0 ]; then
    echo "!!! $name failed (exit $rc)"; status=1
    if [ $rc -ge 2 ] || { [ "$name" != refresh ] && [ "$name" != check-licenses ]; }; then failed="${failed:-} $name"; fi
  fi
}

step migrate        npm run -s migrate
step check-licenses npm run -s check:licenses
step refresh        npm run -s refresh -- ${REFRESH_ARGS:---due}
if [ "$(date -u +%d)" = "01" ] || [ -n "${FORCE_MONTHLY:-}" ]; then
  # Incremental; a failure here is reported but does not stop publishing.
  step enrich-wikidata npm run -s enrich:wikidata
  step enrich-cldr     npm run -s enrich:cldr
  step enrich-attributes npm run -s enrich:attributes
  step link            npm run -s link  # skip with SKIP_STEPS="enrich-wikidata enrich-cldr enrich-attributes link"
fi
step publish        npm run -s publish
step digest         npm run -s digest
step prune          npm run -s prune

if [ -n "${failed:-}" ]; then
  npm run -s cli -- notify "country-info cycle: failed steps:${failed} (host $(hostname))" || true
fi
exit $status
