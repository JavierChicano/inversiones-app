import { beforeEach, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { db } from '@/lib/db/index';
import { users } from '@/lib/db/schema';
import { POST as register } from '@/app/api/auth/register/route';
import { POST as login } from '@/app/api/auth/login/route';
import { POST as logout } from '@/app/api/auth/logout/route';
import { GET as verifyGet, POST as verifyPost } from '@/app/api/auth/verify/route';
import { POST as changePassword } from '@/app/api/auth/change-password/route';
import { verifyToken } from '@/lib/auth/jwt';
import { isLegacyHash } from '@/lib/auth/password';
import { createTestUser, query, resetDatabase } from '../helpers/db.js';
import { call, makeRequest, readJson } from '../helpers/http.js';

beforeEach(resetDatabase);

describe('POST /api/auth/register', () => {
  test('crea el usuario, devuelve token y fija la cookie', async () => {
    const request = makeRequest('/api/auth/register', {
      method: 'POST',
      body: { email: 'Nuevo@Test.com', password: 'secret123', name: 'Nuevo' },
    });
    const response = await register(request);
    const { status, json } = await readJson(response);

    expect(status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.user).toMatchObject({ email: 'nuevo@test.com', name: 'Nuevo', currencyPreference: 'USD' });
    expect(json.user.password).toBeUndefined();
    expect(verifyToken(json.token).userId).toBe(json.user.id);
    expect(response.headers.get('set-cookie')).toContain(`auth_token=${json.token}`);

    const rows = await query('SELECT password FROM users WHERE email = ?', ['nuevo@test.com']);
    expect(rows[0].password).toMatch(/^scrypt\$/);
  });

  test('rechaza emails duplicados y datos inválidos', async () => {
    await createTestUser({ email: 'dup@test.com' });

    const dup = await call(register, '/api/auth/register', { method: 'POST', body: { email: 'dup@test.com', password: 'secret123' } });
    expect(dup.status).toBe(409);

    const invalid = await call(register, '/api/auth/register', { method: 'POST', body: { email: 'nope', password: 'secret123' } });
    expect(invalid.status).toBe(400);
    expect(invalid.json.error).toBe('Formato de email inválido');

    const short = await call(register, '/api/auth/register', { method: 'POST', body: { email: 'a@b.com', password: '123' } });
    expect(short.status).toBe(400);

    const malformed = await call(register, '/api/auth/register', { method: 'POST', body: '{not json' });
    expect(malformed.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  test('login correcto', async () => {
    const { user } = await createTestUser({ email: 'login@test.com', password: 'secret123' });
    const { status, json } = await call(login, '/api/auth/login', { method: 'POST', body: { email: 'LOGIN@test.com', password: 'secret123' } });

    expect(status).toBe(200);
    expect(json.user.id).toBe(user.id);
    expect(verifyToken(json.token).userId).toBe(user.id);
  });

  test('credenciales incorrectas devuelven 401 sin revelar si existe el usuario', async () => {
    await createTestUser({ email: 'login@test.com', password: 'secret123' });
    const wrong = await call(login, '/api/auth/login', { method: 'POST', body: { email: 'login@test.com', password: 'bad' } });
    const missing = await call(login, '/api/auth/login', { method: 'POST', body: { email: 'other@test.com', password: 'bad' } });

    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(wrong.json.error).toBe(missing.json.error);
  });

  test('migra hashes SHA-256 antiguos a scrypt tras un login correcto', async () => {
    const legacyHash = createHash('sha256').update('secret123').digest('hex');
    await db.insert(users).values({ id: 'user_legacy', email: 'legacy@test.com', password: legacyHash, createdAt: new Date() });

    const first = await call(login, '/api/auth/login', { method: 'POST', body: { email: 'legacy@test.com', password: 'secret123' } });
    expect(first.status).toBe(200);

    const rows = await query('SELECT password FROM users WHERE id = ?', ['user_legacy']);
    expect(isLegacyHash(rows[0].password)).toBe(false);
    expect(rows[0].password).toMatch(/^scrypt\$/);

    const second = await call(login, '/api/auth/login', { method: 'POST', body: { email: 'legacy@test.com', password: 'secret123' } });
    expect(second.status).toBe(200);
  });

  test('faltan campos', async () => {
    const { status } = await call(login, '/api/auth/login', { method: 'POST', body: { email: 'a@b.com' } });
    expect(status).toBe(400);
  });
});

describe('/api/auth/verify', () => {
  test('GET con cabecera y POST con cuerpo', async () => {
    const { user, token, authHeaders } = await createTestUser();

    const viaHeader = await call(verifyGet, '/api/auth/verify', { headers: authHeaders });
    expect(viaHeader.status).toBe(200);
    expect(viaHeader.json.user.id).toBe(user.id);
    expect(viaHeader.json.valid).toBe(true);

    const viaBody = await call(verifyPost, '/api/auth/verify', { method: 'POST', body: { token } });
    expect(viaBody.status).toBe(200);
  });

  test('token ausente, inválido o de usuario borrado', async () => {
    expect((await call(verifyGet, '/api/auth/verify')).status).toBe(401);
    expect((await call(verifyGet, '/api/auth/verify', { headers: { Authorization: 'Bearer nope' } })).status).toBe(401);
    expect((await call(verifyPost, '/api/auth/verify', { method: 'POST', body: {} })).status).toBe(401);

    const { user, authHeaders } = await createTestUser();
    await query('DELETE FROM users WHERE id = ?', [user.id]);
    expect((await call(verifyGet, '/api/auth/verify', { headers: authHeaders })).status).toBe(404);
  });
});

describe('POST /api/auth/change-password', () => {
  test('cambia la contraseña y permite el login con la nueva', async () => {
    const { authHeaders } = await createTestUser({ email: 'pw@test.com', password: 'secret123' });

    const { status, json } = await call(changePassword, '/api/auth/change-password', {
      method: 'POST',
      headers: authHeaders,
      body: { currentPassword: 'secret123', newPassword: 'newpass456', confirmPassword: 'newpass456' },
    });
    expect(status).toBe(200);
    expect(json.success).toBe(true);

    expect((await call(login, '/api/auth/login', { method: 'POST', body: { email: 'pw@test.com', password: 'newpass456' } })).status).toBe(200);
    expect((await call(login, '/api/auth/login', { method: 'POST', body: { email: 'pw@test.com', password: 'secret123' } })).status).toBe(401);
  });

  test('contraseña actual incorrecta y validaciones', async () => {
    const { authHeaders } = await createTestUser({ password: 'secret123' });

    const wrong = await call(changePassword, '/api/auth/change-password', {
      method: 'POST',
      headers: authHeaders,
      body: { currentPassword: 'bad', newPassword: 'newpass456', confirmPassword: 'newpass456' },
    });
    expect(wrong.status).toBe(401);

    const mismatch = await call(changePassword, '/api/auth/change-password', {
      method: 'POST',
      headers: authHeaders,
      body: { currentPassword: 'secret123', newPassword: 'newpass456', confirmPassword: 'other' },
    });
    expect(mismatch.status).toBe(400);

    expect((await call(changePassword, '/api/auth/change-password', { method: 'POST', body: {} })).status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  test('borra la cookie', async () => {
    const response = await logout();
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toMatch(/auth_token=;.*Max-Age=0/);
  });
});
