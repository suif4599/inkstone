import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'
import { attachmentReferenceAt, completeCodeFenceOnEnter } from './commands'

function runFenceCompletion(doc: string, cursor = doc.length) {
  const state = EditorState.create({ doc, selection: EditorSelection.cursor(cursor) })
  let next = state
  const handled = completeCodeFenceOnEnter({ state, dispatch: (transaction) => { next = transaction.state } })
  return { handled, state: next }
}

describe('completeCodeFenceOnEnter', () => {
  it('adds a closing fence and places the cursor inside a new code block', () => {
    const result = runFenceCompletion('```ts')

    expect(result.handled).toBe(true)
    expect(result.state.doc.toString()).toBe('```ts\n\n```')
    expect(result.state.selection.main.head).toBe(6)
  })

  it('does not add another fence when Enter is pressed on a closing fence', () => {
    const result = runFenceCompletion('```\nconsole.log(1)\n```')
    expect(result.handled).toBe(false)
    expect(result.state.doc.toString()).toBe('```\nconsole.log(1)\n```')
  })
})

const hosts: HTMLElement[] = []

function pressRenameKey(doc: string, cursor: number): { handled: boolean; token: string | null } {
  let captured: { token: string } | undefined
  const host = document.createElement('div')
  document.body.appendChild(host)
  hosts.push(host)
  const view = new EditorView({
    state: EditorState.create({
      doc,
      selection: EditorSelection.cursor(cursor),
      extensions: [keymap.of([{
        key: 'Alt-r',
        run: (target) => {
          const reference = attachmentReferenceAt(target.state)
          if (!reference) return false
          captured = { token: reference.token }
          return true
        },
      }])],
    }),
    parent: host,
  })
  const unhandled = view.contentDOM.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'r', altKey: true, bubbles: true, cancelable: true }),
  )
  view.destroy()
  return { handled: !unhandled, token: captured?.token ?? null }
}

afterEach(() => {
  for (const host of hosts.splice(0)) host.remove()
})

describe('attachmentReferenceAt via Alt+R keypress', () => {
  const idA = '01m1r8923zajxnw9y0dhs6sy8j'

  it('fires when the cursor is on the alt text of a slug token image', () => {
    const doc = '![100px|.a wide image](<test-black-white>)'
    expect(pressRenameKey(doc, 8)).toEqual({ handled: true, token: 'test-black-white' })
  })

  it('fires when the cursor is on the bang or the closing paren of a slug token image', () => {
    const doc = '![alt](<my-img>)'
    expect(pressRenameKey(doc, 0)).toEqual({ handled: true, token: 'my-img' })
    expect(pressRenameKey(doc, doc.length)).toEqual({ handled: true, token: 'my-img' })
  })

  it('fires when the cursor is on the alt text of a legacy slug url image', () => {
    const doc = '![100px|.a wide image](</api/files/test-black-white>)'
    expect(pressRenameKey(doc, 20)).toEqual({ handled: true, token: 'test-black-white' })
  })

  it('fires when the cursor is inside a bare attachment url', () => {
    const doc = `see /api/files/${idA} here`
    expect(pressRenameKey(doc, 18)).toEqual({ handled: true, token: idA })
  })

  it('does not fire on plain text or non-attachment links', () => {
    const doc = 'plain text and [a link](<https://example.com>)'
    expect(pressRenameKey(doc, 3)).toEqual({ handled: false, token: null })
    expect(pressRenameKey(doc, 20)).toEqual({ handled: false, token: null })
  })
})
