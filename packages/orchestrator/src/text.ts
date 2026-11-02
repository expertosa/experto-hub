const DIACRITICS = /[\u064B-\u065F\u0670\u0640]/g;

/** Fold common Arabic variants so routing does not depend on spelling. */
export function normalizeArabic(value: string): string {
  return value
    .replace(DIACRITICS, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function termPattern(term: string): RegExp {
  const escaped = normalizeArabic(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Optional clitics (لل / ال / و ف ب ك ل) so «للإيجار» still matches «إيجار».
  return new RegExp(
    `(^|[^\\p{Script=Arabic}\\p{L}\\p{N}])(?:لل|ال|[وفبكل])?${escaped}(?![\\p{Script=Arabic}\\p{L}\\p{N}])`,
    "u",
  );
}

/** Whole-word match. Optional leading «ال». Does not match a stem hidden inside another word. */
export function hasTerm(text: string, term: string): boolean {
  return termPattern(term).test(normalizeArabic(text));
}
