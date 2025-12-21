import { NextResponse } from 'next/server';
import { validateUserCredentials } from '@/lib/repository/user.repository';
import { generateToken } from '@/lib/auth/jwt';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    // Validar que se enviaron los campos requeridos
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son requeridos' },
        { status: 400 }
      );
    }

    // Validar credenciales
    const user = await validateUserCredentials(email, password);

    if (!user) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    // Generar JWT con información del usuario
    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    }, '7d');

    return NextResponse.json({
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
  } catch (error) {
    console.error('Error en login:', error);
    return NextResponse.json(
      { error: 'Error al iniciar sesión' },
      { status: 500 }
    );
  }
}
