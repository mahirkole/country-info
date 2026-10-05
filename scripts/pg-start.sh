#!/usr/bin/env bash
# Start the local dev/test PostgreSQL used in cloud sessions (data dir /tmp/pgdata, socket dir /tmp, port 5432).
# Containers restart without stopping Postgres cleanly, leaving a stale postmaster.pid; this clears it and starts again.
set -euo pipefail
PGBIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)
PGDATA=${PGDATA:-/tmp/pgdata}
if "$PGBIN/pg_isready" -h /tmp -p 5432 -q; then echo "postgres already running"; exit 0; fi
rm -f "$PGDATA/postmaster.pid"
su postgres -c "$PGBIN/pg_ctl -D $PGDATA -l /tmp/pg.log -o '-p 5432 -k /tmp' start"
for _ in $(seq 1 20); do "$PGBIN/pg_isready" -h /tmp -p 5432 -q && { echo "postgres ready"; exit 0; }; sleep 0.5; done
echo "postgres did not become ready; see /tmp/pg.log" >&2
exit 1
