import { db } from '../db/index.ts';
import { assets } from '../db/schema.js';
import { eq, like, or, and } from 'drizzle-orm';
import { fetchAssetData } from '../services/assetData.service.js';

/**
 * Buscar asset por ticker
 * @param {string} ticker - Ticker del asset
 * @returns {Promise<Object|null>} Asset encontrado o null
 */
export async function findAssetByTicker(ticker) {
  try {
    const result = await db
      .select()
      .from(assets)
      .where(eq(assets.ticker, ticker))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Error al buscar asset por ticker:', error);
    throw error;
  }
}

/**
 * Obtener todos los assets con filtros opcionales
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de assets
 */
export async function findAssets(filters = {}) {
  try {
    const { search, type } = filters;
    
    const conditions = [];

    if (search) {
      conditions.push(
        or(
          like(assets.ticker, `%${search}%`),
          like(assets.name, `%${search}%`)
        )
      );
    }

    if (type) {
      conditions.push(eq(assets.type, type));
    }

    let results;
    if (conditions.length > 0) {
      results = await db
        .select()
        .from(assets)
        .where(and(...conditions));
    } else {
      results = await db.select().from(assets);
    }

    return results;
  } catch (error) {
    console.error('Error al buscar assets:', error);
    throw error;
  }
}

/**
 * Obtener todos los assets (sin filtros)
 * @returns {Promise<Array>} Lista de todos los assets
 */
export async function findAllAssets() {
  try {
    const results = await db.select().from(assets);
    return results;
  } catch (error) {
    console.error('Error al obtener todos los assets:', error);
    throw error;
  }
}

/**
 * Crear un nuevo asset
 * @param {Object} assetData - Datos del asset (requiere ticker y type)
 * @returns {Promise<Object>} Resultado de la inserción
 */
export async function createAsset(assetData) {
  try {
    const { ticker, type } = assetData;

    if (!ticker || !type) {
      throw new Error('Ticker y type son requeridos');
    }

    // Obtener datos desde API externa
    const externalData = await fetchAssetData(ticker, type);

    const result = await db.insert(assets).values({
      ticker: ticker.toUpperCase(),
      type,
      name: externalData.name || ticker,
      currentPrice: externalData.currentPrice || 0,
      lastUpdated: new Date(),
    });

    return result;
  } catch (error) {
    console.error('Error al crear asset:', error);
    throw error;
  }
}

/**
 * Actualizar un asset
 * @param {string} ticker - Ticker del asset
 * @param {Object} updates - Campos a actualizar
 * @returns {Promise<void>}
 */
export async function updateAsset(ticker, updates) {
  try {
    // Asegurar que lastUpdated se actualice
    updates.lastUpdated = new Date();

    await db
      .update(assets)
      .set(updates)
      .where(eq(assets.ticker, ticker));
  } catch (error) {
    console.error('Error al actualizar asset:', error);
    throw error;
  }
}

/**
 * Eliminar un asset
 * @param {string} ticker - Ticker del asset
 * @returns {Promise<void>}
 */
export async function deleteAsset(ticker) {
  try {
    await db
      .delete(assets)
      .where(eq(assets.ticker, ticker));
  } catch (error) {
    console.error('Error al eliminar asset:', error);
    throw error;
  }
}

/**
 * Crear o actualizar asset (upsert)
 * @param {Object} assetData - Datos del asset (requiere ticker y type)
 * @returns {Promise<Object>} Asset creado o actualizado
 */
export async function upsertAsset(assetData) {
  try {
    const { ticker, type, name, currentPrice, refreshData = false } = assetData;
    
    if (!ticker || !type) {
      throw new Error('Ticker y type son requeridos');
    }

    const existing = await findAssetByTicker(ticker);

    if (existing) {
      // Si refreshData es true, obtener datos actualizados de la API
      if (refreshData) {
        const externalData = await fetchAssetData(ticker, type);
        const updates = {
          currentPrice: externalData.currentPrice || existing.currentPrice,
          name: externalData.name || existing.name,
          lastUpdated: new Date(),
        };
        await updateAsset(ticker, updates);
        return { ...existing, ...updates };
      }
      
      // Actualizar solo los campos proporcionados manualmente
      const updates = {
        lastUpdated: new Date(),
      };
      
      if (currentPrice !== undefined) updates.currentPrice = currentPrice;
      if (name) updates.name = name;
      if (type) updates.type = type;

      await updateAsset(ticker, updates);
      return { ...existing, ...updates };
    } else {
      // Crear nuevo consultando API externa
      await createAsset({ ticker, type });
      return await findAssetByTicker(ticker);
    }
  } catch (error) {
    console.error('Error en upsert de asset:', error);
    throw error;
  }
}
