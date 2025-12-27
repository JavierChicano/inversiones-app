import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { findAllAssets } from '@/lib/repository/asset.repository';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    jwt.verify(token, process.env.JWT_SECRET);

    const assets = await findAllAssets();

    return NextResponse.json({ assets });
  } catch (error) {
    console.error('Error fetching assets:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Error al obtener assets' },
      { status: 500 }
    );
  }
}
