"use client";

import { createContext, useContext, type ReactNode } from "react";

export type Locale = "en" | "es";

const LocaleContext = createContext<Locale>("en");

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/**
 * Pick the string table for the current locale. Tool clients that have a
 * Spanish page define `{ en: {...}, es: {...} }` and call this.
 */
export function useStrings<T>(table: { en: T; es?: T }): T {
  const locale = useLocale();
  return (locale === "es" && table.es) || table.en;
}

/** Shared strings for components/ui/kit.tsx and Dropzone. */
export const kitStrings = {
  en: {
    changeFile: "Change file",
    startOver: "Start over",
    done: "Done",
    working: "Working…",
    smaller: "smaller",
    noSmaller: "no smaller",
    dropPdf: "Drop your PDF here",
    dropPdfs: "Drop your PDFs here",
    browse: "or tap to choose a file",
    browseMany: "or tap to choose files",
  },
  es: {
    changeFile: "Cambiar archivo",
    startOver: "Empezar de nuevo",
    done: "Listo",
    working: "Procesando…",
    smaller: "más pequeño",
    noSmaller: "sin reducción",
    dropPdf: "Suelta tu PDF aquí",
    dropPdfs: "Suelta tus PDF aquí",
    browse: "o toca para elegir un archivo",
    browseMany: "o toca para elegir archivos",
  },
};
