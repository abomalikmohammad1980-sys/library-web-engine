export interface AuthorCsvRecord {
  id: string; name: string; aliases: string[]; deathYearHijri?: number; contemporary?: boolean
  country?: string; madhhab?: string; biography?: string; teachers?: string[]; students?: string[]; sourceUrl?: string
}

const cell = (value: unknown): string => `"${String(value ?? '').replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`

export function authorCatalogCsv(authors: readonly AuthorCsvRecord[]): string {
  // هذا تصدير لدليل المؤلفين وبيانات تراجمهم فقط. لا نُصدر معرّف المصدر
  // المرجعي أو عدد كتبه، لأنهما لا يمثلان محتوى خزانة المستخدم.
  const header = ['المعرف', 'الاسم المعياري', 'الأسماء البديلة', 'الحالة', 'الوفاة هـ', 'البلد', 'المذهب', 'الترجمة', 'الشيوخ', 'التلاميذ', 'المصدر']
  const rows = [...authors].sort((a, b) => a.name.localeCompare(b.name, 'ar')).map(author => [
    author.id, author.name, author.aliases.join(' | '), author.contemporary ? 'معاصر' : 'متوفى', author.deathYearHijri ?? '',
    author.country ?? '', author.madhhab ?? '', author.biography ?? '', (author.teachers ?? []).join(' | '), (author.students ?? []).join(' | '), author.sourceUrl ?? '',
  ])
  return `\uFEFF${[header, ...rows].map(row => row.map(cell).join(',')).join('\r\n')}\r\n`
}
