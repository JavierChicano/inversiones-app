import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { findAllWatchlistByUser, createWatchlistItem, deleteWatchlistItem } from '@/lib/repository/watchlist.repository';
import { findAllAssets, findAssetByTicker, upsertAsset } from '@/lib/repository/asset.repository';
import { fetchAssetData } from '@/lib/services/assetData.service';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    console.log("1. Header completo:", authHeader);
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Obtener watchlist del usuario
    const userWatchlist = await findAllWatchlistByUser(userId);

    // Obtener precios actuales de assets
    const assetPrices = await findAllAssets();
    const priceMap = assetPrices.reduce((acc, asset) => {
      acc[asset.ticker] = {
        currentPrice: asset.currentPrice || 0,
        name: asset.name || asset.ticker,
        type: asset.type || 'STOCK',
        lastUpdated: asset.lastUpdated,
      };
      return acc;
    }, {});

    // Enriquecer watchlist con datos actuales
    const enrichedWatchlist = userWatchlist.map(item => {
      const assetData = priceMap[item.assetTicker] || {};
      const currentPrice = assetData.currentPrice || 0;
      const targetPrice = item.targetPrice || 0;

      return {
        ...item,
        currentPrice,
        name: assetData.name,
        type: assetData.type,
        lastUpdated: assetData.lastUpdated,
        priceVsTarget: targetPrice > 0 ? ((targetPrice - currentPrice) / targetPrice) * 100 : null,
        targetReached: targetPrice > 0 ? currentPrice <= targetPrice : false,
      };
    });

    return NextResponse.json({ watchlist: enrichedWatchlist });
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Error al obtener watchlist' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
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

    const body = await request.json();
    const { assetTicker, targetPrice, notes } = body;

    if (!assetTicker) {
      return NextResponse.json({ error: 'Ticker requerido' }, { status: 400 });
    }

    // Verificar si el asset existe, si no, crearlo
    let asset = await findAssetByTicker(assetTicker);
    
    if (!asset) {
      // Determinar el tipo del asset (STOCK o CRYPTO)
      // Asumimos STOCK por defecto, pero podrías mejorar esto con una API o validación
      const assetType = assetTicker.match(/^(BTC|ETH|USDT|BNB|SOL|ADA|DOGE|XRP|DOT|UNI)$/i) ? 'CRYPTO' : 'STOCK';
      
      try {
        // Obtener datos actuales del asset
        const assetData = await fetchAssetData(assetTicker, assetType);
        
        // Crear el asset en la base de datos
        await upsertAsset({
          ticker: assetTicker,
          type: assetType,
          name: assetData.name || assetTicker,
          currentPrice: assetData.currentPrice || 0,
          lastUpdated: new Date(),
        });
        
        console.log(`Asset ${assetTicker} creado exitosamente`);
      } catch (error) {
        console.error(`Error al crear asset ${assetTicker}:`, error);
        // Si falla la API, crear el asset con datos básicos
        await upsertAsset({
          ticker: assetTicker,
          type: assetType,
          name: assetTicker,
          currentPrice: 0,
          lastUpdated: new Date(),
        });
      }
    }

    const newItem = await createWatchlistItem({
      userId,
      assetTicker,
      targetPrice: targetPrice || null,
      notes: notes || null,
    });

    return NextResponse.json({ item: newItem }, { status: 201 });
  } catch (error) {
    console.error('Error creating watchlist item:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Error al agregar asset a watchlist' },
      { status: 500 }
    );
  }
}
