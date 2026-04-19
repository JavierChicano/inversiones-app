import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { deleteWatchlistItem, updateWatchlistItem } from '@/lib/repository/watchlist.repository';

export async function DELETE(request, { params }) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const { id } = await params;
    const itemId = Number(id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    await deleteWatchlistItem(itemId, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting watchlist item:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Error al eliminar item de watchlist' },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const { id } = await params;
    const itemId = Number(id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json();
    const { targetPrice, notes } = body;

    const updated = await updateWatchlistItem(itemId, userId, {
      targetPrice: targetPrice !== undefined ? targetPrice : undefined,
      notes: notes !== undefined ? notes : undefined,
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error('Error updating watchlist item:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Error al actualizar item de watchlist' },
      { status: 500 }
    );
  }
}
