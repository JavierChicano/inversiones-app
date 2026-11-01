import jwt from 'jsonwebtoken';

const DEV_FALLBACK_SECRET = 'dev-only-secret-no-usar-en-produccion';

function resolveSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Falta la variable de entorno JWT_SECRET');
  }

  return DEV_FALLBACK_SECRET;
}

/**
 * Crear un token JWT
 * @param {Object} payload - Datos a incluir en el token (ej: { userId, email })
 * @param {string} expiresIn - Tiempo de expiración (default: '7d')
 * @returns {string} Token JWT firmado
 */
export function generateToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, resolveSecret(), { expiresIn });
}

/**
 * Verificar y decodificar un token JWT
 * @param {string} token - Token JWT a verificar
 * @returns {Object|null} Payload del token si es válido, null si no
 */
export function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  try {
    return jwt.verify(token, resolveSecret());
  } catch (error) {
    if (error?.name === 'TokenExpiredError' || error?.name === 'JsonWebTokenError' || error?.name === 'NotBeforeError') {
      return null;
    }

    console.error('Error inesperado al verificar token:', error);
    return null;
  }
}

/**
 * Decodificar un token sin verificar (útil para debugging)
 * @param {string} token - Token JWT
 * @returns {Object|null} Payload decodificado o null
 */
export function decodeToken(token) {
  try {
    return jwt.decode(token);
  } catch (error) {
    console.error('Error al decodificar token:', error);
    return null;
  }
}
