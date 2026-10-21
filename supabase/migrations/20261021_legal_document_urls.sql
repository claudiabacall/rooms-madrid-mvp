-- ROOMS: asociar cada version legal publicada
-- con una URL y una huella del documento.
-- No publica ni activa ninguna version.

ALTER TABLE public.legal_document_versions
ADD COLUMN IF NOT EXISTS document_url text;

ALTER TABLE public.legal_document_versions
ADD COLUMN IF NOT EXISTS document_sha256 text;

ALTER TABLE public.legal_document_versions
ADD CONSTRAINT legal_document_url_required_when_published
CHECK (
  published_at IS NULL
  OR (
    document_url IS NOT NULL
    AND document_url ~ '^https://'
    AND length(document_url) <= 2000
  )
);

ALTER TABLE public.legal_document_versions
ADD CONSTRAINT legal_document_hash_required_when_published
CHECK (
  published_at IS NULL
  OR (
    document_sha256 IS NOT NULL
    AND document_sha256 ~ '^[0-9a-f]{64}$'
  )
);
