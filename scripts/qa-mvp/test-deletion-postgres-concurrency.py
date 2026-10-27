import os
import subprocess
import time

bin_dir = os.environ["ROOMS_PG_BIN"]
psql = os.path.join(bin_dir, "psql")

A = "11111111-1111-4111-8111-111111111111"
B = "22222222-2222-4222-8222-222222222222"
C = "33333333-3333-4333-8333-333333333333"
D = "44444444-4444-4444-8444-444444444444"
E = "55555555-5555-4555-8555-555555555555"

def run(sql, timeout=20):
    return subprocess.run(
        [psql, "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", sql],
        text=True,
        capture_output=True,
        timeout=timeout
    )

def start(sql):
    return subprocess.Popen(
        [psql, "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", sql],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

def finish(process):
    out, err = process.communicate(timeout=20)
    return process.returncode, out, err

def scalar(sql):
    r = run(sql)
    if r.returncode != 0:
        raise AssertionError(r.stderr)
    return r.stdout.strip()

def wait_held(user_id, seconds=5):
    until = time.monotonic() + seconds
    probe = (
        "SELECT pg_try_advisory_xact_lock("
        f"hashtextextended('{user_id}', 0));"
    )
    while time.monotonic() < until:
        if scalar(probe) == "f":
            return
        time.sleep(0.05)
    raise AssertionError("No se adquirio el bloqueo esperado")

def lock(user_id):
    return (
        "SELECT pg_advisory_xact_lock("
        f"hashtextextended('{user_id}', 0));"
    )

def guard_write(user_id, label):
    return f"""
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM qa_audits
            WHERE user_id = '{user_id}'
              AND status IN ('started', 'processing')
          ) THEN
            RAISE EXCEPTION 'Account deletion in progress';
          END IF;

          INSERT INTO qa_writes(user_id, label)
          VALUES ('{user_id}', '{label}');
        END
        $$;
    """

print("=== PRUEBA 1 · ESCRITURA ANTES DE BAJA ===", flush=True)

writer = start(
    "BEGIN; "
    + lock(A)
    + guard_write(A, "before-claim")
    + "SELECT pg_sleep(1.7); COMMIT;"
)

wait_held(A)

claim = start(
    "BEGIN; "
    + lock(A)
    + f"UPDATE qa_audits SET status='processing' WHERE user_id='{A}'; "
    + "COMMIT;"
)

time.sleep(0.25)
assert claim.poll() is None, "El claim no espero al escritor"

writer_result = finish(writer)
claim_result = finish(claim)

assert writer_result[0] == 0, writer_result[2]
assert claim_result[0] == 0, claim_result[2]
assert scalar(
    f"SELECT status FROM qa_audits WHERE user_id='{A}';"
) == "processing"

print("OK Claim espera a la escritura previa", flush=True)

print("=== PRUEBA 2 · BAJA ANTES DE ESCRITURA ===", flush=True)

claim = start(
    "BEGIN; "
    + lock(B)
    + f"UPDATE qa_audits SET status='processing' WHERE user_id='{B}'; "
    + "SELECT pg_sleep(1.7); COMMIT;"
)

wait_held(B)

writer = start(
    "BEGIN; "
    + lock(B)
    + guard_write(B, "must-not-exist")
    + "COMMIT;"
)

time.sleep(0.25)
assert writer.poll() is None, "El escritor no espero al claim"

claim_result = finish(claim)
writer_result = finish(writer)

assert claim_result[0] == 0, claim_result[2]
assert writer_result[0] != 0, "La escritura debio rechazarse"
assert "Account deletion in progress" in writer_result[2]
assert scalar(
    f"SELECT count(*) FROM qa_writes WHERE user_id='{B}';"
) == "0"

print("OK Escritura posterior rechazada", flush=True)

print("=== PRUEBA 3 · ERROR LIBERA BLOQUEO ===", flush=True)

failed = run(
    "BEGIN; "
    + lock(C)
    + "DO $$ BEGIN RAISE EXCEPTION 'qa rollback'; END $$;"
)

assert failed.returncode != 0
assert "qa rollback" in failed.stderr

released = scalar(
    "SELECT pg_try_advisory_xact_lock("
    f"hashtextextended('{C}', 0));"
)

assert released == "t", "Bloqueo no liberado tras rollback"

print("OK Error libera bloqueo transaccional", flush=True)

print("=== PRUEBA 4 · USUARIOS DIFERENTES ===", flush=True)

first = start(
    "BEGIN; " + lock(D) + "SELECT pg_sleep(1.7); COMMIT;"
)
wait_held(D)

second = start(
    "BEGIN; " + lock(E) + "SELECT pg_sleep(1.7); COMMIT;"
)
wait_held(E)

assert first.poll() is None, "Primera operacion termino antes"
assert second.poll() is None, "Segunda operacion termino antes"

first_result = finish(first)
second_result = finish(second)

assert first_result[0] == 0, first_result[2]
assert second_result[0] == 0, second_result[2]

print("OK Cuentas diferentes mantienen bloqueos simultaneos")
print("ROOMS POSTGRES REAL CONCURRENCY 4/4 OK")
