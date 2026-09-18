import { expect, it } from 'vitest'
import { homeQuoteCandidates } from './home_quote_candidates'

it('returns the same eligible passages in the same order as the original pipeline', () => {
  const books = ['a', 'b'].map(id => ({ id, readerModel: { paragraphs: Array.from({ length: 80 }, (_, i) => ({ text: i % 3 ? `${i}  ${'علم '.repeat(22)}` : 'قصير' })) } }))
  const original = books.flatMap(book => book.readerModel.paragraphs.map(p => ({ text: p.text.replace(/\s+/g, ' ').trim(), bookId: book.id })).filter(p => p.text.length >= 55 && p.text.length <= 240).slice(0, 18))
  expect(homeQuoteCandidates(books)).toEqual(original)
})

it('does not read any paragraph after the eighteenth match', () => {
  const paragraphs = Array.from({ length: 18 }, () => ({ text: 'علم '.repeat(22) }))
  paragraphs.push({ get text(): string { throw Error('unnecessary full-book scan') } })
  expect(homeQuoteCandidates([{ id: 'a', readerModel: { paragraphs } }])).toHaveLength(18)
  expect(homeQuoteCandidates([{ id: 'empty' }])).toEqual([])
})
