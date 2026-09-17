import { describe, expect, it } from 'vitest'
import { readerDocumentTitle, readerIdentityLabel } from './reader_identity'

describe('reader identity', () => {
  it('يعرّف لسان المتصفح باسم الكتاب ثم الخزانة', () => {
    expect(readerDocumentTitle('الطريق إلى القرآن')).toBe('الطريق إلى القرآن — الخِزانة')
  })

  it('يبني هوية موجزة من الكتاب والمؤلف مع fallback صريح', () => {
    expect(readerIdentityLabel('الطريق إلى القرآن', 'إبراهيم القومي')).toBe('الطريق إلى القرآن — إبراهيم القومي')
    expect(readerIdentityLabel(' ', '')).toBe('كتاب بدون عنوان — مؤلف غير معروف')
  })
})
