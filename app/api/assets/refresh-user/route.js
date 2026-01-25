import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { findAllUserTransactions } from '@/lib/repository/transaction.repository';
import { findAssetByTicker } from '@/lib/repository/asset.repository';
import { fetchAssetData } from '@/lib/services/assetData.service';
import { shouldUpdateAsset, getMarketStatus } from '@/lib/utils/marketHours';
import { db } from '@/lib/db/index.ts';
import { assets } from '@/lib/db/schema.js';
import { eq } from 'drizzle-orm';

export async function POST(request) {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Obtener todas las transacciones del usuario
    const userTransactions = await findAllUserTransactions(userId);

    // Obtener lista única de tickers del usuario
    const userTickers = [...new Set(userTransactions.map(tx => tx.assetTicker))];
    
    // Siempre incluir EURUSD (divisa principal)
    if (!userTickers.includes('EURUSD')) {
      userTickers.push('EURUSD');
    }

    if (userTickers.length === 0) {
      return NextResponse.json({ 
        message: 'No hay assets para actualizar',
        updated: 0 
      });
    }

    // Verificar estado del mercado
    const marketStatus = getMarketStatus();
    console.log(`Estado del mercado: ${marketStatus.message} (${marketStatus.etTime})`);

    // Actualizar cada asset del usuario (stocks, crypto y forex)
    const updatePromises = userTickers.map(async (ticker) => {
      try {
        const asset = await findAssetByTicker(ticker);
        if (!asset) {
          console.warn(`Asset ${ticker} no encontrado en la base de datos`);
          return { ticker, success: false, reason: 'not_found' };
        }

        // Verificar si el asset está activo
        if (asset.isActive === false) {
          console.log(`⏭️ ${ticker} omitido - asset desactivado (isActive=false)`);
          return { ticker, success: false, reason: 'inactive', type: asset.type };
        }

        // Verificar si el asset debe actualizarse según el horario de mercado
        if (!shouldUpdateAsset(asset.type)) {
          console.log(`⏭️ ${ticker} (${asset.type}) omitido - mercado cerrado`);
          return { ticker, success: false, reason: 'market_closed', type: asset.type };
        }

        // Obtener datos actualizados de la API externa (funciona para STOCK, CRYPTO y FIAT)
        const externalData = await fetchAssetData(ticker, asset.type);

        // Actualizar el asset en la base de datos
        await db
          .update(assets)
          .set({
            currentPrice: externalData.currentPrice, // Mantener precisión completa
            lastUpdated: new Date(),
          })
          .where(eq(assets.ticker, ticker));

        return { ticker, success: true, type: asset.type };
      } catch (error) {
        console.error(`Error actualizando ${ticker}:`, error);
        return { ticker, success: false, reason: error.message };
      }
    });

    const results = await Promise.all(updatePromises);
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const skippedMarket = results.filter(r => r.reason === 'market_closed');
    const skippedInactive = results.filter(r => r.reason === 'inactive');

    // Separar por tipo para el log
    const cryptos = successful.filter(r => r.type === 'CRYPTO');
    const stocks = successful.filter(r => r.type === 'STOCK' || r.type === 'FIAT');

    // Log de estadísticas de API
    console.log('=== API Usage Stats (refresh-user) ===');
    console.log(`User ID: ${userId}`);
    console.log(`Twelve Data: ${stocks.length} consulta(s) - Tickers: [${stocks.map(r => r.ticker).join(', ')}]`);
    console.log(`CoinGecko: ${cryptos.length} consulta(s) - Tickers: [${cryptos.map(r => r.ticker).join(', ')}]`);
    console.log(`Total assets actualizados: ${successful.length}`);
    if (skippedInactive.length > 0) {
      console.log(`Assets omitidos (desactivados): ${skippedInactive.length} - [${skippedInactive.map(r => r.ticker).join(', ')}]`);
    }
    if (skippedMarket.length > 0) {
      console.log(`Assets omitidos (mercado cerrado): ${skippedMarket.length} - [${skippedMarket.map(r => r.ticker).join(', ')}]`);
    }
    if (failed.length > 0) {
      const actualErrors = failed.filter(r => r.reason !== 'market_closed' && r.reason !== 'inactive');
      if (actualErrors.length > 0) {
        console.log(`Errores: ${actualErrors.length} - Tickers: [${actualErrors.map(r => r.ticker).join(', ')}]`);
      }
    }
    console.log('=======================================');

    return NextResponse.json({
      message: `Actualización completada`,
      marketStatus: marketStatus.message,
      total: userTickers.length,
      updated: successful.length,
      skipped: skippedMarket.length + skippedInactive.length,
      failed: failed.filter(r => r.reason !== 'market_closed' && r.reason !== 'inactive').length,
      failures: failed.length > 0 ? failed : undefined,
    });
  } catch (error) {
    console.error('Error al actualizar assets del usuario:', error);
    return NextResponse.json(
      { error: 'Error al actualizar assets', details: error.message },
      { status: 500 }
    );
  }
}
