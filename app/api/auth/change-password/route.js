import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/request';
import { verifyUserPassword, changeUserPassword } from '@/lib/repository/user.repository';
import { jsonError, readJsonBody, validationError } from '@/lib/api/http';
import { validatePasswordChange } from '@/lib/validation/auth';

export async function POST(request) {
  try {
    const auth = requireUser(request);
    if (auth.error) return auth.error;

    const validation = validatePasswordChange((await readJsonBody(request)) || {});
    if (!validation.ok) return validationError(validation);

    const { currentPassword, newPassword } = validation.data;

    const isCurrentPasswordValid = await verifyUserPassword(auth.userId, currentPassword);
    if (!isCurrentPasswordValid) {
      return jsonError('La contraseña actual es incorrecta', 401);
    }

    await changeUserPassword(auth.userId, newPassword);

    return NextResponse.json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    return jsonError('Error interno al cambiar la contraseña', 500);
  }
}
