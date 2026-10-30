#!/usr/bin/env python3
"""Emision privada de invitaciones ROOMS, solo Supabase QA."""

import argparse
import base64
import hashlib
import os
import re
import secrets
import subprocess
from pathlib import Path

REF = "gpfmocptevpyzrwsubkj"
HOST = "aws-1-eu-west-3.pooler.supabase.com"
PSQL = "/Applications/Postgres.app/Contents/Versions/latest/bin/psql"
CERT = Path.home() / ".postgresql/rooms-qa/ca.crt"
PGPASS = Path.home() / ".pgpass-rooms-qa"


def new_token():
    return base64.urlsafe_b64encode(
        secrets.token_bytes(32)
    ).decode("ascii").rstrip("=")


def digest(token):
    return hashlib.sha256(token.encode("ascii")).hexdigest()


def validate_email(value):
    email = value.strip().lower()
    if (
        not 3 <= len(email) <= 254
        or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email)
        or "\x00" in email
    ):
        raise ValueError("Email no valido")
    return email


def sql_literal(value):
    return "'" + value.replace("'", "''") + "'"


def self_test():
    generated = [new_token() for _ in range(100)]
    assert len(set(generated)) == 100
    assert all(
        re.fullmatch(r"[A-Za-z0-9_-]{43}", token)
        for token in generated
    )
    assert all(len(bytes.fromhex(digest(token))) == 32
               for token in generated)
    assert validate_email(" TEST@Example.COM ") == "test@example.com"
    assert sql_literal("o'brien") == "'o''brien'"
    print("OK 100 codigos aleatorios de 43 caracteres")
    print("OK Codigos unicos en la prueba")
    print("OK SHA-256 de 32 bytes")
    print("OK Email normalizado")
    print("OK Valores SQL escapados")
    print("OK Ningun codigo ni hash mostrado")
    print("OK Ninguna conexion ni escritura")


def issue(email, days):
    if os.environ.get("ROOMS_QA_INVITES_APPROVED") != REF:
        raise RuntimeError(
            "Emision bloqueada: falta autorizacion expresa de beta QA"
        )

    if not CERT.is_file() or not PGPASS.is_file():
        raise RuntimeError("Faltan certificado o credenciales QA")

    token = new_token()
    token_hash = digest(token)

    sql = f"""
\\set ON_ERROR_STOP on
BEGIN;

DO $guard$
BEGIN
  IF current_database() <> 'postgres'
     OR session_user <> 'postgres'
     OR to_regclass('rooms_private.beta_invitations') IS NULL
  THEN
    RAISE EXCEPTION 'STOP: destino o esquema inesperado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND tgname = 'rooms_beta_registration_closed'
      AND tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'STOP: registro beta no bloqueado';
  END IF;
END;
$guard$;

INSERT INTO rooms_private.beta_invitations
  (email_normalized, token_digest, expires_at)
VALUES (
  {sql_literal(email)},
  decode('{token_hash}', 'hex'),
  now() + interval '{days} days'
)
RETURNING id;

COMMIT;
\\echo OK_ROOMS_INVITE_ISSUED
"""

    connection = (
        f"host={HOST} port=5432 dbname=postgres "
        f"user=postgres.{REF} sslmode=verify-full "
        f"sslrootcert={CERT} connect_timeout=12 "
        f"application_name=rooms_invite_qa"
    )

    env = dict(os.environ)
    env["PGPASSFILE"] = str(PGPASS)

    result = subprocess.run(
        [PSQL, "-X", "-w", "-q", "-A", "-t",
         "-v", "ON_ERROR_STOP=1", connection],
        input=sql,
        text=True,
        capture_output=True,
        env=env,
        timeout=30,
        check=False,
    )

    if (
        result.returncode != 0
        or "OK_ROOMS_INVITE_ISSUED" not in result.stdout
    ):
        raise RuntimeError(
            "No se ha confirmado la emision. "
            "No repetir sin revisar el estado de QA."
        )

    print("OK Invitacion emitida en rooms-beta-qa")
    print("Email:", email)
    print("Caducidad:", days, "dias")
    print("Codigo para entregar UNA SOLA VEZ:", token)
    print("No guardar este codigo en Git ni compartirlo en el chat.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--email")
    parser.add_argument("--days", type=int, default=7)
    parser.add_argument("--issue", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        self_test()
        return

    if not args.email:
        parser.error("Debes indicar --email")

    if not 1 <= args.days <= 30:
        parser.error("La caducidad debe estar entre 1 y 30 dias")

    email = validate_email(args.email)

    if not args.issue:
        print("OK Emisor preparado")
        print("Email:", email)
        print("Caducidad:", args.days, "dias")
        print("MODO PREPARACION: ninguna invitacion emitida")
        return

    issue(email, args.days)


if __name__ == "__main__":
    main()
