from pathlib import Path
import os
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]
BIN = Path("/Applications/Postgres.app/Contents/Versions/latest/bin")
CLAIM = ROOT / "docs/review/m518h-coordinated-deletion-claim-DRAFT.sql"
GUARD = ROOT / "docs/review/m518g-messages-connections-barrier-DRAFT.sql"

TARGET = "11111111-1111-4111-8111-111111111111"
OTHER = "22222222-2222-4222-8222-222222222222"
THIRD = "33333333-3333-4333-8333-333333333333"
AUDIT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

def run(args, env=None, expect_ok=True):
    result = subprocess.run(
        args, env=env, text=True, capture_output=True, timeout=30
    )
    if expect_ok and result.returncode:
        raise AssertionError(
            f"Comando fallido: {result.stderr[-1500:]}"
        )
    return result

def psql(env, sql=None, file=None, expect_ok=True):
    command = [
        str(BIN / "psql"), "-X", "-qAt",
        "-v", "ON_ERROR_STOP=1"
    ]
    if file:
        command += ["-f", str(file)]
    else:
        command += ["-c", sql]
    return run(command, env, expect_ok)

def must_block(env, sql, label):
    result = psql(env, sql, expect_ok=False)
    if result.returncode == 0:
        raise AssertionError(f"{label}: escritura permitida")
    if "Account deletion write blocked" not in result.stderr:
        raise AssertionError(
            f"{label}: error distinto al esperado: "
            + result.stderr[-500:]
        )
    print(f"OK {label}")

for name in ("initdb", "pg_ctl", "psql"):
    if not (BIN / name).is_file():
        raise SystemExit(f"Falta Postgres.app: {name}")

if not CLAIM.is_file() or not GUARD.is_file():
    raise SystemExit("Faltan los borradores SQL")

with tempfile.TemporaryDirectory(prefix="rooms-m518h-") as temp:
    base = Path(temp)
    data = base / "data"
    socket = base / "socket"
    socket.mkdir()

    env = os.environ.copy()
    env.update({
        "PGHOST": str(socket),
        "PGPORT": "55444",
        "PGDATABASE": "postgres",
        "PGUSER": os.environ["USER"],
        "PGPASSWORD": ""
    })

    run([
        str(BIN / "initdb"), "-D", str(data),
        "-A", "trust", "--no-instructions"
    ])

    started = False
    try:
        run([
            str(BIN / "pg_ctl"), "-D", str(data),
            "-l", str(base / "postgres.log"),
            "-o", f"-k {socket} -p 55444 -c listen_addresses=''",
            "-w", "start"
        ])
        started = True
        print("OK PostgreSQL temporal iniciado")

        psql(env, f"""
CREATE SCHEMA auth;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  raw_user_meta_data jsonb NOT NULL
);

INSERT INTO auth.users VALUES
('{TARGET}', 'rooms-delete-qa-integrated@example.com',
 '{{"rooms_deletion_test":"true"}}');

CREATE TABLE public.account_deletion_audit (
  id uuid PRIMARY KEY,
  target_user_id uuid NOT NULL,
  status text NOT NULL,
  finished_at timestamptz,
  storage_verified boolean NOT NULL DEFAULT false,
  auth_verified boolean NOT NULL DEFAULT false,
  database_verified boolean NOT NULL DEFAULT false,
  shared_impact_verified boolean NOT NULL DEFAULT false
);

INSERT INTO public.account_deletion_audit
  (id, target_user_id, status)
VALUES ('{AUDIT}', '{TARGET}', 'failed');

CREATE TABLE public.messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  body text NOT NULL
);

CREATE TABLE public.connections (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  requester_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'
);
""")

        psql(env, file=CLAIM)

        psql(env, """
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON public.messages, public.connections
  TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public
  TO service_role;
""")

        # Filas existentes para comprobar UPDATE y DELETE.
        psql(env, f"""
INSERT INTO public.messages(sender_id,recipient_id,body)
VALUES ('{TARGET}','{OTHER}','existing');
INSERT INTO public.connections(requester_id,recipient_id)
VALUES ('{TARGET}','{OTHER}');
""")

        # Activar triggers despues de crear datos iniciales.
        psql(env, file=GUARD)

        # Dos procesos PostgreSQL independientes:
        # el escritor mantiene un bloqueo durante 2.5 s.
        writer_sql = f"""
BEGIN;
INSERT INTO public.messages(sender_id,recipient_id,body)
VALUES ('{OTHER}','{TARGET}','in flight');
SELECT 'WRITER_LOCKED';
SELECT pg_sleep(5);
COMMIT;
"""
        writer = subprocess.Popen(
            [
                str(BIN / "psql"), "-X", "-qAt",
                "-v", "ON_ERROR_STOP=1", "-c", writer_sql
            ],
            env=env, text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )

        try:
            # Esperar a que PostgreSQL confirme el bloqueo
            # desde otra conexion, sin depender de stdout.
            deadline = time.monotonic() + 4
            locked = False

            while time.monotonic() < deadline:
                if writer.poll() is not None:
                    raise AssertionError(
                        "El escritor termino antes de adquirir bloqueo"
                    )

                active = psql(env, """
SELECT count(*)
FROM pg_catalog.pg_locks
WHERE locktype = 'advisory'
  AND granted = true
  AND pid <> pg_backend_pid();
""").stdout.strip()

                if active.isdigit() and int(active) >= 1:
                    locked = True
                    break

                time.sleep(0.05)

            if not locked:
                raise AssertionError(
                    "PostgreSQL no confirmo bloqueo del escritor"
                )

            print("OK Bloqueo advisory confirmado en pg_locks")

            psql(env, f"UPDATE public.account_deletion_audit "
                      f"SET status='started' WHERE id='{AUDIT}';")

            start = time.monotonic()
            result = psql(env, f"""
SELECT audit_id FROM
public.rooms_admin_claim_disposable_deletion(
  '{AUDIT}'::uuid, '{TARGET}'::uuid
);
""")
            elapsed = time.monotonic() - start

            output, errors = writer.communicate(timeout=15)
            if writer.returncode:
                raise AssertionError(errors[-500:])
            if AUDIT not in result.stdout:
                raise AssertionError("Claim no confirmado")
            if elapsed < 1.0:
                raise AssertionError(
                    f"Claim no espero al escritor: {elapsed:.2f}s"
                )
            print("OK Claim espera a escritura previa")
        finally:
            if writer.poll() is None:
                writer.kill()
                writer.communicate()

        status = psql(env, f"""
SELECT status FROM public.account_deletion_audit
WHERE id = '{AUDIT}';
""").stdout.strip()
        if status != "processing":
            raise AssertionError(f"Estado incorrecto: {status}")
        print("OK Claim confirma estado processing")

        must_block(env, f"""
INSERT INTO public.messages(sender_id,recipient_id,body)
VALUES ('{OTHER}','{TARGET}','late');
""", "Mensaje posterior bloqueado")

        must_block(env, f"""
INSERT INTO public.connections(requester_id,recipient_id)
VALUES ('{TARGET}','{OTHER}');
""", "Conexion posterior bloqueada")

        must_block(env, f"""
UPDATE public.messages SET body='edited'
WHERE sender_id='{TARGET}';
""", "UPDATE de mensaje bloqueado")

        must_block(env, f"""
DELETE FROM public.connections
WHERE requester_id='{TARGET}';
""", "DELETE de conexion bloqueado")

        must_block(env, f"""
SET ROLE service_role;
INSERT INTO public.messages(sender_id,recipient_id,body)
VALUES ('{OTHER}','{TARGET}','privileged');
""", "Escritura privilegiada bloqueada")

        # Una limpieza directa con permisos privilegiados
        # tampoco puede esquivar los triggers.
        must_block(env, f"""
SET ROLE service_role;
DELETE FROM public.messages
WHERE sender_id = '{TARGET}';
""", "DELETE privilegiado de mensajes bloqueado")

        must_block(env, f"""
SET ROLE service_role;
DELETE FROM public.connections
WHERE requester_id = '{TARGET}';
""", "DELETE privilegiado de conexiones bloqueado")

        must_block(env, f"""
SET ROLE service_role;
UPDATE public.connections
SET status = 'accepted'
WHERE requester_id = '{TARGET}';
""", "UPDATE privilegiado de conexiones bloqueado")

        psql(env, f"""
INSERT INTO public.messages(sender_id,recipient_id,body)
VALUES ('{OTHER}','{THIRD}','unaffected');
""")
        print("OK Escritura de terceros permitida")

        print("ROOMS M5.18H INTEGRACION LOCAL OK")
        print("NO DESPLEGADO - BAJA REAL NO AUTORIZADA")

    finally:
        if started:
            run([
                str(BIN / "pg_ctl"), "-D", str(data),
                "-m", "immediate", "-w", "stop"
            ])
