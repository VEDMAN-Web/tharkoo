/**
 * H17.14: a bracketed stand-in such as "[COMPANY NAME]" or "[Registered Address]": "[", a capitalised word, more words if any, "]".
 * A text with one is not finished, so a save is refused. Numbers ("[1]") and lower case notes ("[optional]") are fine.
 */
export const BRACKET_PLACEHOLDER = /\[[A-Z][A-Za-z0-9&'.-]*(?:[ \t]+[A-Za-z0-9&'.-]+)*\]/;
