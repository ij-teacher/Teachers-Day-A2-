import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';
export const visits = sqliteTable('visits', {
 id:text('id').primaryKey(), studentId:text('student_id').notNull(), createdAt:text('created_at').notNull(), tokenHash:text('token_hash').notNull()
}, t=>[index('idx_visits_student_created').on(t.studentId,t.createdAt),index('idx_visits_created_id').on(t.createdAt,t.id)]);
export const completions=sqliteTable('completions',{
 visitId:text('visit_id').notNull().references(()=>visits.id,{onDelete:'cascade'}), activity:text('activity').notNull(),
 score:integer('score').notNull(),total:integer('total').notNull(),answersJson:text('answers_json').notNull(),writingJson:text('writing_json').notNull(),completedAt:text('completed_at').notNull()
},t=>[primaryKey({columns:[t.visitId,t.activity]})]);
