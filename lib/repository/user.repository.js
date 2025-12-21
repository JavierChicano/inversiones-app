import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

// Función para hashear contraseñas
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Función para generar ID único simple
function generateUserId() {
  return `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Buscar usuario por email
 * @param {string} email - Email del usuario
 * @returns {Promise<Object|null>} Usuario encontrado o null
 */
export async function findUserByEmail(email) {
  try {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Error al buscar usuario por email:', error);
    throw error;
  }
}

/**
 * Buscar usuario por ID
 * @param {string} userId - ID del usuario
 * @returns {Promise<Object|null>} Usuario encontrado o null
 */
export async function findUserById(userId) {
  try {
    const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Error al buscar usuario por ID:', error);
    throw error;
  }
}

/**
 * Crear nuevo usuario
 * @param {Object} userData - Datos del usuario
 * @param {string} userData.email - Email del usuario
 * @param {string} userData.password - Contraseña sin hashear
 * @param {string} [userData.name] - Nombre del usuario (opcional)
 * @returns {Promise<Object>} Usuario creado (sin contraseña)
 */
export async function createUser({ email, password, name }) {
  try {
    // Verificar si el usuario ya existe
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      throw new Error('El usuario ya existe');
    }

    // Crear el nuevo usuario
    const userId = generateUserId();
    const hashedPassword = hashPassword(password);
    
    const newUser = {
      id: userId,
      email,
      password: hashedPassword,
      name: name || null,
      currencyPreference: 'USD',
      createdAt: new Date(),
    };

    await db.insert(users).values(newUser);

    // Retornar usuario sin la contraseña
    const { password: _, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  } catch (error) {
    console.error('Error al crear usuario:', error);
    throw error;
  }
}

/**
 * Validar credenciales de usuario
 * @param {string} email - Email del usuario
 * @param {string} password - Contraseña sin hashear
 * @returns {Promise<Object|null>} Usuario sin contraseña si es válido, null si no
 */
export async function validateUserCredentials(email, password) {
  try {
    const user = await findUserByEmail(email);
    
    if (!user) {
      return null;
    }

    const hashedPassword = hashPassword(password);
    
    if (user.password !== hashedPassword) {
      return null;
    }

    // Retornar usuario sin la contraseña
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  } catch (error) {
    console.error('Error al validar credenciales:', error);
    throw error;
  }
}

/**
 * Actualizar información del usuario
 * @param {string} userId - ID del usuario
 * @param {Object} updates - Campos a actualizar
 * @returns {Promise<Object>} Usuario actualizado
 */
export async function updateUser(userId, updates) {
  try {
    // Si se actualiza la contraseña, hashearla
    if (updates.password) {
      updates.password = hashPassword(updates.password);
    }

    await db.update(users).set(updates).where(eq(users.id, userId));

    const updatedUser = await findUserById(userId);
    const { password: _, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    throw error;
  }
}
