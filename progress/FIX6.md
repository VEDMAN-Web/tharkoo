# H15.6 (FIX-6): E1-B1, E1-B3, E1-B8

Branch haiku/h15.6-profile-settings, ownership H15.6.json, off main f4b2216.

- **E1-B1** "Turn on live chat" in Your profile now opens Settings (/u/account/edit-account/), where the chat switches live (src/lib/ui/profile-progress.ts).
- **E1-B3** Change name without a city showed "Too small: expected string to have >=2 characters". The profile schema (src/server/auth/seller-profile.ts) now carries plain messages: "Choose your city.", "Add your name, at least 2 letters.", "Use digits only, with a + at the start if you like.", and so on.
- **E1-B8** Settings (src/components/buyer/SettingsPanel.tsx) read the real status from /api/verification/status: approved "ID checked" (the same word as the Identity check page, as Opus #391 asked), pending "Being checked", rejected "Needs another look", otherwise "Needed for some categories".

Tests first: `tests/server/auth/h15-6-profile-text.test.ts` failed 5 of 5 on main's code (src changes stashed) and passes 5 of 5 after. `tests/e2e/fix6-profile-settings.e2e.ts` covers the three at both sizes (link and landing page, the plain city message, the four identity states).
