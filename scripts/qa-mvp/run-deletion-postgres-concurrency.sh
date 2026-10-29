#!/bin/bash
set -euo pipefail

BIN="/Applications/Postgres.app/Contents/Versions/latest/bin"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TEST="$ROOT/scripts/qa-mvp/test-deletion-postgres-concurrency.py"

test -x "$BIN/initdb"
test -x "$BIN/pg_ctl"
test -x "$BIN/psql"
test -f "$TEST"

LAB="$(mktemp -d "$HOME/.rooms-pg-lab/concurrency-repeat.XXXXXX")"
mkdir -p "$LAB/socket"

cleanup() {
  if test -f "$LAB/data/postmaster.pid"; then
    "$BIN/pg_ctl" -D "$LAB/data" \
      -m immediate -w stop >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "=== POSTGRESQL AISLADO ==="

"$BIN/initdb" -D "$LAB/data" \
  -A trust --no-instructions \
  > "$LAB/initdb.log" 2>&1

"$BIN/pg_ctl" -D "$LAB/data" \
  -l "$LAB/postgres.log" \
  -o "-k $LAB/socket -p 55439 -c listen_addresses=''" \
  -w start

export PGHOST="$LAB/socket"
export PGPORT="55439"
export PGUSER="$(id -un)"
export PGDATABASE="postgres"
export ROOMS_PG_BIN="$BIN"

"$BIN/psql" -X -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE TABLE qa_audits (
  user_id uuid PRIMARY KEY,
  status text NOT NULL
);

CREATE TABLE qa_writes (
  user_id uuid NOT NULL,
  label text NOT NULL
);

INSERT INTO qa_audits VALUES
  ('11111111-1111-4111-8111-111111111111', 'idle'),
  ('22222222-2222-4222-8222-222222222222', 'idle'),
  ('33333333-3333-4333-8333-333333333333', 'idle'),
  ('44444444-4444-4444-8444-444444444444', 'idle'),
  ('55555555-5555-4555-8555-555555555555', 'idle');
SQL

echo "=== CUATRO PRUEBAS CON CONEXIONES REALES ==="
python3 "$TEST"

echo "OK Pruebas completadas sin datos de ROOMS"
