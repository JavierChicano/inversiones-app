import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { verifyUserPassword, changeUserPassword } from '@/lib/repository/user.repository';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 });
    }

    const { currentPassword, newPassword, confirmPassword } = await request.json();

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: 'Todos los campos son obligatorios' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'La nueva contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'La confirmación no coincide con la nueva contraseña' },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: 'La nueva contraseña no puede ser igual a la actual' },
        { status: 400 }
      );
    }

    const isCurrentPasswordValid = await verifyUserPassword(decoded.userId, currentPassword);

    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { error: 'La contraseña actual es incorrecta' },
        { status: 401 }
      );
    }

    await changeUserPassword(decoded.userId, newPassword);

    return NextResponse.json({
      success: true,
      message: 'Contraseña actualizada correctamente',
    });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    return NextResponse.json(
      { error: 'Error interno al cambiar la contraseña' },
      { status: 500 }
    );
  }
}
