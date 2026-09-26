import { LIMITS } from '@shared/constants'
import { countText, deriveExcerpt, replaceAttachmentUrls } from '@shared/markdown-utils'
import { utf8ByteLength } from '@shared/text-utils'
import { buildNoteDerivedStatements } from '../db/writes'
import { sha256Hex } from '../lib/encoding'
import { newId } from '../lib/id'
import { noteIndexQueueStatement } from '../mcp/ai-search'

const SCAN_PAGE_SIZE = 100

function shiftSqlPlaceholders(sql: string, offset: number): string {
  return sql.replace(/\?(\d+)/g, (_match, value: string) => `?${Number(value) + offset}`)
}

export async function rewriteAttachmentReferences(
  db: D1Database,
  userId: string,
  from: string,
  to: string,
  ftsEnabled: boolean,
): Promise<{ rewritten: number; skipped: number }> {
  const candidateIds: string[] = []
  let afterId = ''
  while (true) {
    const { results } = await db.prepare(
      `SELECT id, content FROM notes
        WHERE user_id = ?1 AND id > ?2 ORDER BY id ASC LIMIT ?3`,
    ).bind(userId, afterId, SCAN_PAGE_SIZE).all<{ id: string; content: string }>()
    if (!results.length) break
    for (const note of results) {
      if (replaceAttachmentUrls(note.content, from, to) !== note.content) candidateIds.push(note.id)
    }
    afterId = results[results.length - 1]!.id
    if (results.length < SCAN_PAGE_SIZE) break
  }

  let rewritten = 0
  let skipped = 0
  for (const candidateId of candidateIds) {
    let complete = false
    for (let attempt = 0; attempt < 5; attempt++) {
      const note = await db.prepare(
        `SELECT id, title, content, content_hash, rev, updated_at, deleted_at
           FROM notes WHERE id = ?1 AND user_id = ?2`,
      ).bind(candidateId, userId).first<{
        id: string
        title: string
        content: string
        content_hash: string
        rev: number
        updated_at: number
        deleted_at: number | null
      }>()
      if (!note || note.deleted_at !== null) {
        complete = true
        break
      }
      const content = replaceAttachmentUrls(note.content, from, to)
      if (content === note.content) {
        complete = true
        break
      }
      const hash = await sha256Hex(content)
      const { words, chars } = countText(content)
      const now = Math.max(Date.now(), note.updated_at + 1)
      const nextRev = note.rev + 1
      const guard = `EXISTS (SELECT 1 FROM notes
        WHERE id = ?1 AND user_id = ?2 AND rev = ?3
          AND content_hash = ?4 AND title = ?5 AND updated_at = ?6)`
      const guardValues = [note.id, userId, nextRev, hash, note.title, now] as const
      const statements: D1PreparedStatement[] = [
        db.prepare(
          `UPDATE notes SET content = ?1, excerpt = ?2, word_count = ?3, char_count = ?4,
             content_hash = ?5, rev = ?6, updated_at = ?7
            WHERE id = ?8 AND user_id = ?9 AND rev = ?10 AND content_hash = ?11`,
        ).bind(content, deriveExcerpt(content), words, chars, hash, nextRev, now,
          note.id, userId, note.rev, note.content_hash),
        db.prepare(
          `INSERT INTO note_versions (id, note_id, user_id, title, content, size, created_at)
           SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7 WHERE ${shiftSqlPlaceholders(guard, 7)}`,
        ).bind(newId(), note.id, userId, note.title, note.content,
          utf8ByteLength(note.content), now, ...guardValues),
        db.prepare(
          `DELETE FROM note_versions WHERE note_id = ?1
             AND ${shiftSqlPlaceholders(guard, 1)}
             AND id IN (SELECT id FROM note_versions WHERE note_id = ?1 ORDER BY created_at DESC, id DESC LIMIT -1 OFFSET ?8)`,
        ).bind(note.id, ...guardValues, LIMITS.versionsPerNote),
      ]
      statements.push(...buildNoteDerivedStatements({
        db,
        userId,
        noteId: note.id,
        title: note.title,
        content,
        ftsEnabled,
        expectedRev: nextRev,
        expectedContentHash: hash,
        expectedTitle: note.title,
        expectedUpdatedAt: now,
      }).statements)
      statements.push(noteIndexQueueStatement(db, userId, note.id, 'embed', now))
      statements.push(
        db.prepare(
          `INSERT INTO changes (user_id, entity, entity_id, op, at)
           SELECT ?1, 'note', ?2, 'upsert', ?3 WHERE ${shiftSqlPlaceholders(guard, 3)}`,
        ).bind(userId, note.id, now, ...guardValues),
      )
      const [updated] = await db.batch(statements)
      if (updated?.meta.changes) {
        rewritten++
        complete = true
        break
      }
    }
    if (!complete) skipped++
  }
  return { rewritten, skipped }
}
