/**
 * Length guide for the home page title and description (H6.10). The admin counters use these ranges;
 * the server only refuses empty text, dashes and text longer than the stored limit.
 * Stored in Site.homepage.content.seoTitle and seoDescription, the fields getHomepageContent reads.
 */
export const HOME_TITLE_LIMITS = { min: 30, max: 65 } as const;
export const HOME_DESCRIPTION_LIMITS = { min: 70, max: 160 } as const;

/** The longest text the homepage schema keeps (see sanitizeSiteContent). */
export const HOME_TITLE_STORED_MAX = 120;
export const HOME_DESCRIPTION_STORED_MAX = 240;
