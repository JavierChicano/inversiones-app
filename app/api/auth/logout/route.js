import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth/cookies';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Sesión cerrada' });
  return clearAuthCookie(response);
}
