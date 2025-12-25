import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import {
  findTransactionById,
  updateTransaction,
  deleteTransaction,
} from '@/lib/repository/transaction.repository';

// GET /api/transactions/[id] - Obtener una transacción específica
export async function GET(request, { params }) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const { id } = await params;
    const transactionId = parseInt(id);

    const transaction = await findTransactionById(transactionId);

    if (!transaction || transaction.userId !== userId) {
      return NextResponse.json(
        { error: 'Transacción no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    return NextResponse.json(
      { error: 'Error al obtener transacción' },
      { status: 500 }
    );
  }
}

// PUT /api/transactions/[id] - Actualizar una transacción
export async function PUT(request, { params }) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const { id } = await params;
    const transactionId = parseInt(id);
    const body = await request.json();

    // Verificar que la transacción pertenece al usuario
    const existing = await findTransactionById(transactionId);

    if (!existing || existing.userId !== userId) {
      return NextResponse.json(
        { error: 'Transacción no encontrada' },
        { status: 404 }
      );
    }

    // Actualizar campos permitidos
    const updateData = {};
    if (body.type !== undefined) updateData.type = body.type;
    if (body.quantity !== undefined) updateData.quantity = body.quantity;
    if (body.pricePerUnit !== undefined) updateData.pricePerUnit = body.pricePerUnit;
    if (body.fees !== undefined) updateData.fees = body.fees;
    if (body.date !== undefined) updateData.date = body.date;

    await updateTransaction(transactionId, updateData);

    return NextResponse.json({
      message: 'Transacción actualizada exitosamente',
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json(
      { error: 'Error al actualizar transacción' },
      { status: 500 }
    );
  }
}

// DELETE /api/transactions/[id] - Eliminar una transacción
export async function DELETE(request, { params }) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const { id } = await params;
    const transactionId = parseInt(id);

    // Verificar que la transacción pertenece al usuario
    const existing = await findTransactionById(transactionId);

    if (!existing || existing.userId !== userId) {
      return NextResponse.json(
        { error: 'Transacción no encontrada' },
        { status: 404 }
      );
    }

    await deleteTransaction(transactionId);

    return NextResponse.json({
      message: 'Transacción eliminada exitosamente',
    });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return NextResponse.json(
      { error: 'Error al eliminar transacción' },
      { status: 500 }
    );
  }
}
