import { replaceAttachmentUrls } from '@shared/markdown-utils'
import { useAttachmentSlugs } from '../../store/attachment-slugs'
import { useNotes } from '../../store/notes'

export async function applyAttachmentRename(from: string, to: string): Promise<boolean> {
  let refreshed = true
  try {
    await useNotes.getState().pull({ force: true })
  } catch {
    refreshed = false
  }
  const state = useNotes.getState()
  for (const [id, content] of Object.entries(state.contents)) {
    const rewritten = replaceAttachmentUrls(content, from, to)
    if (rewritten !== content) state.editContent(id, rewritten)
  }
  void useAttachmentSlugs.getState().refresh().catch(() => {})
  return refreshed
}
