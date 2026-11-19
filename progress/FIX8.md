# H15.8 (FIX-8): chat thread contrast (E1-B9)

Branch haiku/h15.8-chat-contrast, ownership H15.8.json, off main f4b2216.

In the Chats page thread, the advertiser's own message bubble was dark text (#1a1405) on the accent colour, which axe reports as a serious colour-contrast problem (`div[role=log] > div:nth-child(2)`) after a reply. The bubble now uses the same deep pink gradient as the panel bubble (#d1137a to #a8124f) with white text (about 5.2:1 at the lighter end, more at the darker end). The other side's bubble is unchanged and passes.

Test first: `tests/e2e/fix8-chat-contrast.e2e.ts` runs axe (color-contrast rule) on the thread after a reply and after a block, at both sizes. It failed on a build without the change (both sizes) and passes after.
