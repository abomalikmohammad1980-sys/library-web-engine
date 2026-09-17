import { randomUUID } from 'node:crypto'

/** Keep the page map in the body: large books exceed HTTP header limits. */
export function wordConversionMultipart(pdf, pageMapJson) {
  const boundary = 'khizana-' + randomUUID()
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="pdf"; filename="book.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
    pdf,
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="pageMap"; filename="page-map.json"\r\nContent-Type: application/json\r\n\r\n`),
    Buffer.from(pageMapJson, 'utf8'),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])
  return { body, contentType: `multipart/form-data; boundary=${boundary}` }
}
