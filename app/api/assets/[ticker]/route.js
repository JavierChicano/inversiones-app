import { NextResponse } from 'next/server';
import {
  findAssetByTicker,
  updateAsset,
  deleteAsset,
} from '@/lib/repository/asset.repository';

// PUT /api/assets/[ticker] - Actualizar precio de un asset
export async function PUT(request, { params }) {
  try {
    const ticker = params.ticker;
    const body = await request.json();
    const { currentPrice, name, logoUrl } = body;

    const existing = await findAssetByTicker(ticker);

    if (!existing) {
      return NextResponse.json(
        { error: 'Asset no encontrado' },
        { status: 404 }
      );
    }

    const updateData = {};

    if (currentPrice !== undefined) {
      updateData.currentPrice = parseFloat(currentPrice);
    }
    if (name !== undefined) {
      updateData.name = name;
    }
    if (logoUrl !== undefined) {
      updateData.logoUrl = logoUrl;
    }

    await updateAsset(ticker, updateData);

    return NextResponse.json({
      message: 'Asset actualizado exitosamente',
      ticker,
    });
  } catch (error) {
    console.error('Error updating asset:', error);
    return NextResponse.json(
      { error: 'Error al actualizar asset' },
      { status: 500 }
    );
  }
}

// DELETE /api/assets/[ticker] - Eliminar un asset
export async function DELETE(request, { params }) {
  try {
    const ticker = params.ticker;

    await deleteAsset(ticker);

    return NextResponse.json({
      message: 'Asset eliminado exitosamente',
    });
  } catch (error) {
    console.error('Error deleting asset:', error);
    return NextResponse.json(
      { error: 'Error al eliminar asset' },
      { status: 500 }
    );
  }
}
