import crypto from 'crypto';

// En producción, usa una variable de entorno más segura
const JWT_SECRET = process.env.JWT_SECRET || 'tu-secreto-super-seguro-cambiame-en-produccion-12345';

/**
 * Encode a string to Base64 URL-safe
 */
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Decode a Base64 URL-safe string
 */
function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return Buffer.from(str, 'base64').toString('utf8');
}

/**
 * Crear un token JWT
 * @param {Object} payload - Datos a incluir en el token (ej: { userId, email })
 * @param {string} expiresIn - Tiempo de expiración (default: '7d')
 * @returns {string} Token JWT firmado
 */
export function generateToken(payload, expiresIn = '7d') {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  // Calcular timestamp de expiración
  const expirationMs = parseExpiration(expiresIn);
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiration = Math.floor((Date.now() + expirationMs) / 1000);

  const tokenPayload = {
    ...payload,
    iat: issuedAt,
    exp: expiration,
  };

  // Crear las partes del JWT
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));

  // Crear la firma
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verificar y decodificar un token JWT
 * @param {string} token - Token JWT a verificar
 * @returns {Object|null} Payload del token si es válido, null si no
 */
export function verifyToken(token) {
  try {
    if (!token) {
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, signature] = parts;

    // Verificar la firma
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    if (signature !== expectedSignature) {
      return null;
    }

    // Decodificar el payload
    const payload = JSON.parse(base64UrlDecode(encodedPayload));

    // Verificar expiración
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Token expirado
    }

    return payload;
  } catch (error) {
    console.error('Error al verificar token:', error);
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
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    return JSON.parse(base64UrlDecode(parts[1]));
  } catch (error) {
    return null;
  }
}

/**
 * Parsear string de expiración a milisegundos
 * @param {string} expiresIn - Ej: '7d', '24h', '30m'
 * @returns {number} Milisegundos
 */
function parseExpiration(expiresIn) {
  const units = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000; // Default: 7 días
  }

  const [, value, unit] = match;
  return parseInt(value) * units[unit];
}
