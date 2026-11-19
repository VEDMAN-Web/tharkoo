# FIX-1: no uploaded video on a people listing (E1-B4)

Branch haiku/h15.1-people-no-video, ownership H15.1.json, off main.

## What the seller path did BEFORE this fix (measured on a local production build)
1. Post and edit flow, Photos step of a Dating ad: the "Add video" button and the video input were there (PhotoStep had no people check).
2. `POST /api/media/sign` with `kind: "video"` and the id of a Dating draft answered 200. `signMedia` calls `assertVideoAllowed`, which only checked file type and size, ownership and room. Only the staff upload (STAFF_PEOPLE_NO_VIDEO) and the video tours had a people check.
3. `POST /api/media/local` with a small mp4 then answered `{status: "cleared", url: "/uploads/<id>.mp4"}` and the asset was stored with kind video, status cleared and the Dating draft's listing id. (The test server has no Cloudinary and keeps the watermark on by default, which refuses a video for another reason, so the watermark was switched off in the test database. With Cloudinary the sign and complete functions are the same, so the rule was missing there too.)

Scope note for Opus: #335 said the locked People rule is about live video tours and calls, not about uploaded clips. The product text is "Video is never allowed on listings about people" (src/lib/category-kinds.ts), and H13.1 already made staff uploads refuse video for people listings. This fix applies that same rule to the seller path. Confirm the scope before it merges.

## What changed
- New `src/server/media/people-video.ts`: `PEOPLE_NO_VIDEO` ("Videos are not allowed on people listings.") and `assertNoVideoOnPeople(listingId)`, which uses the same `isPeopleListing` helper as the staff upload (a people kind, a people slug, or an age-gate field). It does not touch policy.ts or the term list.
- `signMedia` (through `assertVideoAllowed`), `saveLocalVideo` and `completeVideo` call it. A video slot signed before the rule is closed as rejected when someone tries to fill it. The staff upload keeps its constant (now the same sentence from the same file).
- `submitListing` refuses to publish a people ad that already holds a video (a video saved before the rule), with the same sentence; the seller can delete the video and publish.
- `PhotoStep` takes `allowVideo` and shows the quiet line "No video for this category."; `PostWizard` passes `!people` in both places (post and edit), so a people category has no Add video button.

## Tests (first red, then green)
- `tests/server/media/fix1-people-no-video.test.ts`: 3 of 5 failed before the change (sign refused for a people kind, for a people slug with another kind, and a pre-made slot cannot be filled); the two control tests (ordinary category still signs, photos on a people ad still sign) passed before and after.
- `tests/e2e/fix1-people-no-video.e2e.ts`: Dating has no Add video in the post flow and when opened again, and the server answers with the sentence; Jobs still has Add video.
- Tests changed on purpose because they put a video on a people ad (the old behaviour): `tests/server/media/clear-photos.test.ts` (the two video tests now use an ordinary category), `tests/e2e/h7-100-posting.e2e.ts` (the video tests walk a Jobs ad instead of a Dating ad), `tests/e2e/post-steps-3-4.e2e.ts` and `tests/e2e/post-step-5.e2e.ts` (a Dating ad has no Add video button). The video rules they test are unchanged.
