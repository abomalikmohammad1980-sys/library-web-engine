type Dictionary = Pick<typeof import('./ui_translations'), 'translateUiLabel'>

/** Local bundled dictionary, deferred until a non-Arabic interface needs it. */
export function createUiDictionaryLoader(load: () => Promise<Dictionary> = () => import('./ui_translations')) {
  let dictionary: Dictionary | undefined
  let pending: Promise<Dictionary> | undefined
  return {
    translate(source: string, language: string): string | undefined { return dictionary?.translateUiLabel(source, language) },
    ready(): Promise<Dictionary> {
      return pending ??= load().then(value => { dictionary = value; return value }).catch(error => { pending = undefined; throw error })
    },
    async resolve(source: string, language: string): Promise<string> {
      if (language === 'ar') return source
      try { return (await this.ready()).translateUiLabel(source, language) ?? source }
      catch { return source } // A failed local chunk must not hide the confirmation question.
    },
  }
}

export const uiDictionary = createUiDictionaryLoader()
export const resolveUiLabel = (source: string, language: string): Promise<string> => uiDictionary.resolve(source, language)
