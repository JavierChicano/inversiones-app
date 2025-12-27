import { db } from '@/lib/db/index';
import { watchlist } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function findAllWatchlistByUser(userId) {
  return await db.select().from(watchlist).where(eq(watchlist.userId, userId));
}

export async function createWatchlistItem(data) {
  const result = await db.insert(watchlist).values(data).returning();
  return result[0];
}

export async function deleteWatchlistItem(id, userId) {
  return await db
    .delete(watchlist)
    .where(and(eq(watchlist.id, id), eq(watchlist.userId, userId)));
}

export async function updateWatchlistItem(id, userId, data) {
  return await db
    .update(watchlist)
    .set(data)
    .where(and(eq(watchlist.id, id), eq(watchlist.userId, userId)))
    .returning();
}
