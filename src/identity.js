function invalid(message) { return Object.assign(new Error(message), { userMessage: message }); }
export function nameParts(input) {
  const displayName = String(input).trim().replace(/\s+/g, ' ');
  const stem = displayName.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
  if (displayName.length < 2 || displayName.length > 40 || !/^[\p{L}\p{M} '\-]+$/u.test(displayName) || stem.length < 2 || stem.length > 24)
    throw invalid('Enter a name with 2–24 Latin letters. Spaces and accents are welcome.');
  return { displayName, stem };
}
export function credentialsFor(input) {
  const id = String(input).trim().toUpperCase();
  if (!/^NEETX[A-Z]{2,24}[0-9]{2,9}$/.test(id)) throw invalid('Enter your study ID, for example NEETXRUCHI01.');
  // ID-only access, as requested. This deterministic credential is not a second secret.
  // Knowing/guessing an ID grants access; do not store sensitive information here.
  return { email: id.toLowerCase() + '@users.neetxruchi.invalid', password: id + '!nX'  };
}
