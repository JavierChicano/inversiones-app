import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { findTransactionsByUser, createTransaction } from '@/lib/repository/transaction.repository';
import { findAllAssets, findAssetByTicker, upsertAsset } from '@/lib/repository/asset.repository';

// GET /api/transactions - Obtener todas las transacciones del usuario
export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Parámetros de consulta opcionales
    const { searchParams } = new URL(request.url);
    const filters = {
      ticker: searchParams.get('ticker'),
      type: searchParams.get('type'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      limit: parseInt(searchParams.get('limit') || '100'),
      offset: parseInt(searchParams.get('offset') || '0'),
    };

    const results = await findTransactionsByUser(userId, filters);

    // Obtener información de los assets
    const assetTickers = [...new Set(results.map(t => t.assetTicker))];
    const allAssets = await findAllAssets();
    const assetInfo = allAssets.filter(a => assetTickers.includes(a.ticker));

    // Enriquecer resultados con info de assets
    const enrichedResults = results.map(tx => ({
      ...tx,
      asset: assetInfo.find(a => a.ticker === tx.assetTicker),
    }));

    return NextResponse.json({
      transactions: enrichedResults,
      total: results.length,
      limit: filters.limit,
      offset: filters.offset,
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Error al obtener transacciones' },
      { status: 500 }
    );
  }
}

// POST /api/transactions - Crear nueva transacción
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const body = await request.json();

    const {
      ticker,
      type, // BUY o SELL
      assetType, // STOCK o CRYPTO
      quantity,
      pricePerUnit,
      fees = 0,
      date,
      notes = '',
    } = body;

    // Validaciones
    if (!ticker || !type || !quantity || !pricePerUnit || !date) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    if (type !== 'BUY' && type !== 'SELL') {
      return NextResponse.json(
        { error: 'Tipo de transacción inválido' },
        { status: 400 }
      );
    }

    if (quantity <= 0 || pricePerUnit <= 0) {
      return NextResponse.json(
        { error: 'Cantidad y precio deben ser positivos' },
        { status: 400 }
      );
    }
    
    const existingAsset = await findAssetByTicker(ticker);

    if (!existingAsset) {
      // Crear asset consultando API externa
      await upsertAsset({
        ticker: ticker,
        type: assetType || 'STOCK', // Usar el tipo proporcionado o STOCK por defecto
      });
    }

    // Crear transacción
    const result = await createTransaction({
      userId,
      assetTicker: ticker,
      type,
      quantity,
      pricePerUnit,
      fees,
      date,
      notes,
    });

    return NextResponse.json(
      {
        message: 'Transacción creada exitosamente',
        transactionId: result.lastInsertRowid ? Number(result.lastInsertRowid) : null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json(
      { error: 'Error al crear transacción' },
      { status: 500 }
    );
  }
}
