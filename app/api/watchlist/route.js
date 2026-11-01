import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/request';
import { findAllWatchlistByUser, createWatchlistItem } from '@/lib/repository/watchlist.repository';
import { findAssetByTicker, findAssetsByTickers, upsertAsset } from '@/lib/repository/asset.repository';
import { jsonError, readJsonBody, validationError } from '@/lib/api/http';
import { validateNewWatchlistItem } from '@/lib/validation/watchlist';

/**
 * GET /api/watchlist — activos en seguimiento enriquecidos con precio actual y estado del objetivo
 */
export async function GET(request) {
  try {
    const auth = requireUser(request);
    if (auth.error) return auth.error;

    const userWatchlist = await findAllWatchlistByUser(auth.userId);
    const assetRows = await findAssetsByTickers(userWatchlist.map((item) => item.assetTicker));
    const assetMap = new Map(assetRows.map((asset) => [asset.ticker, asset]));

    const watchlist = userWatchlist.map((item) => {
      const asset = assetMap.get(item.assetTicker);
      const currentPrice = asset?.currentPrice || 0;
      const targetPrice = item.targetPrice || 0;

      return {
        ...item,
        currentPrice,
        name: asset?.name || item.assetTicker,
        type: asset?.type || 'STOCK',
        lastUpdated: asset?.lastUpdated ?? null,
        priceVsTarget: targetPrice > 0 ? ((targetPrice - currentPrice) / targetPrice) * 100 : null,
        targetReached: targetPrice > 0 ? currentPrice <= targetPrice : false,
      };
    });

    return NextResponse.json({ watchlist });
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    return jsonError('Error al obtener watchlist', 500);
  }
}

/**
 * POST /api/watchlist — añadir un activo (crea el asset si no existe)
 * Body: { assetTicker, targetPrice?, notes?, assetType? }
 */
export async function POST(request) {
  try {
    const auth = requireUser(request);
    if (auth.error) return auth.error;

    const validation = validateNewWatchlistItem((await readJsonBody(request)) || {});
    if (!validation.ok) return validationError(validation);

    const { assetTicker, assetType, targetPrice, notes } = validation.data;

    const asset = await findAssetByTicker(assetTicker);
    if (!asset) {
      await upsertAsset({ ticker: assetTicker, type: assetType });
    }

    const newItem = await createWatchlistItem({
      userId: auth.userId,
      assetTicker,
      targetPrice,
      notes,
    });

    return NextResponse.json({ item: newItem }, { status: 201 });
  } catch (error) {
    console.error('Error creating watchlist item:', error);
    return jsonError('Error al agregar asset a watchlist', 500);
  }
}
