import { NextResponse } from 'next/server';
import { validateUserCredentials } from '@/lib/repository/user.repository';
import { generateToken } from '@/lib/auth/jwt';
import { setAuthCookie } from '@/lib/auth/cookies';
import { jsonError, readJsonBody, validationError } from '@/lib/api/http';
import { validateLogin } from '@/lib/validation/auth';

export async function POST(request) {
  try {
    const validation = validateLogin((await readJsonBody(request)) || {});
    if (!validation.ok) return validationError(validation);

    const { email, password } = validation.data;
    const user = await validateUserCredentials(email, password);

    if (!user) {
      return jsonError('Credenciales inválidas', 401);
    }

    const token = generateToken({ userId: user.id, email: user.email, name: user.name }, '7d');

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        currencyPreference: user.currencyPreference,
      },
      message: 'Inicio de sesión exitoso',
    });

    return setAuthCookie(response, token);
  } catch (error) {
    console.error('Error en login:', error);
    return jsonError('Error al iniciar sesión', 500);
  }
}
