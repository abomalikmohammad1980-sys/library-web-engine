import { strict as assert } from 'node:assert'
import { describe, it } from 'vitest'
import { quoteCardSvg } from './quote_card'

describe('quote card', () => {
  it('keeps attribution fixed and escapes user text', () => {
    const svg = quoteCardSvg({ quote: 'العلم < أمانة & عمل', book: 'كتاب <واحد>', author: 'مؤلف', page: 12 })
    assert.match(svg, /العلم &lt; أمانة &amp; عمل/); assert.match(svg, /كتاب &lt;واحد&gt; — مؤلف · ص 12/); assert.match(svg, /الخِزانة/)
  })
})
