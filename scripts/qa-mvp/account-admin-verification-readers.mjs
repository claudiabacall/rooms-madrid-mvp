import { validate as isUuid } from './account-deletion-uuid.mjs';

export function createVerificationReaders({
  url,
  key,
  fetchImpl = fetch
}) {
  if (
    typeof url !== 'string' ||
    !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) ||
    typeof key !== 'string' ||
    !key ||
    typeof fetchImpl !== 'function'
  ) {
    throw new Error('Configuracion administrativa invalida');
  }

  const base = url.replace(/\/+$/, '');

  async function request(path, options = {}) {
    return fetchImpl(`${base}${path}`, {
      ...options,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        ...(options.headers || {})
      },
      signal: AbortSignal.timeout(15000)
    });
  }

  return {
    async getAuthUser(targetId) {
      if (!isUuid(targetId)) {
        throw new Error('UUID de usuario invalido');
      }

      const response = await request(
        `/auth/v1/admin/users/${targetId}`
      );

      // Un 404 del endpoint administrativo confirma
      // ausencia; otros errores nunca se interpretan
      // como una eliminacion satisfactoria.
      if (response.status === 404) {
        return { absent: true };
      }

      if (!response.ok) {
        throw new Error(`Consulta Auth HTTP ${response.status}`);
      }

      const user = await response.json();

      if (user?.id !== targetId) {
        throw new Error('Identidad Auth inesperada');
      }

      return { absent: false };
    },

    async getStorageDatabaseVerification({
      auditId,
      targetId,
      claimToken
    }) {
      if (![auditId, targetId, claimToken].every(isUuid)) {
        throw new Error('Identificadores de Storage invalidos');
      }

      const response = await request(
        '/rest/v1/rpc/rooms_admin_verify_deleted_storage',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            p_audit_id: auditId,
            p_target_id: targetId,
            p_claim_token: claimToken
          })
        }
      );

      if (!response.ok) {
        throw new Error(
          `Verificacion Storage DB HTTP ${response.status}`
        );
      }

      const rows = await response.json();
      const fields = [
        'archivos_restantes',
        'por_owner',
        'por_owner_id',
        'por_ruta',
        'fuera_de_buckets_previstos',
        'buckets_afectados'
      ];

      if (
        !Array.isArray(rows) ||
        rows.length !== 1 ||
        fields.some(field =>
          !Number.isSafeInteger(rows[0]?.[field]) ||
          rows[0][field] !== 0
        )
      ) {
        throw new Error(
          'Storage DB no acredita ausencia total'
        );
      }

      return true;
    },

    async getDatabaseVerification({
      auditId,
      targetId,
      claimToken
    }) {
      if (![auditId, targetId, claimToken].every(isUuid)) {
        throw new Error('Identificadores de auditoria invalidos');
      }

      const response = await request(
        '/rest/v1/rpc/rooms_admin_verify_deleted_user',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            p_audit_id: auditId,
            p_target_id: targetId,
            p_claim_token: claimToken
          })
        }
      );

      if (!response.ok) {
        throw new Error(
          `Verificacion BD HTTP ${response.status}`
        );
      }

      const rows = await response.json();

      if (!Array.isArray(rows) || rows.length !== 1) {
        throw new Error('Respuesta BD incompleta');
      }

      const row = rows[0];

      if (
        typeof row?.auth_absent !== 'boolean' ||
        !Number.isSafeInteger(row.fk_relations_checked) ||
        !Number.isSafeInteger(row.remaining_fk_rows) ||
        row.remaining_fk_rows < 0
      ) {
        throw new Error('Evidencia BD invalida');
      }

      return row;
    }
  };
}
