# H15.3 (FIX-3): a chat about an ad that is not live is read-only (E1-B7)

Branch haiku/h15.3-chat-readonly, ownership H15.3.json, off main f4b2216.

## Bug
After the advertiser deleted (or paused, or the ad expired) an ad, the buyer's and the advertiser's thread in Chats still had an enabled message box. Only a "blocked" thread closed. The server (`sendMessage`) only checked the blocked flag; a new chat on a removed ad was refused, but an existing thread was not.

## Change
- `src/server/chat/service.ts`: `sendMessage` refuses with 403 (ForbiddenError) and the sentence "This ad is no longer live, so you can read this chat but not reply." when the ad is not live. Live means the ad exists, its status is active and its end date has not passed (so paused, removed, expired, archived, deleted, a missing ad, and an active ad past its end date are all refused). `listMessages` now returns `conversation.adLive`.
- `src/lib/chat-text.ts`: the sentence, shared by the server and the thread.
- `src/components/chat/ChatThread.tsx`: when `adLive` is false the message box, Photo and Send are off, the box says "This ad is no longer live", and one line (`data-tk="chat-readonly"`) gives the sentence. Block keeps its own meaning ("Blocked" only for a blocked thread). Both sides can still read the messages. When the ad is live again (resumed), the thread writes again.

## Tests (first red, then green)
- `tests/server/chat/h15-3-readonly.test.ts`: 9 tests, all 9 failed before the change; now all pass with the existing chat tests (21 of 21). Covers paused, removed, expired, deleted and archived (403 + sentence for both sides, reading still works), an active ad past its end date, a missing ad, a live ad still takes messages, and an ad that goes live again takes messages again.
- `tests/e2e/fix3-chat-readonly.e2e.ts` (both sizes): a buyer and an advertiser, the advertiser pauses (thread read-only with the line, API 403 with the sentence), resumes (writes again), deletes (read-only again).
