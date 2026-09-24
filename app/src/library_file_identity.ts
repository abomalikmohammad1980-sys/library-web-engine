export function approximateGregorianYear(hijri: number): number {
  return Math.round(hijri - hijri / 33 + 622)
}

export function isDocxFile(file: Pick<File, 'name' | 'type'>): boolean {
  return /\.docx$/i.test(file.name) || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}

export function isWordFile(file: Pick<File, 'name' | 'type'>): boolean {
  return /\.(docx|doc|rtf)$/i.test(file.name) || isDocxFile(file)
}

