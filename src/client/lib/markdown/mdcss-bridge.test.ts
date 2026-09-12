import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './renderer'

describe('mdcss bridge rendering', () => {
  it('numbers headings with the configured mappers', () => {
    const { html } = renderMarkdown('## .Title')
    expect(html).toContain('一、')
    expect(html).toContain('Title')
  })

  it('parses image width and caption control strings', () => {
    const { html } = renderMarkdown('![50%|.caption](a.png)')
    expect(html).toContain('width: 50% !important')
    expect(html).toContain('mdcss-fig')
    expect(html).toContain('图1:')
    expect(html).toContain('caption')
  })

  it('applies effect classes to images', () => {
    const { html } = renderMarkdown('![50%i](a.png)')
    expect(html).toContain('mdcss-inv')
  })

  it('groups row images with subfigure labels', () => {
    const { html } = renderMarkdown('![25%r|.a](a.png) ![25%r|.b](b.png)')
    expect(html).toContain('mdcss-fig-group')
    expect(html).toContain('(a)')
    expect(html).toContain('(b)')
  })

  it('leaves plain alt text untouched', () => {
    const { html } = renderMarkdown('![An English alt](a.png)')
    expect(html).toContain('alt="An English alt"')
    expect(html).not.toContain('mdcss-')
  })

  it('merges and deletes table cells', () => {
    const { html } = renderMarkdown('| c2: a | \\ |\n| --- | --- |\n| c2: c | \\ |')
    expect(html).toContain('colspan="2"')
    expect(html).not.toContain('<td>\\</td>')
  })

  it('renders table captions with the wrapper div inside the figure', () => {
    const { html } = renderMarkdown('Table: .demo\n\n| a | b |\n| --- | --- |\n| 1 | 2 |')
    expect(html).toContain('表1:')
    expect(html).toContain('table-wrap')
    expect(html.indexOf('<figure')).toBeLessThan(html.indexOf('table-wrap'))
  })

  it('rebuilds column grid styles after sanitization', () => {
    const { html } = renderMarkdown('|||-40\n\nleft\n\n|||\n\nright\n\n-|||')
    expect(html).toContain('display: grid')
    expect(html).toContain('grid-template-columns: minmax(auto, 40%)')
    expect(html).toContain('data-mdcss-col="main"')
    expect(html).toContain('data-mdcss-col="side"')
  })

  it('remaps data-line through column line shifts', () => {
    const { html } = renderMarkdown('|||-40\n\nleft\n\n|||\n\nright\n\n-|||\n\nafter')
    expect(html).toContain('<p data-line="10">after</p>')
  })

  it('appends the invert-brightness filter definition once', () => {
    const { html } = renderMarkdown('# plain')
    expect(html.match(/id="invert-brightness"/g)).toHaveLength(1)
  })

  it('wraps indented documents', () => {
    const { html } = renderMarkdown('@indent\n\nbody')
    expect(html).toContain('has-indent')
  })

  it('leaves fenced code untouched', () => {
    const { html } = renderMarkdown('```\n## .not a heading\n|||-\n```')
    expect(html).not.toContain('一、')
    expect(html).not.toContain('display: grid')
  })
})
