import { NextResponse } from 'next/server';
import { createUser } from '@/lib/repository/user.repository';
import { generateToken } from '@/lib/auth/jwt';

export async function POST(request) {
  try {
    const { email, password, name } = await request.json();

    // Validar que se enviaron los campos requeridos
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son requeridos' },
        { status: 400 }
      );
    }

    // Validar formato del email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Formato de email inválido' },
        { status: 400 }
      );
    }

    // Validar longitud de contraseña
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      );
    }

    // Crear el usuario
    const user = await createUser({ email, password, name });

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
      message: 'Usuario registrado exitosamente',
    }, { status: 201 });
  } catch (error) {
    console.error('Error en registro:', error);

    if (error.message === 'El usuario ya existe') {
      return NextResponse.json(
        { error: 'El email ya está registrado' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Error al registrar usuario' },
      { status: 500 }
    );
  }
}
