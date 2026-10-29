import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const analyses = sqliteTable('analyses', {
 id: text('id').primaryKey(), userId: text('user_id').notNull(), name: text('name').notNull(),
 payload: text('payload').notNull(), createdAt: integer('created_at').notNull(),
});
