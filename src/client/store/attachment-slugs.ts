import { create } from 'zustand'
import { resolveAttachmentReferences } from '@shared/markdown-utils'
import { api } from '../lib/api'

interface AttachmentSlugState {
  map: Record<string, string>
  status: 'idle' | 'loading' | 'ready' | 'error'
  ensure: () => Promise<void>
  refresh: () => Promise<void>
  resolve: (content: string) => { content: string; unresolved: string[] }
  noteUploaded: (slug: string, id: string) => void
}

const REFRESH_THROTTLE_MS = 5000

let loading: Promise<void> | null = null
let loaded = false
let lastAttemptAt = 0
let refreshTimer: number | null = null
const seenUnresolved = new Set<string>()

function runRefresh(set: (partial: Partial<AttachmentSlugState>) => void): Promise<void> {
  if (loading) return loading
  lastAttemptAt = Date.now()
  set({ status: 'loading' })
  loading = (async () => {
    try {
      const { slugs } = await api.files.slugMap()
      loaded = true
      set({ map: slugs, status: 'ready' })
    } catch {
      set({ status: 'error' })
    } finally {
      loading = null
    }
  })()
  return loading
}

function scheduleRefresh(tokens: ReadonlySet<string>): void {
  if (refreshTimer !== null || loading !== null) return
  if (Date.now() - lastAttemptAt < REFRESH_THROTTLE_MS) return
  let unseen = false
  for (const token of tokens) {
    if (!seenUnresolved.has(token)) {
      unseen = true
      break
    }
  }
  if (!unseen) return
  for (const token of tokens) seenUnresolved.add(token)
  refreshTimer = window.setTimeout(() => {
    refreshTimer = null
    void runRefresh((partial) => useAttachmentSlugs.setState(partial))
  }, 100)
}

export const useAttachmentSlugs = create<AttachmentSlugState>((set, get) => ({
  map: {},
  status: 'idle',
  ensure: async () => {
    if (loaded) return
    await runRefresh(set)
  },
  refresh: async () => {
    await runRefresh(set)
  },
  resolve: (content) => {
    const map = get().map
    const { content: resolved, unresolved } = resolveAttachmentReferences(
      content,
      (slug) => map[slug] ?? null,
    )
    if (unresolved.size) scheduleRefresh(unresolved)
    return { content: resolved, unresolved: [...unresolved] }
  },
  noteUploaded: (slug, id) => {
    set({ map: { ...get().map, [slug]: id } })
  },
}))
