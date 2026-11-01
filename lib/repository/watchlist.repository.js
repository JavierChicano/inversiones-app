import { db } from '@/lib/db/index';
import { watchlist } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function findAllWatchlistByUser(userId) {
  return await db
    .select()
    .from(watchlist)
    .where(eq(watchlist.userId, userId))
    .orderBy(desc(watchlist.addedAt), desc(watchlist.id));
}

export async function createWatchlistItem(data) {
  const result = await db
    .insert(watchlist)
    .values({ ...data, addedAt: data.addedAt || new Date() })
    .returning();
  return result[0];
}

/** @returns {Promise<Object|null>} Item eliminado o null si no existía / no era del usuario */
export async function deleteWatchlistItem(id, userId) {
  const result = await db
    .delete(watchlist)
    .where(and(eq(watchlist.id, id), eq(watchlist.userId, userId)))
    .returning();
  return result[0] || null;
}

/** @returns {Promise<Object|null>} Item actualizado o null si no existía / no era del usuario */
export async function updateWatchlistItem(id, userId, data) {
  const result = await db
    .update(watchlist)
    .set(data)
    .where(and(eq(watchlist.id, id), eq(watchlist.userId, userId)))
    .returning();
  return result[0] || null;
}

/** Tickers distintos presentes en cualquier watchlist (para mantenerlos activos en el cron) */
export async function findAllWatchlistTickers() {
  const rows = await db.selectDistinct({ ticker: watchlist.assetTicker }).from(watchlist);
  return rows.map((row) => row.ticker);
}
