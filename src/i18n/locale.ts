export const APP_LOCALES = ["en", "pt-BR"] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

const LOCALE_STORAGE_KEY = "tarot-table-locale";

export function isAppLocale(value: string | null): value is AppLocale {
  return value === "en" || value === "pt-BR";
}

export function getBrowserLocale(
  languages: readonly string[] = []
): AppLocale {
  for (const language of languages) {
    const normalizedLanguage = language.toLowerCase();

    if (normalizedLanguage.startsWith("pt")) {
      return "pt-BR";
    }

    if (normalizedLanguage.startsWith("en")) {
      return "en";
    }
  }

  return "en";
}

export function getInitialLocale(): AppLocale {
  if (typeof window === "undefined") {
    return "en";
  }

  const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);

  if (isAppLocale(savedLocale)) {
    return savedLocale;
  }

  return getBrowserLocale(
    navigator.languages?.length ? navigator.languages : [navigator.language]
  );
}

export function persistLocale(locale: AppLocale) {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export function applyDocumentLocale(locale: AppLocale) {
  document.documentElement.lang = locale;
}
