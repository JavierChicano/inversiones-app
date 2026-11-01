import { describe, expect, test } from 'bun:test';
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { hashPassword, isLegacyHash, verifyPassword } from '@/lib/auth/password';
import { decodeToken, generateToken, verifyToken } from '@/lib/auth/jwt';
import { getBearerToken, getUserIdFromRequest, isCronRequest, requireUser } from '@/lib/auth/request';
import { AUTH_COOKIE_NAME, clearAuthCookie, setAuthCookie } from '@/lib/auth/cookies';

describe('password', () => {
  test('hash con scrypt y sal aleatoria', () => {
    const a = hashPassword('secret123');
    const b = hashPassword('secret123');
    expect(a).toMatch(/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
    expect(a).not.toBe(b);
    expect(verifyPassword('secret123', a)).toBe(true);
    expect(verifyPassword('secret123', b)).toBe(true);
    expect(verifyPassword('wrong', a)).toBe(false);
    expect(isLegacyHash(a)).toBe(false);
  });

  test('acepta hashes antiguos SHA-256 y los identifica como legacy', () => {
    const legacy = createHash('sha256').update('secret123').digest('hex');
    expect(isLegacyHash(legacy)).toBe(true);
    expect(verifyPassword('secret123', legacy)).toBe(true);
    expect(verifyPassword('other', legacy)).toBe(false);
  });

  test('entradas inválidas no rompen', () => {
    expect(verifyPassword('x', '')).toBe(false);
    expect(verifyPassword('x', 'garbage')).toBe(false);
    expect(verifyPassword('x', 'scrypt$zz$zz')).toBe(false);
    expect(verifyPassword(undefined, hashPassword('a'))).toBe(false);
    expect(() => hashPassword('')).toThrow();
  });
});

describe('jwt', () => {
  test('genera y verifica tokens', () => {
    const token = generateToken({ userId: 'u1', email: 'a@b.com' });
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe('u1');
    expect(decoded.exp).toBeGreaterThan(decoded.iat);
    expect(decodeToken(token).email).toBe('a@b.com');
  });

  test('rechaza tokens inválidos, expirados o vacíos', () => {
    expect(verifyToken(null)).toBeNull();
    expect(verifyToken('')).toBeNull();
    expect(verifyToken('abc.def.ghi')).toBeNull();
    expect(verifyToken(generateToken({ userId: 'u1' }, '-10s'))).toBeNull();
    expect(verifyToken(42)).toBeNull();
  });
});

describe('request helpers', () => {
  const token = generateToken({ userId: 'u42' });

  test('getBearerToken', () => {
    expect(getBearerToken(new Request('http://x', { headers: { Authorization: `Bearer ${token}` } }))).toBe(token);
    expect(getBearerToken(new Request('http://x', { headers: { Authorization: `bearer ${token}` } }))).toBe(token);
    expect(getBearerToken(new Request('http://x', { headers: { Authorization: token } }))).toBeNull();
    expect(getBearerToken(new Request('http://x'))).toBeNull();
  });

  test('getUserIdFromRequest por cabecera y por cookie', () => {
    expect(getUserIdFromRequest(new Request('http://x', { headers: { Authorization: `Bearer ${token}` } }))).toBe('u42');
    expect(getUserIdFromRequest(new Request('http://x', { headers: { Authorization: 'Bearer nope' } }))).toBeNull();

    const withCookie = new NextRequest('http://x', { headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` } });
    expect(getUserIdFromRequest(withCookie)).toBeNull();
    expect(getUserIdFromRequest(withCookie, { allowCookie: true })).toBe('u42');
  });

  test('requireUser devuelve 401 listo para responder', async () => {
    const denied = requireUser(new Request('http://x'));
    expect(denied.error.status).toBe(401);
    expect(await denied.error.json()).toEqual({ error: 'No autorizado' });
    expect(requireUser(new Request('http://x', { headers: { Authorization: `Bearer ${token}` } }))).toEqual({ userId: 'u42' });
  });

  test('isCronRequest exige el secreto exacto', () => {
    expect(isCronRequest(new Request('http://x', { headers: { Authorization: 'Bearer test-cron-secret' } }))).toBe(true);
    expect(isCronRequest(new Request('http://x', { headers: { Authorization: 'Bearer other' } }))).toBe(false);
    expect(isCronRequest(new Request('http://x'))).toBe(false);

    const previous = process.env.CRON_SECRET;
    process.env.CRON_SECRET = '';
    expect(isCronRequest(new Request('http://x', { headers: { Authorization: 'Bearer ' } }))).toBe(false);
    process.env.CRON_SECRET = previous;
  });
});

describe('cookies', () => {
  test('setAuthCookie y clearAuthCookie', () => {
    const set = setAuthCookie(NextResponse.json({}), 'tok');
    const header = set.headers.get('set-cookie');
    expect(header).toContain(`${AUTH_COOKIE_NAME}=tok`);
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=lax/i);
    expect(header).toMatch(/Max-Age=604800/);

    const cleared = clearAuthCookie(NextResponse.json({}));
    expect(cleared.headers.get('set-cookie')).toMatch(/Max-Age=0/);
  });
});
