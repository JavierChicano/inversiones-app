import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { refreshAssetsForUsers } from '@/lib/services/assetRefresh.service';

export async function POST(request) {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const result = await refreshAssetsForUsers({ userIds: [userId] });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error al actualizar assets del usuario:', error);
    return NextResponse.json(
      { error: 'Error al actualizar assets', details: error.message },
      { status: 500 }
    );
  }
}
