# Policy Removal Plan

Remove `src/server/shared/policy.ts` and every usage of it from the codebase.

---

## 1. What `policy.ts` exports

| Export | Kind |
|---|---|
| `denyTerm` | function (helper used only inside policy.ts and tests) |
| `ALLOWED_PRODUCT_CODES` | constant (used to validate promotion product codes) |
| `CATEGORY_DENY_TERMS` | constant (array of deny-phrase sequences for categories) |
| `TEXT_DENY_TERMS` | constant (array of deny-phrase sequences for free text) |
| `ATTRIBUTE_DENY_TOKENS` | constant (single-token deny list for attribute keys) |
| `ATTRIBUTE_DENY_SEQUENCES` | constant (phrase deny list for attribute keys) |
| `DenyMatch` | interface `{ denied: boolean; term?: string }` |
| `tokenize` | function |
| `normalizeToken` | function |
| `containsContiguous` | function |
| `categoryDenied` | function |
| `textDenied` | function |
| `attributeKeyDenied` | function |
| `attributeDenied` | function |
| `productCodeDenied` | function |

---

## 2. Every importing file and what it uses

### Source files (`src/`)

| File | Imported symbols | Call sites |
|---|---|---|
| `src/server/shared/index.ts` | All 15 exports (re-exports everything) | Re-export barrel — no call sites, just re-export lines |
| `src/server/shared/publish-gate.ts` | `attributeDenied`, `categoryDenied` | `categoryDenied(input.categorySlug, input.categoryName)` and `attributeDenied(input.attributes)` inside `evaluatePublishGate` |
| `src/server/shared/fields.ts` | `attributeKeyDenied`, `textDenied` | `attributeKeyDenied(field.key).denied \|\| textDenied(field.label).denied` inside `fieldDefinitionSchema.superRefine` |
| `src/server/fields/options.ts` | `textDenied` | `textDenied(value).denied` inside `reviewOptionCells` |
| `src/server/fields/service.ts` | `textDenied` | `textDenied(label).denied` inside `checkFilterLabel` |
| `src/server/listings/service.ts` | `attributeDenied`, `categoryDenied`, `textDenied` | (1) `categoryDenied(category.slug, category.name).denied` guard; (2) `textDenied(text).denied` in `assertCleanText`; (3) `attributeDenied(input.attributes)` in patch path |
| `src/server/listings/import.ts` | `textDenied` | `textDenied(text).denied` inside `bannedHit` |
| `src/server/categories/manage.ts` | `textDenied` | `textDenied(text).denied` inside local `requireText` helper |
| `src/server/locations/manage.ts` | `textDenied` | `textDenied(name).denied` inside local `requireName` helper |
| `src/server/locations/import.ts` | `textDenied` | `textDenied(name).denied` inside `nameProblem` |
| `src/server/layout/service.ts` | `textDenied` | (1) `textDenied(text).denied` inside `validateBlocks`; (2) `textDenied(note).denied` inside `saveDraft` |
| `src/server/layout/media.ts` | `textDenied` | (1) `textDenied(alt).denied` inside `cleanAlt`; (2) `textDenied(tag).denied` loop inside `cleanTags` |
| `src/server/seo/templates.ts` | `textDenied` | `textDenied(value).denied` inside field-problem check |
| `src/server/seo/page-titles.ts` | `textDenied` | `textDenied(value).denied` inside `checkField` helper |
| `src/server/content/studio/fields.ts` | `textDenied` | `textDenied(value).denied` inside `checkFields` |
| `src/server/content/studio/ai-draft.ts` | `textDenied` | `textDenied(value).denied` for topic/city/category/keywords |
| `src/server/moderation/review.ts` | `textDenied` | `textDenied(text).denied` inside `ruleFlags` |
| `src/server/admin/write.ts` | `textDenied` | `textDenied(leaf).denied` inside `adminWrite` |
| `src/server/admin/ads-bulk.ts` | `textDenied` | `textDenied(reason).denied` inside bulk action validation |
| `src/server/billing/service.ts` | `productCodeDenied` | (1) `productCodeDenied(row.code).denied` to skip denied products; (2) `productCodeDenied(product.code).denied` in purchase guard |
| `src/server/billing/plans-admin.ts` | `ALLOWED_PRODUCT_CODES`, `productCodeDenied` | (1) `productCodeDenied(doc.code).denied` in `rowOf`; (2) `productCodeDenied(current.code).denied` in `updatePlan`; (3) `productCodeDenied(code).denied` in `createPlan`; (4) `ALLOWED_PRODUCT_CODES.filter(...)` in `readPricesData` |
| `src/server/billing/coupons-admin.ts` | `textDenied` | `textDenied(code).denied` inside coupon code validation |
| `src/server/seed/data.ts` | `textDenied` | `textDenied(…).denied` inside `demoListings` validation guard |
| `src/server/seed/listings.ts` | `textDenied` | `textDenied(…).denied` guard in `seedDemoListings` |
| `src/server/seed/run.ts` | `attributeKeyDenied`, `categoryDenied`, `productCodeDenied`, `textDenied` | Multiple guards inside `assertSeedAllowed` — checks categories, fields, products, locations, feature flags, credit packs |
| `src/app/admin/categories/fields-service.ts` | `attributeKeyDenied`, `textDenied` | (1) `textDenied(text).denied` in label/help/placeholder loop; (2) `textDenied(label).denied`; (3) `attributeKeyDenied(key).denied` in `addField` |
| `src/app/admin/urls/override-rules.ts` | `textDenied` | `textDenied(value[key]).denied` on title/desc/h1/intro; `textDenied(item.q).denied \|\| textDenied(item.a).denied` for FAQ |
| `src/app/admin/ui-text/store.ts` | `textDenied` | `textDenied(value).denied` in `cleanValue` |
| `src/app/admin/seo/settings/rules.ts` | `textDenied` | (1) `textDenied(intro).denied`; (2) `textDenied(title).denied \|\| textDenied(body).denied` for LLMS sections; (3) `textDenied(nameText).denied` for org name |

### Test files (`tests/`)

| File | Imported symbols | Usage |
|---|---|---|
| `tests/server/shared/policy.test.ts` | `attributeDenied`, `categoryDenied`, `denyTerm`, `productCodeDenied`, `textDenied` | Entire file is the unit tests for policy.ts itself |
| `tests/server/fields/options.test.ts` | `TEXT_DENY_TERMS` | Used in one `it` block to construct a banned string to prove `reviewOptionCells` rejects it |
| `tests/server/listings/price.test.ts` | `attributeDenied` | Used to verify attribute denial in listing patch tests |
| `tests/server/listings/import.test.ts` | `denyTerm` | Constructs a banned phrase to test import rejection |
| `tests/server/seed/seed.test.ts` | `categoryDenied`, `productCodeDenied` | Verifies seed data passes policy checks |
| `tests/server/layout/ui-text.test.ts` | `textDenied` | Verifies UiText save rejects banned text |
| `tests/server/layout/post.test.ts` | `denyTerm` | Constructs banned phrases to test block validation |
| `tests/server/layout/media.test.ts` | `denyTerm` | Constructs banned alt/tag text for rejection tests |
| `tests/server/layout/blocks.test.ts` | `denyTerm` | Constructs banned text for block-validation tests |
| `tests/server/media/site-media-batch.test.ts` | `denyTerm` | Constructs banned text for media upload tests |

---

## 3. Barrel file (`shared/index.ts`)

`src/server/shared/index.ts` re-exports everything from `policy.ts`. All 15 exports (14 values/functions + the `DenyMatch` type) must be removed from this barrel.

---

## 4. `.github` files

- `.github/forbidden-terms.txt` — Contains the same conceptual terms (escort, call girl, erotic, etc.) as plain regex strings. This file drives the CI scanner independently of `policy.ts`. It does **not** import from policy and does **not** need to change.
- `.github/scripts/forbidden-terms.mjs` — Reads `forbidden-terms.txt` and scans source files. It has no reference to `policy.ts`. No changes needed.

Both files operate independently and are safe to leave untouched.

---

## 5. Removal order (dependency-safe sequence)

Each step leaves the codebase in a buildable state if the step above it is complete.

---

### Step 1 — Delete the dedicated test file

**What:** Delete the whole file; it has no content worth keeping.  
**Files:** `tests/server/shared/policy.test.ts` — delete.  
**Verify:** `npm test -- --reporter=verbose 2>&1 | grep -v "policy.test"` — no compile error referencing the deleted file.

---

### Step 2 — Remove `denyTerm` and `TEXT_DENY_TERMS` from test helpers

Tests in `tests/server/layout/blocks.test.ts`, `tests/server/layout/post.test.ts`, `tests/server/layout/media.test.ts`, `tests/server/media/site-media-batch.test.ts`, and `tests/server/listings/import.test.ts` use `denyTerm` only to construct a banned phrase (e.g., `denyTerm("esc","ort")`) to prove something is rejected. The fix for each file is to replace the runtime construction with the literal joined string (e.g., `"escort"`).

`tests/server/fields/options.test.ts` imports `TEXT_DENY_TERMS` to pick a phrase from the array. Replace it with an inline literal phrase (`"prostitution"` or any entry from the list).

**Files to modify:**
- `tests/server/layout/blocks.test.ts`
- `tests/server/layout/post.test.ts`
- `tests/server/layout/media.test.ts`
- `tests/server/media/site-media-batch.test.ts`
- `tests/server/listings/import.test.ts`
- `tests/server/fields/options.test.ts`

**Verify:** `npm test -- --testPathPattern="blocks|post|media|import|options"` — all relevant tests pass, no import of `policy` remains.

---

### Step 3 — Remove `attributeDenied` from `tests/server/listings/price.test.ts`

This test imports `attributeDenied` to call it and assert it returns a `denied` result. Without the policy module, the test must either be rewritten to test the same behaviour through the service's own API (the listing patch should still reject banned attributes via `service.ts`), or the policy-specific assertion must be removed and covered by existing service-level tests.

**Decision:** Remove the direct `attributeDenied` call and its test block; the behaviour is already tested indirectly through the listing service. Leave the remaining price tests untouched.

**Files:** `tests/server/listings/price.test.ts`  
**Verify:** `npm test -- --testPathPattern="price"` — file compiles and remaining tests pass.

---

### Step 4 — Remove `categoryDenied` / `productCodeDenied` from `tests/server/seed/seed.test.ts`

The seed test imports these two functions to assert that seed categories and products pass validation. Once policy is removed, those assertions become meaningless (the validation no longer exists). Remove only the import line and the specific `it` blocks that call `categoryDenied` or `productCodeDenied` directly. Leave all other seed test coverage intact.

**Files:** `tests/server/seed/seed.test.ts`  
**Verify:** `npm test -- --testPathPattern="seed.test"` — remaining seed tests pass.

---

### Step 5 — Remove `textDenied` from `tests/server/layout/ui-text.test.ts`

This test uses `textDenied` to verify that saving a UI text value with a banned phrase is rejected. The service-level rejection will disappear when `textDenied` is removed from `src/app/admin/ui-text/store.ts` (Step 10 below). Remove the import and the specific test block that calls `textDenied` directly or relies on the ban being enforced. Leave all other UI-text tests intact.

**Files:** `tests/server/layout/ui-text.test.ts`  
**Verify:** `npm test -- --testPathPattern="ui-text"` — remaining tests pass.

---

### Step 6 — Remove validation from `src/server/shared/fields.ts`

Remove the `import { attributeKeyDenied, textDenied }` line and the entire `superRefine` block that calls those two functions inside `fieldDefinitionSchema`. The schema still validates key format, label length, options, and bounds — only the content-policy check is removed.

**Files:** `src/server/shared/fields.ts`  
**Verify:** `npm run typecheck` — no TypeScript errors.

---

### Step 7 — Remove validation from `src/server/fields/options.ts` and `src/server/fields/service.ts`

**`options.ts`:** Remove `import { textDenied }` and the `if (textDenied(value).denied)` guard in `reviewOptionCells`. The option is accepted as long as it passes length and duplicate checks.

**`service.ts`:** Remove `import { textDenied }` and the `if (label && textDenied(label).denied)` guard in `checkFilterLabel`.

**Files:** `src/server/fields/options.ts`, `src/server/fields/service.ts`  
**Verify:** `npm test -- --testPathPattern="options"` and `npm run typecheck` — tests pass, no type errors.

---

### Step 8 — Remove validation from `src/server/listings/service.ts`

Remove `import { attributeDenied, categoryDenied, textDenied }`. Then remove three call sites:
1. The `categoryDenied(…).denied` condition in the category guard (the `category.enabled === false` half stays; remove only `|| categoryDenied(…).denied`).
2. The `textDenied(text).denied` throw in `assertCleanText` (the BannedWord check below it stays).
3. The `attributeDenied(input.attributes)` block (the whole `if (input.attributes) { const denied = … }` block is removed; the `assertCleanText(strings)` call that follows stays).

**Files:** `src/server/listings/service.ts`  
**Verify:** `npm test -- --testPathPattern="listings"` and `npm run typecheck` — pass.

---

### Step 9 — Remove validation from `src/server/listings/import.ts`

Remove `import { textDenied }` and simplify `bannedHit` to only use the BannedWord list (`return banned.some(…)` — drop the `textDenied(text).denied ||` prefix).

**Files:** `src/server/listings/import.ts`  
**Verify:** `npm test -- --testPathPattern="import"` and `npm run typecheck` — pass.

---

### Step 10 — Remove validation from app-layer and other server files

Remove the import line and each `textDenied(…).denied` guard in each of these files. In every case the guard just throws a `ValidationError`; removing it means the content goes through unchanged.

**Files (src/app/):**
- `src/app/admin/categories/fields-service.ts` — remove `attributeKeyDenied`, `textDenied` import; remove three guard calls.
- `src/app/admin/urls/override-rules.ts` — remove `textDenied` import; remove two guard calls (title/desc/h1/intro block and the FAQ block).
- `src/app/admin/ui-text/store.ts` — remove `textDenied` import; remove one guard call in `cleanValue`.
- `src/app/admin/seo/settings/rules.ts` — remove `textDenied` import; remove three guard calls (llmsIntro, llmsSections title/body, org name).

**Files (src/server/):**
- `src/server/categories/manage.ts` — remove `textDenied` import; remove guard in `requireText`.
- `src/server/locations/manage.ts` — remove `textDenied` import; remove guard in `requireName`.
- `src/server/locations/import.ts` — remove `textDenied` import; simplify `nameProblem` to `return ""` (or remove it if unused).
- `src/server/layout/service.ts` — remove `textDenied` import; remove guard in `validateBlocks` and `saveDraft`.
- `src/server/layout/media.ts` — remove `textDenied` import; remove guard in `cleanAlt` and the loop in `cleanTags`.
- `src/server/seo/templates.ts` — remove `textDenied` import; remove the `else if (textDenied(value).denied)` branch.
- `src/server/seo/page-titles.ts` — remove `textDenied` import; remove the `else if (textDenied(value).denied)` branch in `checkField`.
- `src/server/content/studio/fields.ts` — remove `textDenied` import; remove the `texts.some(textDenied(…).denied)` guard.
- `src/server/content/studio/ai-draft.ts` — remove `textDenied` import; remove the `textDenied(value).denied` guard.
- `src/server/moderation/review.ts` — remove `textDenied` import; remove `textDenied(text).denied ? ["Banned word"] : []` from `ruleFlags` (the phone-in-text check stays).
- `src/server/admin/write.ts` — remove `textDenied` import; remove the `textDenied(leaf).denied` guard loop.
- `src/server/admin/ads-bulk.ts` — remove `textDenied` import; remove the `textDenied(reason).denied` guard.
- `src/server/billing/coupons-admin.ts` — remove `textDenied` import; remove the `textDenied(code).denied || textDenied(…).denied` guard.

**Verify:** `npm run typecheck` — no TypeScript errors across all changed files.

---

### Step 11 — Remove `productCodeDenied` and `ALLOWED_PRODUCT_CODES` from billing files

**`src/server/billing/service.ts`:** Remove `import { productCodeDenied }`. In the product-list builder, remove the `if (productCodeDenied(row.code).denied) continue;` guard (all DB products are shown). In the purchase path, remove the `if (productCodeDenied(product.code).denied) throw` guard.

**`src/server/billing/plans-admin.ts`:** Remove `import { ALLOWED_PRODUCT_CODES, productCodeDenied }`. In `rowOf`, set `allowed: true` unconditionally (remove the `!productCodeDenied(doc.code).denied` expression). In `readPricesData`, change `freeCodes: ALLOWED_PRODUCT_CODES.filter(…)` — `ALLOWED_PRODUCT_CODES` is the list of valid codes that can be added as plans. Since the list is being removed, inline it directly in `plans-admin.ts` as a local constant (the same 13-string array), or derive free codes from the difference between all existing product codes and the used ones. **Decision:** Copy the 13-string array inline as a module-local `const PLAN_CODES` in `plans-admin.ts` so the "Add a plan" UI still shows valid types. In `updatePlan` and `createPlan`, remove the `productCodeDenied(…).denied` guards; `createPlan` now only checks `PLAN_CODES.includes(code)`.

**Files:** `src/server/billing/service.ts`, `src/server/billing/plans-admin.ts`  
**Verify:** `npm run typecheck` — pass.

---

### Step 12 — Remove validation from `src/server/shared/publish-gate.ts`

Remove `import { attributeDenied, categoryDenied }`. Remove the two deny-list checks in `evaluatePublishGate`:
- Remove the `const category = categoryDenied(…); if (category.denied) return …` block.
- Remove the `const attributes = attributeDenied(…); if (attributes.denied) return …` block.
- Remove `"CATEGORY_DENIED"` and `"ATTRIBUTE_DENIED"` from the `PublishBlockReason` union type (they can no longer be returned).

**Files:** `src/server/shared/publish-gate.ts`  
**Verify:** `npm run typecheck` — pass. Check that any test for `publish-gate.ts` that expects `CATEGORY_DENIED` or `ATTRIBUTE_DENIED` outcomes is also updated.

---

### Step 13 — Remove policy usage from seed files

**`src/server/seed/data.ts`:** Remove `import { textDenied }`; remove the `textDenied(…).denied` guard inside `demoListings`.

**`src/server/seed/listings.ts`:** Remove `import { textDenied }`; remove the `textDenied(…).denied` guard.

**`src/server/seed/run.ts`:** Remove `import { attributeKeyDenied, categoryDenied, productCodeDenied, textDenied }`; delete the entire body of `assertSeedAllowed` (replace with an empty function body or remove the function if it has no other callers — check usages first).

**Files:** `src/server/seed/data.ts`, `src/server/seed/listings.ts`, `src/server/seed/run.ts`  
**Verify:** `npm run typecheck` — pass.

---

### Step 14 — Clean up the barrel (`src/server/shared/index.ts`)

Remove all lines that export from `@/server/shared/policy` — both the named-export block (14 names) and the `export type { DenyMatch }` line. The barrel still re-exports everything else.

**Files:** `src/server/shared/index.ts`  
**Verify:** `npm run typecheck` — pass. Confirm no file still imports `DenyMatch` or any other policy symbol via the barrel.

---

### Step 15 — Delete `src/server/shared/policy.ts`

**What:** Delete the file.  
**Files:** `src/server/shared/policy.ts` — delete.  
**Verify:** `npm run typecheck && npm test` — both pass with zero references to the deleted file.

---

## Summary

**Total files to delete:** 2  
(`src/server/shared/policy.ts`, `tests/server/shared/policy.test.ts`)

**Total source files to edit:** 29  
(14 in `src/server/`, 10 in `src/server/seed`+billing+admin+categories+locations+layout+seo+content+moderation, 4 in `src/app/admin/`, 1 barrel)

**Total test files to edit:** 9  
(`tests/server/fields/options.test.ts`, `tests/server/layout/blocks.test.ts`, `tests/server/layout/post.test.ts`, `tests/server/layout/media.test.ts`, `tests/server/media/site-media-batch.test.ts`, `tests/server/listings/import.test.ts`, `tests/server/listings/price.test.ts`, `tests/server/seed/seed.test.ts`, `tests/server/layout/ui-text.test.ts`)

**`.github/` files:** No changes needed.

**Final verification command:** `npm run typecheck && npm test`
