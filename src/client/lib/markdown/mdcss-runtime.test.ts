import { describe, expect, it } from 'vitest'
import './mdcss-runtime.js'

describe('mdcss runtime', () => {
  it('boots without a DOM-ready document throwing', () => {
    expect(document.body).not.toBeNull()
  })

  it('leaves effect images untouched under the light theme', async () => {
    document.documentElement.dataset.theme = 'light'
    const image = document.createElement('img')
    image.className = 'mdcss-bright'
    image.setAttribute('src', 'a.png')
    document.body.appendChild(image)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(image.getAttribute('src')).toBe('a.png')
    expect(image.dataset.mdcssFx).toBeUndefined()
    image.remove()
    delete document.documentElement.dataset.theme
  })
})
