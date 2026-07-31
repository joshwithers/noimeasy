/**
 * Cleans text copied or typed into the NOIM form without changing visible
 * spelling. Legal names are title-cased only when every cased letter was
 * entered in the same case; deliberate mixed casing is left untouched.
 *
 * This function is deliberately self-contained because the same implementation
 * is embedded into the browser form as well as used by server-side validation.
 */
export function normaliseNoimText(value: string, isLegalName = false): string {
  let cleaned = value
    .normalize("NFC")
    // Single-line official PDF fields cannot use pasted line and tab layout.
    .replace(/[\u0009-\u000d\u0085\u2028\u2029]+/gu, " ")
    // Remove remaining control and invisible formatting characters. These can
    // be introduced by copying from documents, email, messaging or websites.
    .replace(
      /[\u0000-\u0008\u000e-\u001f\u007f-\u009f\p{Default_Ignorable_Code_Point}]/gu,
      "",
    )
    .replace(/\s+/gu, " ")
    .trim();

  if (!isLegalName || !cleaned) return cleaned;

  const upper = cleaned.toLocaleUpperCase("en-AU");
  const lower = cleaned.toLocaleLowerCase("en-AU");
  const hasCasedLetters = upper !== lower;
  const isUniformCase = cleaned === upper || cleaned === lower;
  if (!hasCasedLetters || !isUniformCase) return cleaned;

  let titleCased = "";
  let capitaliseNext = true;
  for (const character of lower) {
    if (/\p{L}/u.test(character)) {
      titleCased += capitaliseNext
        ? character.toLocaleUpperCase("en-AU")
        : character;
      capitaliseNext = false;
      continue;
    }

    titleCased += character;
    if (/[\s'\u2019\-\u2010-\u2015]/u.test(character)) {
      capitaliseNext = true;
    }
  }

  // Conventional Mc names are a common exception to simple title casing.
  return titleCased.replace(
    /(^|[\s'\u2019\-\u2010-\u2015])Mc(\p{L})/gu,
    (_match, boundary: string, letter: string) =>
      `${boundary}Mc${letter.toLocaleUpperCase("en-AU")}`,
  );
}
