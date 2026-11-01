import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/**
 * Hash de contraseñas con scrypt y sal aleatoria.
 * Formato almacenado: `scrypt$<sal hex>$<hash hex>`.
 *
 * Los hashes antiguos (SHA-256 sin sal, 64 caracteres hex) se siguen aceptando al verificar
 * y se migran al nuevo formato de forma transparente en el siguiente login correcto.
 */

const SCRYPT_PREFIX = 'scrypt';
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };
const LEGACY_SHA256_REGEX = /^[a-f0-9]{64}$/i;
const HEX_REGEX = /^(?:[a-f0-9]{2})+$/i;

function legacyHash(password) {
  return createHash('sha256').update(password).digest('hex');
}

/**
 * @param {string} password
 * @returns {string}
 */
export function hashPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('La contraseña no puede estar vacía');
  }

  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, SCRYPT_KEY_LENGTH, SCRYPT_OPTIONS);
  return `${SCRYPT_PREFIX}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/**
 * @param {string} stored - Hash almacenado
 * @returns {boolean} true si es un hash antiguo (SHA-256 sin sal) que conviene migrar
 */
export function isLegacyHash(stored) {
  return typeof stored === 'string' && LEGACY_SHA256_REGEX.test(stored);
}

/**
 * @param {string} password - Contraseña en texto plano
 * @param {string} stored - Hash almacenado (scrypt o SHA-256 antiguo)
 * @returns {boolean}
 */
export function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string' || !stored) {
    return false;
  }

  if (isLegacyHash(stored)) {
    const expected = Buffer.from(stored, 'hex');
    const actual = Buffer.from(legacyHash(password), 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  const [prefix, saltHex, hashHex] = stored.split('$');
  if (prefix !== SCRYPT_PREFIX || !HEX_REGEX.test(saltHex || '') || !HEX_REGEX.test(hashHex || '')) {
    return false;
  }

  try {
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    if (salt.length < 8 || expected.length < 16) {
      return false;
    }

    const actual = scryptSync(password, salt, expected.length, SCRYPT_OPTIONS);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
