import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/request';
import {
  findTransactionById,
  updateTransaction,
  deleteTransaction,
} from '@/lib/repository/transaction.repository';
import { jsonError, parsePositiveInt, readJsonBody, validationError } from '@/lib/api/http';
import { validateTransactionUpdate } from '@/lib/validation/transaction';

async function loadOwnedTransaction(request, params) {
  const auth = requireUser(request);
  if (auth.error) return { error: auth.error };

  const { id } = await params;
  const transactionId = parsePositiveInt(id);
  if (!transactionId) {
    return { error: jsonError('ID inválido', 400) };
  }

  const transaction = await findTransactionById(transactionId);
  if (!transaction || transaction.userId !== auth.userId) {
    return { error: jsonError('Transacción no encontrada', 404) };
  }

  return { userId: auth.userId, transaction };
}

// GET /api/transactions/[id] - Obtener una transacción específica
export async function GET(request, { params }) {
  try {
    const result = await loadOwnedTransaction(request, params);
    if (result.error) return result.error;

    return NextResponse.json(result.transaction);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    return jsonError('Error al obtener transacción', 500);
  }
}

// PUT /api/transactions/[id] - Actualizar una transacción
export async function PUT(request, { params }) {
  try {
    const result = await loadOwnedTransaction(request, params);
    if (result.error) return result.error;

    const validation = validateTransactionUpdate((await readJsonBody(request)) || {});
    if (!validation.ok) return validationError(validation);

    await updateTransaction(result.transaction.id, validation.data);

    return NextResponse.json({ message: 'Transacción actualizada exitosamente' });
  } catch (error) {
    console.error('Error updating transaction:', error);
    return jsonError('Error al actualizar transacción', 500);
  }
}

// DELETE /api/transactions/[id] - Eliminar una transacción
export async function DELETE(request, { params }) {
  try {
    const result = await loadOwnedTransaction(request, params);
    if (result.error) return result.error;

    await deleteTransaction(result.transaction.id);

    return NextResponse.json({ message: 'Transacción eliminada exitosamente' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return jsonError('Error al eliminar transacción', 500);
  }
}
