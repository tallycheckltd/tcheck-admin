/**
 * Terms of Service / Privacy Policy live ONLY on the website — no client ships a copy of the text
 * (hardcoded copies drift from what's published, so someone could "accept" wording that isn't the
 * real terms). iOS (`LegalUrls`) and Android (`LegalUrls`) keep the same two URLs in one place too.
 * Bump `TERMS_VERSION` in server/src/config/terms.ts whenever the website text changes.
 */
export const LEGAL_URLS = {
  terms: 'https://tallycheck.co.ke/terms',
  privacy: 'https://tallycheck.co.ke/privacy',
} as const;
