// Minimal typings for the Chrome on-device Translator API (Chrome/Edge >= 138).
// https://developer.chrome.com/docs/ai/translator-api
export {}

declare global {
  type TranslatorAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable'

  interface TranslatorCreateMonitor {
    addEventListener(
      type: 'downloadprogress',
      listener: (event: { loaded: number }) => void,
    ): void
  }

  interface TranslatorCreateOptions {
    sourceLanguage: string
    targetLanguage: string
    monitor?: (m: TranslatorCreateMonitor) => void
  }

  interface TranslatorInstance {
    translate(input: string): Promise<string>
    destroy?(): void
  }

  interface TranslatorStatic {
    availability(options: {
      sourceLanguage: string
      targetLanguage: string
    }): Promise<TranslatorAvailability>
    create(options: TranslatorCreateOptions): Promise<TranslatorInstance>
  }

  // Exposed as a global constructor-like object in supporting browsers.
  const Translator: TranslatorStatic | undefined

  interface Window {
    Translator?: TranslatorStatic
  }
}
