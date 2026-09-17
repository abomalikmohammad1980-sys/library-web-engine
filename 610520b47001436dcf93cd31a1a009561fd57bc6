import { strToU8, zipSync } from 'fflate'
import type { ResearchProject } from './research_project'
export interface ResearchBenefitExport { id: string; kind: string; text: string; book: string; author?: string; page: number }
const xml = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const paragraph = (text: string, style = ''): string => `<w:p><w:pPr><w:bidi/>${style ? `<w:pStyle w:val="${style}"/>` : ''}</w:pPr><w:r><w:rPr><w:rtl/></w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`
export function researchProjectDocx(project: ResearchProject, benefits: readonly ResearchBenefitExport[]): Uint8Array {
  const ordered = project.annotationIds.map(id => benefits.find(item => item.id === id)).filter((item): item is ResearchBenefitExport => Boolean(item))
  const body = [paragraph(project.title, 'Title'), ...(project.description ? [paragraph(project.description)] : []), ...ordered.flatMap((item, index) => [paragraph(`${index + 1}. ${item.kind}`, 'Heading1'), paragraph(item.text), paragraph(`المصدر: ${item.book}${item.author ? ` — ${item.author}` : ''} — الصفحة ${item.page}`)])].join('')
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:bidi/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`
  return zipSync({
    '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/document.xml': strToU8(document),
  }, { level: 6 })
}
