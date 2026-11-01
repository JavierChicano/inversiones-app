import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/request';
import { findAssetByTicker, updateAsset } from '@/lib/repository/asset.repository';
import { jsonError, readJsonBody } from '@/lib/api/http';
import { normalizeTicker, toFiniteNumber } from '@/lib/validation/common';

async function resolveTicker(params) {
  const { ticker } = await params;
  return normalizeTicker(decodeURIComponent(ticker || ''));
}

/** GET /api/assets/[ticker] — datos actuales de un asset (precio, nombre, tipo) */
export async function GET(request, { params }) {
  try {
    const auth = requireUser(request);
    if (auth.error) return auth.error;

    const ticker = await resolveTicker(params);
    if (!ticker) return jsonError('Ticker inválido', 400);

    const asset = await findAssetByTicker(ticker);
    if (!asset) return jsonError('Asset no encontrado', 404);

    return NextResponse.json(asset);
  } catch (error) {
    console.error('Error fetching asset:', error);
    return jsonError('Error al obtener asset', 500);
  }
}

/** PUT /api/assets/[ticker] — corregir manualmente precio y/o nombre de un asset */
export async function PUT(request, { params }) {
  try {
    const auth = requireUser(request);
    if (auth.error) return auth.error;

    const ticker = await resolveTicker(params);
    if (!ticker) return jsonError('Ticker inválido', 400);

    const existing = await findAssetByTicker(ticker);
    if (!existing) return jsonError('Asset no encontrado', 404);

    const body = (await readJsonBody(request)) || {};
    const updateData = {};

    if (body.currentPrice !== undefined) {
      const currentPrice = toFiniteNumber(body.currentPrice);
      if (currentPrice === null || currentPrice <= 0) return jsonError('El precio debe ser positivo', 400);
      updateData.currentPrice = currentPrice;
    }

    if (body.name !== undefined) {
      const name = String(body.name).trim().slice(0, 120);
      if (!name) return jsonError('El nombre no puede estar vacío', 400);
      updateData.name = name;
    }

    if (Object.keys(updateData).length === 0) {
      return jsonError('No hay campos para actualizar', 400);
    }

    await updateAsset(ticker, updateData);

    return NextResponse.json({ message: 'Asset actualizado exitosamente', ticker });
  } catch (error) {
    console.error('Error updating asset:', error);
    return jsonError('Error al actualizar asset', 500);
  }
}
