import { createContext, createElement, ReactNode, useContext, useMemo } from 'react';

import type { LanguageCode } from '@/utils/users';

import { en, type TranslationKey } from './en';
import { id } from './id';

const DICTIONARIES: Record<LanguageCode, Record<TranslationKey, string>> = {
  en,
  id,
};

export type TranslateFn = (
  key: TranslationKey,
  params?: Record<string, string | number>,
) => string;

type I18nContextValue = {
  t: TranslateFn;
  lang: LanguageCode;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const v = params[key];
    return v === undefined ? match : String(v);
  });
}

function makeTranslator(lang: LanguageCode): TranslateFn {
  const dict = DICTIONARIES[lang] ?? DICTIONARIES.en;
  const fallback = DICTIONARIES.en;
  return (key, params) => interpolate(dict[key] ?? fallback[key] ?? key, params);
}

export function I18nProvider({
  lang,
  children,
}: {
  lang: LanguageCode;
  children: ReactNode;
}) {
  const value = useMemo<I18nContextValue>(
    () => ({ t: makeTranslator(lang), lang }),
    [lang],
  );
  return createElement(I18nContext.Provider, { value }, children);
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  // Defensive fallback so components outside the provider (e.g. early
  // render before Clerk loads) don't crash.
  return { t: makeTranslator('en'), lang: 'en' };
}

export type { TranslationKey };
