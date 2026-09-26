import { describe, expect, it } from 'vitest'
import {
  extractAttachmentReferences,
  extractTags,
  isValidAttachmentSlug,
  replaceAttachmentUrls,
  resolveAttachmentReferences,
} from './markdown-utils'

describe('extractTags', () => {
  it('handles an unterminated inline-code marker with a mismatched trailing marker', () => {
    expect(extractTags('` #visible ``')).toEqual(['visible'])
  })

  it('does not treat tags in complete inline code or fenced blocks as tags', () => {
    expect(extractTags('`#inline`\n```\n#fenced\n```\n#visible')).toEqual(['visible'])
  })
})

describe('extractAttachmentReferences', () => {
  const idA = '01m1r8923zajxnw9y0dhs6sy8j'
  const idB = '01m1r9qq6zb99ef3cqkjrzrn89'

  it('collects plain and angle-bracket references outside code regions', () => {
    expect(extractAttachmentReferences(
      `![a](/api/files/${idA})\n\n![b](</api/files/${idB} "t">)`,
    )).toEqual([idA, idB])
  })

  it('collects slug-form references alongside id-form references', () => {
    expect(extractAttachmentReferences(
      `![a](/api/files/${idA})\n\n![b](</api/files/screenshot-2 "t">)`,
    )).toEqual([idA, 'screenshot-2'])
  })

  it('collects bare slug tokens in angle-bracket destinations', () => {
    expect(extractAttachmentReferences(
      `![alt](<my-img>) and ![wide](<100px|label>)\n\n[text](<doc-2>)`,
    )).toEqual(['my-img', 'doc-2'])
  })

  it('does not match a slug followed by a dot or glued to a longer token', () => {
    expect(extractAttachmentReferences('![a](/api/files/photo.png)\nsee x/api/files/photo here')).toEqual([])
  })

  it('ignores references inside ordinary fenced code', () => {
    expect(extractAttachmentReferences(
      '```\n![a](/api/files/' + idA + ')\n```\n![b](/api/files/' + idB + ')',
    )).toEqual([idB])
  })

  it('collects references inside md-example fences, which render as live markdown', () => {
    expect(extractAttachmentReferences(
      `~~~~md-example title="Image"\n![a](</api/files/${idA} "a">)\n~~~~`,
    )).toEqual([idA])
  })

  it('keeps stripping nested ordinary code inside an md-example fence', () => {
    expect(extractAttachmentReferences(
      `~~~~md-example\n\`\`\`\n![a](/api/files/${idA})\n\`\`\`\n![b](/api/files/${idB})\n~~~~`,
    )).toEqual([idB])
  })

  it('accepts the markdown-example alias', () => {
    expect(extractAttachmentReferences(
      `~~~markdown-example\n![a](/api/files/${idA})\n~~~`,
    )).toEqual([idA])
  })

  it('does not close an md-example fence on a marker followed by text', () => {
    expect(extractAttachmentReferences(
      `~~~~md-example\n![a](/api/files/${idA})\n~~~~ trailing\n![b](/api/files/${idB})`,
    )).toEqual([idB, idA])
  })
})

describe('isValidAttachmentSlug', () => {
  it('accepts lowercase letters, digits, dashes and underscores', () => {
    expect(isValidAttachmentSlug('a')).toBe(true)
    expect(isValidAttachmentSlug('photo-2_final')).toBe(true)
    expect(isValidAttachmentSlug('a'.repeat(64))).toBe(true)
  })

  it('rejects invalid shapes and 26-char id lookalikes', () => {
    expect(isValidAttachmentSlug('Photo')).toBe(false)
    expect(isValidAttachmentSlug('photo.png')).toBe(false)
    expect(isValidAttachmentSlug('-photo')).toBe(false)
    expect(isValidAttachmentSlug('a'.repeat(65))).toBe(false)
    expect(isValidAttachmentSlug('01m1r8923zajxnw9y0dhs6sy8j')).toBe(false)
    expect(isValidAttachmentSlug('')).toBe(false)
    expect(isValidAttachmentSlug(7)).toBe(false)
  })
})

describe('replaceAttachmentUrls', () => {
  const idA = '01m1r8923zajxnw9y0dhs6sy8j'

  it('rewrites plain and angle-bracket references and leaves other tokens untouched', () => {
    expect(replaceAttachmentUrls(
      `![a](/api/files/photo) and ![b](</api/files/photo "t">)`,
      'photo',
      idA,
    )).toBe(`![a](/api/files/${idA}) and ![b](</api/files/${idA} "t">)`)
  })

  it('does not replace longer tokens that contain the from-token as a prefix', () => {
    expect(replaceAttachmentUrls('![a](/api/files/photo-2)', 'photo', idA))
      .toBe('![a](/api/files/photo-2)')
  })

  it('skips fenced code, inline code and front matter', () => {
    const content = [
      '---',
      'x: /api/files/photo',
      '---',
      '`/api/files/photo` stays',
      '```',
      '/api/files/photo stays',
      '```',
      '/api/files/photo goes',
    ].join('\n')
    expect(replaceAttachmentUrls(content, 'photo', idA)).toBe(content.replace(
      '/api/files/photo goes',
      `/api/files/${idA} goes`,
    ))
  })

  it('clears a slug back to the id form', () => {
    expect(replaceAttachmentUrls('![a](/api/files/photo)', 'photo', idA))
      .toBe(`![a](/api/files/${idA})`)
  })

  it('rewrites bare slug tokens to the new slug and leaves the rest of the line untouched', () => {
    expect(replaceAttachmentUrls('![100px|wide](<photo>) trailing', 'photo', 'new-name'))
      .toBe('![100px|wide](<new-name>) trailing')
  })

  it('clears a bare slug token back to the id form', () => {
    expect(replaceAttachmentUrls('![a](<photo>)', 'photo', idA))
      .toBe(`![a](</api/files/${idA}>)`)
  })

  it('leaves references alone when the from token is neither a slug nor an id', () => {
    expect(replaceAttachmentUrls('![a](/api/files/not+a+slug)', 'not+a+slug', 'photo'))
      .toBe('![a](/api/files/not+a+slug)')
  })

  it('rewrites id references to the slug form when a slug is assigned', () => {
    expect(replaceAttachmentUrls(`![a](/api/files/${idA}) and ![b](</api/files/${idA}>)`, idA, 'photo'))
      .toBe('![a](/api/files/photo) and ![b](</api/files/photo>)')
  })

  it('skips bare slug tokens inside fenced code and inline code', () => {
    expect(replaceAttachmentUrls('```\n![a](<photo>)\n```\n`![b](<photo>)`\n![c](<photo>)', 'photo', 'next'))
      .toBe('```\n![a](<photo>)\n```\n`![b](<photo>)`\n![c](<next>)')
  })
})

describe('resolveAttachmentReferences', () => {
  const idA = '01m1r8923zajxnw9y0dhs6sy8j'

  it('resolves bare slug tokens and slug urls to the id url', () => {
    const { content, unresolved } = resolveAttachmentReferences(
      `![a](<photo>)\n\n![b](</api/files/photo>)\n\n![c](</api/files/${idA}>)`,
      (slug) => (slug === 'photo' ? idA : null),
    )
    expect(content).toBe(
      `![a](</api/files/${idA}>)\n\n![b](</api/files/${idA}>)\n\n![c](</api/files/${idA}>)`,
    )
    expect([...unresolved]).toEqual([])
  })

  it('leaves unresolved slugs and id urls untouched and reports them', () => {
    const { content, unresolved } = resolveAttachmentReferences(
      `![a](<missing>)\n\n![c](/api/files/${idA})`,
      () => null,
    )
    expect(content).toBe(`![a](<missing>)\n\n![c](/api/files/${idA})`)
    expect([...unresolved]).toEqual(['missing'])
  })

  it('resolves references inside md-example fences but not ordinary fences or inline code', () => {
    const { content } = resolveAttachmentReferences(
      [
        '~~~md-example',
        '![a](<photo>)',
        '```',
        '![b](<photo>)',
        '```',
        '~~~',
        '```',
        '![c](<photo>)',
        '```',
        '`![d](<photo>)`',
        '![e](<photo>)',
      ].join('\n'),
      () => idA,
    )
    expect(content).toBe([
      '~~~md-example',
      `![a](</api/files/${idA}>)`,
      '```',
      '![b](<photo>)',
      '```',
      '~~~',
      '```',
      '![c](<photo>)',
      '```',
      '`![d](<photo>)`',
      `![e](</api/files/${idA}>)`,
    ].join('\n'))
  })
})
