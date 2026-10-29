\set ON_ERROR_STOP on

CREATE SCHEMA IF NOT EXISTS public;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE qa_privileged NOLOGIN;

CREATE TABLE public.account_deletion_audit (
  target_user_id uuid PRIMARY KEY,
  status text NOT NULL
);

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

INSERT INTO public.account_deletion_audit VALUES
('11111111-1111-4111-8111-111111111111', 'processing');

\ir ../../docs/review/m518g-messages-connections-barrier-DRAFT.sql

GRANT USAGE ON SCHEMA public TO qa_privileged;
GRANT ALL ON public.messages, public.connections
TO qa_privileged;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public
TO qa_privileged;

-- Esta prueba exige que una cuenta en proceso
-- quede bloqueada aun para un rol privilegiado
-- que puede escribir directamente en las tablas.
DO $$
DECLARE
  blocked boolean;
BEGIN
  SET ROLE qa_privileged;

  blocked := false;
  BEGIN
    INSERT INTO public.messages(sender_id, recipient_id, body)
    VALUES (
      '22222222-2222-4222-8222-222222222222',
      '11111111-1111-4111-8111-111111111111',
      'test'
    );
  EXCEPTION WHEN raise_exception THEN
    blocked := true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'Message INSERT bypassed guard';
  END IF;

  blocked := false;
  BEGIN
    INSERT INTO public.connections(requester_id, recipient_id)
    VALUES (
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222'
    );
  EXCEPTION WHEN raise_exception THEN
    blocked := true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'Connection INSERT bypassed guard';
  END IF;

  RESET ROLE;
END;
$$;

-- Un tercero sin auditoria activa puede escribir.
INSERT INTO public.messages(sender_id, recipient_id, body)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  'test'
);

INSERT INTO public.connections(requester_id, recipient_id)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333'
);

-- UPDATE que introduce una cuenta protegida.
DO $$
BEGIN
  BEGIN
    UPDATE public.messages
    SET recipient_id = '11111111-1111-4111-8111-111111111111';
    RAISE EXCEPTION 'Message UPDATE bypassed guard';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM = 'Message UPDATE bypassed guard' THEN
        RAISE;
      END IF;
  END;

  BEGIN
    UPDATE public.connections
    SET recipient_id = '11111111-1111-4111-8111-111111111111';
    RAISE EXCEPTION 'Connection UPDATE bypassed guard';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM = 'Connection UPDATE bypassed guard' THEN
        RAISE;
      END IF;
  END;
END;
$$;

-- Una operacion de lectura permanece permitida.
SELECT count(*) AS messages_unaffected
FROM public.messages;

SELECT count(*) AS connections_unaffected
FROM public.connections;

\echo OK M5.18G SQL LOCAL
