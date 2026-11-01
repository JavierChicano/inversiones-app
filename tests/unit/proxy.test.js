import { describe, expect, test } from 'bun:test';
import { NextRequest } from 'next/server';
import { config, proxy } from '@/proxy';
import { generateToken } from '@/lib/auth/jwt';

function dashboardRequest(cookie) {
  return new NextRequest('http://localhost:3000/dashboard/transactions', cookie ? { headers: { cookie } } : undefined);
}

describe('proxy (protección de /dashboard)', () => {
  test('solo aplica a /dashboard', () => {
    expect(config.matcher).toEqual(['/dashboard/:path*']);
  });

  test('sin cookie redirige al inicio', () => {
    const response = proxy(dashboardRequest());
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/');
  });

  test('con token inválido redirige y borra la cookie', () => {
    const response = proxy(dashboardRequest('auth_token=not-a-token'));
    expect(response.status).toBe(307);
    expect(response.headers.get('set-cookie')).toMatch(/auth_token=;.*Max-Age=0/);
  });

  test('con token expirado redirige', () => {
    const expired = generateToken({ userId: 'u1' }, '-1s');
    expect(proxy(dashboardRequest(`auth_token=${expired}`)).status).toBe(307);
  });

  test('con token válido deja pasar sin tocar la cookie', () => {
    const token = generateToken({ userId: 'u1' });
    const response = proxy(dashboardRequest(`auth_token=${token}`));
    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
