import { NextResponse } from 'next/server';
import { createUser } from '@/lib/repository/user.repository';
import { generateToken } from '@/lib/auth/jwt';
import { setAuthCookie } from '@/lib/auth/cookies';
import { jsonError, readJsonBody, validationError } from '@/lib/api/http';
import { validateRegistration } from '@/lib/validation/auth';

export async function POST(request) {
  try {
    const validation = validateRegistration((await readJsonBody(request)) || {});
    if (!validation.ok) return validationError(validation);

    const { email, password, name } = validation.data;
    const user = await createUser({ email, password, name });

    const token = generateToken({ userId: user.id, email: user.email, name: user.name }, '7d');

    const response = NextResponse.json(
      {
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          currencyPreference: user.currencyPreference,
        },
        message: 'Usuario registrado exitosamente',
      },
      { status: 201 }
    );

    return setAuthCookie(response, token);
  } catch (error) {
    if (error?.message === 'El usuario ya existe') {
      return jsonError('El email ya está registrado', 409);
    }

    console.error('Error en registro:', error);
    return jsonError('Error al registrar usuario', 500);
  }
}
