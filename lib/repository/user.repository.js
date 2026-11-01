import { db } from '../db/index.ts';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { hashPassword, isLegacyHash, verifyPassword } from '../auth/password.js';

function generateUserId() {
  return `user_${randomUUID()}`;
}

function withoutPassword(user) {
  if (!user) return null;
  const { password: _password, ...rest } = user;
  return rest;
}

/**
 * Buscar usuario por email
 * @param {string} email - Email del usuario
 * @returns {Promise<Object|null>} Usuario encontrado o null
 */
export async function findUserByEmail(email) {
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * Buscar usuario por ID
 * @param {string} userId - ID del usuario
 * @returns {Promise<Object|null>} Usuario encontrado o null
 */
export async function findUserById(userId) {
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
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
  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    throw new Error('El usuario ya existe');
  }

  const newUser = {
    id: generateUserId(),
    email,
    password: hashPassword(password),
    name: name || null,
    currencyPreference: 'USD',
    createdAt: new Date(),
  };

  await db.insert(users).values(newUser);

  return withoutPassword(newUser);
}

/**
 * Validar credenciales de usuario. Si el hash almacenado es del formato antiguo,
 * se migra a scrypt de forma transparente tras un login correcto.
 * @param {string} email - Email del usuario
 * @param {string} password - Contraseña sin hashear
 * @returns {Promise<Object|null>} Usuario sin contraseña si es válido, null si no
 */
export async function validateUserCredentials(email, password) {
  const user = await findUserByEmail(email);

  if (!user || !verifyPassword(password, user.password)) {
    return null;
  }

  if (isLegacyHash(user.password)) {
    try {
      await db.update(users).set({ password: hashPassword(password) }).where(eq(users.id, user.id));
    } catch (error) {
      console.error('No se pudo migrar el hash de contraseña:', error);
    }
  }

  return withoutPassword(user);
}

/**
 * Actualizar información del usuario
 * @param {string} userId - ID del usuario
 * @param {Object} updates - Campos a actualizar
 * @returns {Promise<Object>} Usuario actualizado
 */
export async function updateUser(userId, updates) {
  const safeUpdates = { ...updates };
  if (safeUpdates.password) {
    safeUpdates.password = hashPassword(safeUpdates.password);
  }

  await db.update(users).set(safeUpdates).where(eq(users.id, userId));

  return withoutPassword(await findUserById(userId));
}

/**
 * Verificar contraseña actual del usuario
 * @param {string} userId - ID del usuario
 * @param {string} password - Contraseña en texto plano
 * @returns {Promise<boolean>} true si coincide
 */
export async function verifyUserPassword(userId, password) {
  const user = await findUserById(userId);
  if (!user) return false;

  return verifyPassword(password, user.password);
}

/**
 * Cambiar contraseña del usuario
 * @param {string} userId - ID del usuario
 * @param {string} newPassword - Nueva contraseña en texto plano
 * @returns {Promise<void>}
 */
export async function changeUserPassword(userId, newPassword) {
  await db.update(users).set({ password: hashPassword(newPassword) }).where(eq(users.id, userId));
}

/**
 * IDs de todos los usuarios (para los cron jobs)
 * @returns {Promise<string[]>}
 */
export async function findAllUserIds() {
  const rows = await db.select({ id: users.id }).from(users);
  return rows.map((row) => row.id);
}
