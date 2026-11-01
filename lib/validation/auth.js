import { fail, ok } from './common.js';

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 6;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_NAME_LENGTH = 100;

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function validateRegistration(body = {}) {
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, MAX_NAME_LENGTH) : '';

  if (!email || !password) {
    return fail('Email y contraseña son requeridos');
  }

  if (!EMAIL_REGEX.test(email)) {
    return fail('Formato de email inválido');
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return fail(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return fail(`La contraseña no puede superar ${MAX_PASSWORD_LENGTH} caracteres`);
  }

  return ok({ email, password, name: name || null });
}

export function validateLogin(body = {}) {
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return fail('Email y contraseña son requeridos');
  }

  return ok({ email, password });
}

export function validatePasswordChange(body = {}) {
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';

  if (!currentPassword || !newPassword || !confirmPassword) {
    return fail('Todos los campos son obligatorios');
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return fail(`La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
  }

  if (newPassword.length > MAX_PASSWORD_LENGTH) {
    return fail(`La contraseña no puede superar ${MAX_PASSWORD_LENGTH} caracteres`);
  }

  if (newPassword !== confirmPassword) {
    return fail('La confirmación no coincide con la nueva contraseña');
  }

  if (currentPassword === newPassword) {
    return fail('La nueva contraseña no puede ser igual a la actual');
  }

  return ok({ currentPassword, newPassword });
}
