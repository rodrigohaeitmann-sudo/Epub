// Wrapper around the Chrome on-device Translator API (EN -> PT).

const SOURCE = 'en'
const TARGET = 'pt'

function getStatic(): TranslatorStatic | undefined {
  if (typeof Translator !== 'undefined') return Translator
  if (typeof window !== 'undefined' && window.Translator) return window.Translator
  return undefined
}

export function isTranslatorSupported(): boolean {
  return getStatic() !== undefined
}

export async function getAvailability(): Promise<TranslatorAvailability> {
  const T = getStatic()
  if (!T) return 'unavailable'
  try {
    return await T.availability({ sourceLanguage: SOURCE, targetLanguage: TARGET })
  } catch {
    return 'unavailable'
  }
}

let translatorPromise: Promise<TranslatorInstance> | null = null

export function getTranslator(onDownload?: (loaded: number) => void): Promise<TranslatorInstance> {
  if (!translatorPromise) {
    const T = getStatic()
    if (!T) return Promise.reject(new Error('Translator API indisponível neste navegador.'))
    translatorPromise = T.create({
      sourceLanguage: SOURCE,
      targetLanguage: TARGET,
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => onDownload?.(e.loaded))
      },
    }).catch((err) => {
      translatorPromise = null
      throw err
    })
  }
  return translatorPromise
}

export interface TranslateProgress {
  done: number
  total: number
}

// Translate a chapter's paragraphs in order. Returns one PT string per input.
export async function translateParagraphs(
  texts: string[],
  onProgress?: (p: TranslateProgress) => void,
  onDownload?: (loaded: number) => void,
): Promise<string[]> {
  const translator = await getTranslator(onDownload)
  const out: string[] = []
  for (let i = 0; i < texts.length; i++) {
    try {
      out.push(await translator.translate(texts[i]))
    } catch {
      out.push('')
    }
    onProgress?.({ done: i + 1, total: texts.length })
  }
  return out
}
