/*
 * ROOMS - Prototipo aislado de elegibilidad beta.
 * NO conectar directamente al frontend ni a Auth.
 *
 * La invitacion debe verificarse en el servidor.
 * Su consumo debe ser atomico en base de datos.
 * Esta funcion NO valida tokens ni crea cuentas.
 */
export function checkBetaInvite({
  invite,
  email,
  now,
  registrationOpen = false,
  legalApproved = false,
  adultConfirmed = false,
  termsAccepted = false,
  currentTermsVersion = null,
  acceptedTermsVersion = null
}) {
  const deny = reason => ({
    allowed: false,
    reason
  });

  if (!registrationOpen || !legalApproved) {
    return deny('REGISTRATION_CLOSED');
  }

  if (!adultConfirmed || !termsAccepted) {
    return deny('LEGAL_REQUIREMENTS_MISSING');
  }

  if (
    !currentTermsVersion ||
    acceptedTermsVersion !== currentTermsVersion
  ) {
    return deny('TERMS_VERSION_INVALID');
  }

  if (!invite || invite.status !== 'pending') {
    return deny('INVITE_NOT_AVAILABLE');
  }

  if (invite.used_at != null) {
    return deny('INVITE_ALREADY_USED');
  }

  const normalize = value =>
    typeof value === 'string'
      ? value.trim().toLowerCase()
      : '';

  if (
    !normalize(email) ||
    normalize(email) !== normalize(invite.email)
  ) {
    return deny('EMAIL_MISMATCH');
  }

  const nowTime = Date.parse(now);
  const expiry = Date.parse(invite.expires_at);

  if (
    !Number.isFinite(nowTime) ||
    !Number.isFinite(expiry) ||
    nowTime >= expiry
  ) {
    return deny('INVITE_EXPIRED');
  }

  return { allowed: true, reason: 'ELIGIBLE' };
}
