#!/bin/sh
set -eu

PG_BIN="/Applications/Postgres.app/Contents/Versions/latest/bin"
PSQL="$PG_BIN/psql"
DB="rooms_beta_invite_qa"

echo "=== M5.17B · CONCURRENCIA POSTGRESQL ==="

test -x "$PSQL"

actual=$("$PSQL" -X -At -d "$DB" \
  -c "SELECT current_database()")

if [ "$actual" != "$DB" ]; then
  echo "STOP: base de datos inesperada"
  exit 1
fi

"$PSQL" -X -v ON_ERROR_STOP=1 -d "$DB" \
  >/tmp/rooms-invite-concurrency-prepare.log <<'SQL'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM rooms_private.beta_invitations
    WHERE email_normalized = 'concurrent@example.test'
  ) THEN
    RAISE EXCEPTION 'QA invitation already exists';
  END IF;

  INSERT INTO rooms_private.beta_invitations (
    email_normalized, token_digest, expires_at
  )
  VALUES (
    'concurrent@example.test',
    extensions.digest(repeat('C', 43), 'sha256'),
    now() + interval '1 day'
  );
END;
$$;
SQL

cat > /tmp/rooms-invite-first.sql <<'SQL'
BEGIN;

INSERT INTO auth.users (email, raw_user_meta_data)
VALUES (
  'concurrent@example.test',
  jsonb_build_object(
    'rooms_age_18_confirmed', true,
    'rooms_terms_accepted', true,
    'rooms_terms_version', 'qa-1',
    'rooms_beta_invite_token', repeat('C', 43)
  )
);

SELECT 'FIRST_READY';
SELECT pg_sleep(12);
COMMIT;
SQL

cat > /tmp/rooms-invite-second.sql <<'SQL'
SET statement_timeout = '20000ms';

INSERT INTO auth.users (email, raw_user_meta_data)
VALUES (
  'concurrent@example.test',
  jsonb_build_object(
    'rooms_age_18_confirmed', true,
    'rooms_terms_accepted', true,
    'rooms_terms_version', 'qa-1',
    'rooms_beta_invite_token', repeat('C', 43)
  )
);
SQL

PGAPPNAME=rooms_qa_first \
  "$PSQL" -X -At -v ON_ERROR_STOP=1 \
  -d "$DB" -f /tmp/rooms-invite-first.sql \
  > /tmp/rooms-invite-first.log 2>&1 &
first_pid=$!

ready=0
i=0
while [ "$i" -lt 80 ]; do
  if grep -q FIRST_READY /tmp/rooms-invite-first.log; then
    ready=1
    break
  fi
  sleep 0.1
  i=$((i + 1))
done

if [ "$ready" -ne 1 ]; then
  echo "FAIL: primera transaccion no preparada"
  wait "$first_pid" || true
  exit 1
fi

echo "OK Primera transaccion abierta"

PGAPPNAME=rooms_qa_second \
  "$PSQL" -X -At -v ON_ERROR_STOP=1 \
  -d "$DB" -f /tmp/rooms-invite-second.sql \
  > /tmp/rooms-invite-second.log 2>&1 &
second_pid=$!

blocked=0
i=0
while [ "$i" -lt 80 ]; do
  lock_count=$("$PSQL" -X -At -d "$DB" -c "
    SELECT count(*)
    FROM pg_stat_activity
    WHERE application_name = 'rooms_qa_second'
      AND wait_event_type = 'Lock';
  ")

  if [ "$lock_count" -gt 0 ]; then
    blocked=1
    break
  fi

  sleep 0.1
  i=$((i + 1))
done

if wait "$first_pid"; then
  first_result=0
else
  first_result=1
fi

if wait "$second_pid"; then
  second_result=0
else
  second_result=1
fi

echo "=== RESULTADOS DE LAS CONEXIONES ==="
echo "Primera: $first_result"
echo "Segunda: $second_result"
echo "Bloqueo observado: $blocked"

if [ "$first_result" -ne 0 ]; then
  echo "FAIL: primera transaccion"
  cat /tmp/rooms-invite-first.log
  exit 1
fi

if [ "$blocked" -ne 1 ]; then
  echo "FAIL: no se observo contencion concurrente"
  exit 1
fi

if [ "$second_result" -eq 0 ]; then
  echo "FAIL: segunda alta aceptada"
  exit 1
fi

if ! grep -q 'Invitacion no valida' \
  /tmp/rooms-invite-second.log; then
  echo "FAIL: segundo rechazo inesperado"
  cat /tmp/rooms-invite-second.log
  exit 1
fi

"$PSQL" -X -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
DO $$
DECLARE
  n_users integer;
  n_used integer;
BEGIN
  SELECT count(*) INTO n_users
  FROM auth.users
  WHERE email = 'concurrent@example.test';

  SELECT count(*) INTO n_used
  FROM rooms_private.beta_invitations
  WHERE email_normalized = 'concurrent@example.test'
    AND used_at IS NOT NULL;

  IF n_users <> 1 OR n_used <> 1 THEN
    RAISE EXCEPTION
      'FAIL: users %, consumed %', n_users, n_used;
  END IF;

  RAISE NOTICE 'OK Solo un usuario creado';
  RAISE NOTICE 'OK Solo una invitacion consumida';
END;
$$;
SQL

echo "OK Segunda conexion rechazada"
echo "ROOMS M5.17B CONCURRENCY OK"
