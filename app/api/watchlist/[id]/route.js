import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/request';
import { deleteWatchlistItem, updateWatchlistItem } from '@/lib/repository/watchlist.repository';
import { jsonError, parsePositiveInt, readJsonBody, validationError } from '@/lib/api/http';
import { validateWatchlistUpdate } from '@/lib/validation/watchlist';

/** DELETE /api/watchlist/[id] */
export async function DELETE(request, { params }) {
  try {
    const auth = requireUser(request);
    if (auth.error) return auth.error;

    const { id } = await params;
    const itemId = parsePositiveInt(id);
    if (!itemId) return jsonError('ID inválido', 400);

    const deleted = await deleteWatchlistItem(itemId, auth.userId);
    if (!deleted) return jsonError('Item no encontrado', 404);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting watchlist item:', error);
    return jsonError('Error al eliminar item de watchlist', 500);
  }
}

/** PATCH /api/watchlist/[id] — actualizar precio objetivo y/o notas */
export async function PATCH(request, { params }) {
  try {
    const auth = requireUser(request);
    if (auth.error) return auth.error;

    const { id } = await params;
    const itemId = parsePositiveInt(id);
    if (!itemId) return jsonError('ID inválido', 400);

    const validation = validateWatchlistUpdate((await readJsonBody(request)) || {});
    if (!validation.ok) return validationError(validation);

    const updated = await updateWatchlistItem(itemId, auth.userId, validation.data);
    if (!updated) return jsonError('Item no encontrado', 404);

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error('Error updating watchlist item:', error);
    return jsonError('Error al actualizar item de watchlist', 500);
  }
}
