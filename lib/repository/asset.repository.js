import { db } from '../db/index.ts';
import { assets } from '../db/schema.js';
import { eq, like, or, and, inArray } from 'drizzle-orm';
import { fetchAssetData } from '../services/assetData.service.js';

const ALLOWED_UPDATE_FIELDS = ['name', 'type', 'currentPrice', 'isActive', 'lastUpdated'];

function normalizeTicker(ticker) {
  return String(ticker || '').trim().toUpperCase();
}

/**
 * Buscar asset por ticker
 * @param {string} ticker - Ticker del asset
 * @returns {Promise<Object|null>} Asset encontrado o null
 */
export async function findAssetByTicker(ticker) {
  const result = await db
    .select()
    .from(assets)
    .where(eq(assets.ticker, normalizeTicker(ticker)))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * Buscar varios assets por ticker en una sola consulta
 * @param {string[]} tickers
 * @returns {Promise<Array>}
 */
export async function findAssetsByTickers(tickers) {
  const unique = [...new Set((tickers || []).map(normalizeTicker).filter(Boolean))];
  if (unique.length === 0) return [];

  return await db.select().from(assets).where(inArray(assets.ticker, unique));
}

/**
 * Obtener todos los assets con filtros opcionales
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de assets
 */
export async function findAssets(filters = {}) {
  const { search, type } = filters;
  const conditions = [];

  if (search) {
    conditions.push(or(like(assets.ticker, `%${search}%`), like(assets.name, `%${search}%`)));
  }

  if (type) {
    conditions.push(eq(assets.type, type));
  }

  if (conditions.length > 0) {
    return await db.select().from(assets).where(and(...conditions));
  }

  return await db.select().from(assets);
}

/**
 * Obtener todos los assets (sin filtros)
 * @returns {Promise<Array>} Lista de todos los assets
 */
export async function findAllAssets() {
  return await db.select().from(assets);
}

/**
 * Crear un nuevo asset consultando la API externa para nombre y precio
 * @param {Object} assetData - Datos del asset (requiere ticker y type)
 * @returns {Promise<Object>} Resultado de la inserción
 */
export async function createAsset(assetData) {
  const ticker = normalizeTicker(assetData?.ticker);
  const { type } = assetData || {};

  if (!ticker || !type) {
    throw new Error('Ticker y type son requeridos');
  }

  const externalData = await fetchAssetData(ticker, type);

  return await db.insert(assets).values({
    ticker,
    type,
    name: externalData.name || ticker,
    currentPrice: externalData.currentPrice || 0,
    lastUpdated: new Date(),
  });
}

/**
 * Actualizar un asset (solo campos permitidos)
 * @param {string} ticker - Ticker del asset
 * @param {Object} updates - Campos a actualizar
 * @returns {Promise<void>}
 */
export async function updateAsset(ticker, updates = {}) {
  const safeUpdates = {};
  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (updates[field] !== undefined) safeUpdates[field] = updates[field];
  }
  safeUpdates.lastUpdated = updates.lastUpdated || new Date();

  await db.update(assets).set(safeUpdates).where(eq(assets.ticker, normalizeTicker(ticker)));
}

/**
 * Eliminar un asset
 * @param {string} ticker - Ticker del asset
 * @returns {Promise<void>}
 */
export async function deleteAsset(ticker) {
  await db.delete(assets).where(eq(assets.ticker, normalizeTicker(ticker)));
}

/**
 * Crear o actualizar asset (upsert)
 * @param {Object} assetData - Datos del asset (requiere ticker y type)
 * @returns {Promise<Object>} Asset creado o actualizado
 */
export async function upsertAsset(assetData) {
  const ticker = normalizeTicker(assetData?.ticker);
  const { type, name, currentPrice, refreshData = false } = assetData || {};

  if (!ticker || !type) {
    throw new Error('Ticker y type son requeridos');
  }

  const existing = await findAssetByTicker(ticker);

  if (!existing) {
    await createAsset({ ticker, type });
    return await findAssetByTicker(ticker);
  }

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

  const updates = { lastUpdated: new Date() };
  if (currentPrice !== undefined) updates.currentPrice = currentPrice;
  if (name) updates.name = name;
  if (type) updates.type = type;

  await updateAsset(ticker, updates);
  return { ...existing, ...updates };
}

/**
 * Marca como activos o inactivos los assets indicados (en una sola sentencia)
 * @param {string[]} tickers
 * @param {boolean} isActive
 */
export async function setAssetsActive(tickers, isActive) {
  const unique = [...new Set((tickers || []).map(normalizeTicker).filter(Boolean))];
  if (unique.length === 0) return;

  await db.update(assets).set({ isActive }).where(inArray(assets.ticker, unique));
}
