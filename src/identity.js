function invalid(message) { return Object.assign(new Error(message), { userMessage: message }); }

export const ALIASES = {
  'MAALKIN': 'NEETXSOFTYBABY01',
  'MALKIN': 'NEETXSOFTYBABY01',
  'SOFTYBABY': 'NEETXSOFTYBABY01',
  'SOFTY': 'NEETXSOFTYBABY01',
  'NEETXSOFTYBABY': 'NEETXSOFTYBABY01',
  'NEETXMAALKIN': 'NEETXSOFTYBABY01',
  'NEETXMAALKIN01': 'NEETXSOFTYBABY01',
};

export function resolveId(input) {
  const clean = String(input ?? '').trim();
  const normalized = clean.toUpperCase().replace(/[\s_\-]+/g, '');
  return ALIASES[normalized] || clean;
}

export function nameParts(input) {
  const displayName = String(input).trim().replace(/\s+/g, ' ');
  const stem = displayName.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
  if (displayName.length < 2 || displayName.length > 40 || !/^[\p{L}\p{M} '\-]+$/u.test(displayName) || stem.length < 2 || stem.length > 24)
    throw invalid('Enter a name with 2–24 Latin letters. Spaces and accents are welcome.');
  return { displayName, stem };
}
export function credentialsFor(input) {
  const resolved = resolveId(input);
  const id = String(resolved).trim().toUpperCase();
  if (!/^NEETX[A-Z]{2,24}[0-9]{2,9}$/.test(id)) throw Object.assign(invalid('Enter your ID.'), { code: 'auth/invalid-study-id' });
  // ID-only access, as requested. This deterministic credential is not a second secret.
  // Knowing/guessing an ID grants access; do not store sensitive information here.
  return { email: id.toLowerCase() + '@users.neetxruchi.invalid', password: id + '!nX'  };
}
