import jwt from 'jsonwebtoken';

// En producción, usa una variable de entorno más segura
const JWT_SECRET = process.env.JWT_SECRET || 'tu-secreto-super-seguro-cambiame-en-produccion-12345';

/**
 * Crear un token JWT
 * @param {Object} payload - Datos a incluir en el token (ej: { userId, email })
 * @param {string} expiresIn - Tiempo de expiración (default: '7d')
 * @returns {string} Token JWT firmado
 */
export function generateToken(payload, expiresIn = '7d') {
  try {
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
  } catch (error) {
    console.error('Error al generar token:', error);
    throw error;
  }
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

    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
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
    return jwt.decode(token);
  } catch (error) {
    console.error('Error al decodificar token:', error);
    return null;
  }
}
