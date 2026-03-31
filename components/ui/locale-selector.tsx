"use client";

import { useLocale } from "@/hooks/use-locale";
import { getLocales, type Locale } from "@/lib/i18n";

const FLAG_EMOJI: Record<Locale, string> = {
  en: "\u{1F1FA}\u{1F1F8}",
  fil: "\u{1F1F5}\u{1F1ED}",
  id: "\u{1F1EE}\u{1F1E9}",
};

export function LocaleSelector() {
  const { locale, setLocale } = useLocale();
  const locales = getLocales();

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="locale-selector"
        className="text-sm font-medium text-stone-700 dark:text-stone-300"
      >
        Language
      </label>
      <select
        id="locale-selector"
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="border border-stone-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
      >
        {locales.map((loc) => (
          <option key={loc.code} value={loc.code}>
            {FLAG_EMOJI[loc.code]} {loc.name}
          </option>
        ))}
      </select>
    </div>
  );
}
