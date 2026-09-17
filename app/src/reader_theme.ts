export type ReadingTheme = 'day' | 'sepia' | 'night'

/**
 * `sepiya` was shipped as a misspelled reading-theme value.  Keep accepting
 * that persisted value, but expose and write only the canonical `sepia`.
 */
export function normalizeReadingTheme(value: string | null | undefined): ReadingTheme {
  if (value === 'night') return 'night'
  if (value === 'sepia' || value === 'sepiya') return 'sepia'
  return 'day'
}

export function migrateReadingThemeDataset(target: { dataset: { readingTheme?: string } }): ReadingTheme {
  const theme = normalizeReadingTheme(target.dataset.readingTheme)
  target.dataset.readingTheme = theme
  return theme
}
