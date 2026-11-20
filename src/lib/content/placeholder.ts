/**
 * H17.14: a bracketed stand-in such as "[COMPANY NAME]" or "[Registered Address]": "[", a capitalised word, more words if any, "]".
 * A text with one is not finished, so a save is refused. Numbers ("[1]") and lower case notes ("[optional]") are fine.
 * The "[ADD FACT" marker of the AI draft and "[placeholder" (any case) are not caught here: a draft may keep them, and they block publishing instead.
 */
export const BRACKET_PLACEHOLDER = /\[(?![Pp][Ll][Aa][Cc][Ee][Hh][Oo][Ll][Dd][Ee][Rr]|[Aa][Dd][Dd] [Ff][Aa][Cc][Tt])[A-Z][A-Za-z0-9&'.-]*(?:[ \t]+[A-Za-z0-9&'.-]+)*\]/;
