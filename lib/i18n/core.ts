// Language core. Arabic source text is the translation key; English lives in ./en.
// Kept free of JSX so the custom JSX runtime can import it without cycles.
import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { EN } from "./en";

export type Lang = "ar" | "en";
export const LANG_COOKIE = "lang";
const AR = /[\u0600-\u06FF]/;

const PREFIXES: [string, string][] = [["مسابقة: ", "Quiz: "]];

// Stored on globalThis so every bundled copy of this module (e.g. the JSX runtime,
// which Vite may pre-bundle separately) shares the same active language.
const store = globalThis as typeof globalThis & { __appLang?: Lang };
const cur = (): Lang => store.__appLang ?? "ar";
export const getLang = cur;
export const setCurrentLang = (l: Lang) => {
  store.__appLang = l;
};
export const dirFor = (l: Lang) => (l === "ar" ? "rtl" : "ltr");
/** Locale for dates and numbers. */
export const loc = () => (cur() === "en" ? "en-US" : "ar-EG");

const parse = (v: string | undefined | null): Lang => (v === "en" ? "en" : "ar");

/** Reads the saved preference (cookie) on the server during SSR or in the browser. */
export const readSavedLang = createIsomorphicFn()
  .server(() => parse(getCookie(LANG_COOKIE)))
  .client(() => {
    const m = document.cookie.match(/(?:^|;\s*)lang=(\w+)/);
    return parse(m?.[1] ?? localStorage.getItem(LANG_COOKIE));
  });

export function saveLang(l: Lang) {
  document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
  localStorage.setItem(LANG_COOKIE, l);
}

/**
 * Translate Arabic UI text. Non-strings and text without a dictionary entry
 * (e.g. user-written content) are returned unchanged. `{0}`, `{1}` are filled from params.
 */
export function t<T>(s: T, params?: unknown[]): T {
  if (typeof s !== "string") return s;
  let out: string = s;
  const current = cur();
  if (current === "en" && /^\s*←\s*$/.test(s)) out = s.replace("←", "→");
  else if (current === "en" && AR.test(s)) {
    const key = s.trim();
    const hit = EN[key];
    if (hit !== undefined) {
      const lead = s.slice(0, s.indexOf(key));
      const trail = s.slice(s.indexOf(key) + key.length);
      out = lead + hit + trail;
    } else {
      // System-generated prefixes followed by user content, e.g. "مسابقة: <title>".
      const p = PREFIXES.find(([ar]) => s.startsWith(ar));
      if (p) out = p[1] + s.slice(p[0].length);
    }
  }
  if (params) out = out.replace(/\{(\d+)\}/g, (_, i) => String(params[Number(i)] ?? ""));
  return out as T;
}
