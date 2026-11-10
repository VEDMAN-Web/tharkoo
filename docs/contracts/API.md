# API contract

Tharkoo route handlers. UI tasks code against this file and the Zod schemas in `src/server/shared/schemas/`. Persistence is `docs/contracts/DATA_MODEL.md`.

Transport: Next.js route handlers, Node.js runtime, one process. No Express app.

## Envelope

Success:

```json
{
  "ok": true,
  "data": {},
  "meta": { "requestId": "uuid", "page": 1, "pageSize": 20, "total": 0 },
  "error": null
}
```

Error:

```json
{
  "ok": false,
  "data": null,
  "meta": { "requestId": "uuid" },
  "error": { "code": "VALIDATION_ERROR", "message": "Invalid request", "fields": { "email": ["Required"] } }
}
```

Helpers: `success`, `failure`, `parseInput`, `handle` in `src/server/http`. `handle(fn)` catches thrown `HttpError` and `ZodError` and returns the envelope. `X-Request-Id` is echoed. `429` responses include `Retry-After`.

## Error codes

| Code | HTTP | Class |
|---|---|---|
| `VALIDATION_ERROR` | 400 | `ValidationError` |
| `UNAUTHORIZED` | 401 | `UnauthorizedError` |
| `FORBIDDEN` | 403 | `ForbiddenError` |
| `NOT_FOUND` | 404 | `NotFoundError` |
| `CONFLICT` | 409 | `ConflictError` |
| `RATE_LIMITED` | 429 | `RateLimitedError` |
| `VERIFICATION_REQUIRED` | 403 | `VerificationRequiredError` |
| `POLICY_VIOLATION` | 422 | `PolicyViolationError` |
| `PAYMENT_REQUIRED` | 402 | `PaymentRequiredError` |
| `INTERNAL` | 500 | `InternalError` |

Every route may also return `INTERNAL`. The tables list the codes callers must handle besides that.

## Auth

- Session cookie: HTTP-only, `SameSite=Lax`, `Secure` in production. Mutations check origin.
- Admin routes need a session plus an RBAC role (`superadmin`, `moderator`, `trust_safety`, `support`, `seo_editor`, `finance`).
- Cron routes require header `x-cron-secret` equal to `CRON_SECRET`. Schema for the body is `cronBodySchema` (empty object).
- Payment webhook checks the provider signature before `paymentWebhookBodySchema`.
- Idempotency-Key is the `idempotencyKey` field on pack purchase and promotion checkout.
- Category, attribute, and product writes that hit the deny-list in `src/server/shared/policy.ts` return `POLICY_VIOLATION`.
- Listing submit without approved ID review returns `VERIFICATION_REQUIRED`. Submit with uncleared media returns `POLICY_VIOLATION` (`MEDIA_NOT_CLEARED` on the publish gate). A weekly free-ad limit returns `PAYMENT_REQUIRED`.

Public listing reads omit `contact`, password hashes, ID documents, and moderation notes.

## T2.1 Auth

| Method | Path | Auth | Schema | Response `data` | Errors |
|---|---|---|---|---|---|
| POST | `/api/auth/register` | Public | `registerBodySchema` | `{ userId }` | `VALIDATION_ERROR`, `CONFLICT`, `RATE_LIMITED`, `VERIFICATION_REQUIRED` |
| POST | `/api/auth/verify-email` | Public | `verifyEmailBodySchema` | `{ verified: true }` | `VALIDATION_ERROR`, `NOT_FOUND` |
| POST | `/api/auth/login` | Public | `loginBodySchema` | `{ user }` | `UNAUTHORIZED`, `RATE_LIMITED` |
| POST | `/api/auth/logout` | Session | — | `{ ok: true }` | `UNAUTHORIZED` |
| GET | `/api/auth/me` | Session | — | `{ user, verification, permissions }` | `UNAUTHORIZED` |
| POST | `/api/auth/forgot-password` | Public | `forgotPasswordBodySchema` | `{ ok: true }` | `RATE_LIMITED` |
| POST | `/api/auth/reset-password` | Public | `resetPasswordBodySchema` | `{ ok: true }` | `VALIDATION_ERROR`, `NOT_FOUND` |
| POST | `/api/auth/phone/start` | Session | `phoneStartBodySchema` | `{ challengeId }` | `UNAUTHORIZED`, `RATE_LIMITED` |
| POST | `/api/auth/phone/confirm` | Session | `phoneConfirmBodySchema` | `{ phoneVerified: true }` | `VALIDATION_ERROR`, `UNAUTHORIZED` |
| GET | `/api/auth/sessions` | Session | — | `{ sessions }` | `UNAUTHORIZED` |
| DELETE | `/api/auth/sessions/{id}` | Session | — | `{ ok: true }` | `UNAUTHORIZED`, `NOT_FOUND` |

Register requires `dateOfBirth`, `acceptedTerms: true`, and `attestedAdult: true`. The phone routes are the optional test-mode OTP. Reset revokes every session for that user. `user` never includes `passwordHash` or token hashes.

## T2.2 Media

| Method | Path | Auth | Schema | Response `data` | Errors |
|---|---|---|---|---|---|
| POST | `/api/media/sign` | Session | `mediaSignBodySchema` | `{ timestamp, signature, cloudName, apiKey, folder, mediaId }` | `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `POLICY_VIOLATION` |
| POST | `/api/media/complete` | Session | `mediaCompleteBodySchema` | `{ status: "scanning" }` | `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND` |
| GET | `/api/media/{id}` | Owner or admin | — | metadata and status, no binary | `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND` |
| DELETE | `/api/media/{id}` | Owner | — | `{ ok: true }` | `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND` |
| PATCH | `/api/media/reorder` | Owner | `mediaReorderBodySchema` | `{ mediaIds, coverMediaId }` | `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN` |

`/api/media/sign` is the signed-upload route (direct browser upload). MIME allow-list is jpeg, png, webp. Max size is 8 MB. ID-document assets use a private bucket and are never returned on a public URL. Staff download is the verification file route below.

## T2.3 Verification

| Method | Path | Auth | Schema | Response `data` | Errors |
|---|---|---|---|---|---|
| POST | `/api/verification/id/upload-url` | Session | `verificationUploadBodySchema` | `{ uploadUrl, assetId }` | `VALIDATION_ERROR`, `UNAUTHORIZED` |
| POST | `/api/verification/id/complete` | Session | `verificationCompleteBodySchema` (`frontAssetId`, `backAssetId?`, `selfieAssetId`) | `{ status: "pending_review" }` | `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN` |
| GET | `/api/verification/status` | Session | — | `{ status, reason? }` | `UNAUTHORIZED` |
| GET | `/api/admin/verifications` | Admin `trust_safety` | `pageQuerySchema` | `{ items, total }` | `UNAUTHORIZED`, `FORBIDDEN` |
| POST | `/api/admin/verifications/{id}/decision` | Admin `trust_safety` | `verificationDecisionBodySchema` | `{ status }` | `VALIDATION_ERROR`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT` |
| GET | `/api/admin/verifications/{id}/file` | Admin `trust_safety` | — | `{ front, back?, selfie }` each `{ url, expiresAt }` (120s) | `FORBIDDEN`, `NOT_FOUND` |

`status` is `unsubmitted`, `pending_review`, `approved`, or `rejected`. Approve and reject write an audit event. Complete stores the caller's own `id_document` assets. The file route returns one signed URL per stored image (front, back when present, selfie). Each view writes one `verification.view` audit event.

## T3.1 Listings

| Method | Path | Auth | Schema | Response `data` | Errors |
|---|---|---|---|---|---|
| GET | `/api/listings` | Session | `listingQuerySchema` | `{ items, total }` own rows | `UNAUTHORIZED` |
| POST | `/api/listings` | Session | `listingCreateBodySchema` | draft listing | `VALIDATION_ERROR`, `UNAUTHORIZED`, `POLICY_VIOLATION` |
| GET | `/api/listings/by-id/{id}` | Owner or admin | — | listing, including contact for the owner | `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND` |
| GET | `/api/listings/{slug}` | Public | — | public projection | `NOT_FOUND` |
| PATCH | `/api/listings/{id}` | Owner | `listingPatchBodySchema` | listing | `VALIDATION_ERROR`, `FORBIDDEN`, `POLICY_VIOLATION`, `CONFLICT` |
| DELETE | `/api/listings/{id}` | Owner | — | `{ status: "deleted" }` | `FORBIDDEN`, `NOT_FOUND` |
| POST | `/api/listings/{id}/submit` | Owner | `listingSubmitBodySchema` | `{ status: "pending" }` | `VERIFICATION_REQUIRED`, `POLICY_VIOLATION`, `PAYMENT_REQUIRED`, `CONFLICT` |
| POST | `/api/listings/{id}/renew` | Owner | — | listing | `FORBIDDEN`, `CONFLICT`, `PAYMENT_REQUIRED` |
| POST | `/api/listings/{id}/pause` | Owner | — | listing | `FORBIDDEN`, `CONFLICT` |
| POST | `/api/listings/{id}/duplicate` | Owner | — | new draft | `FORBIDDEN`, `NOT_FOUND` |
| GET | `/api/listings/{id}/versions` | Owner or admin | — | `{ versions }` | `FORBIDDEN`, `NOT_FOUND` |
| POST | `/api/listings/{id}/contact-reveal` | Public, session preferred | `contactRevealBodySchema` | `{ value?, deepLink?, expiresAt }` | `RATE_LIMITED`, `NOT_FOUND` |
| POST | `/api/cron/expire` | Cron | `cronBodySchema` | `{ expired }` | `UNAUTHORIZED` |

`listingPatchBodySchema` is a three-stage union: `basics`, `details` (attributes and contact), `photos`. A sensitive edit of an active listing returns it to `pending`. Removed listings answer `410` on the public slug route once T3.1 implements the handler. Contact reveal is rate limited and must not be cached on a public CDN.

Publish gate (`evaluatePublishGate`): active account, adult attestation, age at least 18, `verificationStatus === "approved"`, `mediaCleared === true`, category enabled and not on the deny-list, attributes not on the deny-list.

## T4.1 Wallet, coupons, promotions, payments

| Method | Path | Auth | Schema | Response `data` | Errors |
|---|---|---|---|---|---|
| GET | `/api/wallet` | Session | — | `{ balance }` | `UNAUTHORIZED` |
| GET | `/api/wallet/entries` | Session | `walletQuerySchema` | `{ items, total }` | `UNAUTHORIZED` |
| POST | `/api/wallet/packs` | Session | `walletPackBodySchema` | `{ paymentId, balance }` | `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `PAYMENT_REQUIRED` |
| POST | `/api/coupons/redeem` | Session | `couponRedeemBodySchema` | `{ couponId, credit? }` | `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT` |
| GET | `/api/promotions/products` | Session | — | `{ products }` | `UNAUTHORIZED` |
| POST | `/api/promotions/checkout` | Session | `promotionCheckoutBodySchema` | `{ orderId, paymentId }` | `VALIDATION_ERROR`, `PAYMENT_REQUIRED`, `CONFLICT`, `POLICY_VIOLATION` |
| GET | `/api/promotions/orders` | Session | `pageQuerySchema` | `{ items, total }` | `UNAUTHORIZED` |
| POST | `/api/payments/webhook` | Provider signature | `paymentWebhookBodySchema` | `{ received: true }` | `UNAUTHORIZED`, `CONFLICT` |
| GET | `/api/billing/invoices` | Session | `pageQuerySchema` | `{ items }` | `UNAUTHORIZED` |
| POST | `/api/admin/refunds` | Admin `finance` | `refundBodySchema` | `{ refundId }` | `VALIDATION_ERROR`, `FORBIDDEN`, `CONFLICT` |
| POST | `/api/cron/boost` | Cron | `cronBodySchema` | `{ boosted }` | `UNAUTHORIZED` |

Wallet balance is the latest `WalletEntry.balanceAfter` for that user. A repeated `idempotencyKey` or provider `eventId` does not credit twice. Product codes must pass `productCodeDenied`. Default `PAYMENT_PROVIDER` is `mock`. Live capture stays off unless `ALLOW_LIVE_PAYMENTS=true`.

## T5.1 Search and catalogue

| Method | Path | Auth | Schema | Response `data` | Errors |
|---|---|---|---|---|---|
| GET | `/api/search` | Public | `searchQuerySchema` | `{ hits, total, facets }` | `VALIDATION_ERROR`, `RATE_LIMITED` |
| GET | `/api/categories` | Public | — | `{ categories }` enabled only | `RATE_LIMITED` |
| GET | `/api/locations` | Public | `locationQuerySchema` | `{ locations }` | `VALIDATION_ERROR` |
| GET | `/api/locations/{id}/children` | Public | — | `{ locations }` | `NOT_FOUND` |
| GET | `/api/locations/resolve` | Public | `locationResolveQuerySchema` | `{ chain }` | `NOT_FOUND` |
| GET | `/api/catalog` | Public | — | `{ categories, locations }` | `RATE_LIMITED` |

`oldSlugs` resolve to the current slug. The HTML search page is noindex. These reads use the V2 collections until T5.1 flips `V2` and `COLL_SUFFIX` and deletes `src/lib/models.ts`.

## T7.1 Admin, reports, moderation

| Method | Path | Auth | Schema | Response `data` | Errors |
|---|---|---|---|---|---|
| POST | `/api/reports` | Public or session | `reportCreateBodySchema` | `{ reportId }` | `VALIDATION_ERROR`, `NOT_FOUND`, `RATE_LIMITED` |
| GET | `/api/admin/listings` | Admin | `adminListingQuerySchema` | `{ items, total }` | `FORBIDDEN` |
| POST | `/api/admin/listings/{id}/decision` | Admin | `listingDecisionBodySchema` | `{ status }` | `VALIDATION_ERROR`, `FORBIDDEN`, `NOT_FOUND` |
| GET | `/api/admin/reports` | Admin | `pageQuerySchema` | `{ items, total }` | `FORBIDDEN` |
| PATCH | `/api/admin/reports/{id}` | Admin | `reportUpdateBodySchema` | report | `VALIDATION_ERROR`, `FORBIDDEN`, `NOT_FOUND` |
| GET | `/api/admin/moderation-cases` | Admin `trust_safety` | `pageQuerySchema` | `{ items, total }` | `FORBIDDEN` |
| POST | `/api/admin/moderation-cases/{id}/decision` | Admin `trust_safety` | `moderationDecisionBodySchema` | case | `VALIDATION_ERROR`, `FORBIDDEN`, `NOT_FOUND` |
| GET | `/api/admin/users` | Admin | `pageQuerySchema` | `{ items, total }` | `FORBIDDEN` |
| POST | `/api/admin/users/{id}/suspend` | Admin | `userSuspendBodySchema` | `{ status: "suspended" }` | `FORBIDDEN`, `NOT_FOUND` |
| POST | `/api/admin/users/{id}/reverify` | Admin `trust_safety` | `userReverifyBodySchema` | `{ verificationStatus }` | `FORBIDDEN`, `NOT_FOUND` |
| GET | `/api/admin/categories` | Admin | — | `{ items }` | `FORBIDDEN` |
| POST | `/api/admin/categories` | Admin | `categoryWriteBodySchema` | category | `VALIDATION_ERROR`, `POLICY_VIOLATION`, `CONFLICT` |
| PATCH | `/api/admin/categories/{id}` | Admin | `categoryWriteBodySchema` | category | `VALIDATION_ERROR`, `POLICY_VIOLATION`, `NOT_FOUND` |
| GET | `/api/admin/locations` | Admin | `locationQuerySchema` | `{ items }` | `FORBIDDEN` |
| POST | `/api/admin/locations` | Admin | `locationWriteBodySchema` | location | `VALIDATION_ERROR`, `CONFLICT` |
| PATCH | `/api/admin/locations/{id}` | Admin | `locationWriteBodySchema` | location | `VALIDATION_ERROR`, `NOT_FOUND` |
| GET | `/api/admin/products` | Admin `finance` | — | `{ items }` | `FORBIDDEN` |
| POST | `/api/admin/products` | Admin `finance` | `productWriteBodySchema` | product | `VALIDATION_ERROR`, `POLICY_VIOLATION`, `CONFLICT` |
| PATCH | `/api/admin/products/{id}` | Admin `finance` | `productWriteBodySchema` | product | `VALIDATION_ERROR`, `POLICY_VIOLATION`, `NOT_FOUND` |
| GET | `/api/admin/packs` | Admin `finance` | — | `{ items }` | `FORBIDDEN` |
| POST | `/api/admin/packs` | Admin `finance` | `packWriteBodySchema` | pack | `VALIDATION_ERROR`, `CONFLICT` |
| PATCH | `/api/admin/packs/{id}` | Admin `finance` | `packWriteBodySchema` | pack | `VALIDATION_ERROR`, `NOT_FOUND` |
| GET | `/api/admin/coupons` | Admin `finance` | — | `{ items }` | `FORBIDDEN` |
| POST | `/api/admin/coupons` | Admin `finance` | `couponWriteBodySchema` | coupon | `VALIDATION_ERROR`, `CONFLICT` |
| PATCH | `/api/admin/coupons/{id}` | Admin `finance` | `couponWriteBodySchema` | coupon | `VALIDATION_ERROR`, `NOT_FOUND` |
| GET | `/api/admin/banned-words` | Admin | — | `{ items }` | `FORBIDDEN` |
| POST | `/api/admin/banned-words` | Admin | `bannedWordBodySchema` | word | `VALIDATION_ERROR`, `CONFLICT` |
| PATCH | `/api/admin/banned-words/{id}` | Admin | `bannedWordBodySchema` | word | `VALIDATION_ERROR`, `NOT_FOUND` |
| GET | `/api/admin/seo/templates` | Admin `seo_editor` | — | `{ items }` | `FORBIDDEN` |
| POST | `/api/admin/seo/templates` | Admin `seo_editor` | `seoTemplateBodySchema` | template | `VALIDATION_ERROR`, `CONFLICT` |
| PATCH | `/api/admin/seo/templates/{id}` | Admin `seo_editor` | `seoTemplateBodySchema` | template | `VALIDATION_ERROR`, `NOT_FOUND` |
| GET | `/api/admin/seo/pages` | Admin `seo_editor` | — | `{ items }` | `FORBIDDEN` |
| PATCH | `/api/admin/seo/pages/{id}` | Admin `seo_editor` | `seoPageBodySchema` | page | `VALIDATION_ERROR`, `NOT_FOUND` |
| GET | `/api/admin/feature-flags` | Admin | — | `{ items }` | `FORBIDDEN` |
| PATCH | `/api/admin/feature-flags/{id}` | Admin | `featureFlagBodySchema` | flag | `VALIDATION_ERROR`, `NOT_FOUND` |
| GET | `/api/admin/audit` | Admin | `auditQuerySchema` | `{ events, total }` | `FORBIDDEN` |
| GET | `/api/admin/payments` | Admin `finance` | `pageQuerySchema` | `{ items, total }` | `FORBIDDEN` |
| GET | `/api/admin/list` | Admin | `adminListQuerySchema` | `{ items }` | `FORBIDDEN` |
| POST | `/api/admin/mutate` | Admin | `adminMutateBodySchema` | `{ ok: true }` | `VALIDATION_ERROR`, `FORBIDDEN`, `POLICY_VIOLATION` |

Listing decisions are `approve`, `reject`, `request_changes`, `pause`, `remove`. `remove` sets status `removed`. Severity `S0` on a report quarantines the listing. Every mutating admin route writes an `AuditEvent`. `GET /api/admin/audit` is read-only. The legacy `/api/admin/list` and `/api/admin/mutate` routes stay, and T2.1 replaces the Cursor-identity gate with the session plus role check.

## Saved, analytics, consent, health

These routes are part of the source contract so later tasks do not invent paths.

| Method | Path | Auth | Schema | Response `data` | Errors |
|---|---|---|---|---|---|
| GET | `/api/saved` | Session | `pageQuerySchema` | `{ items }` | `UNAUTHORIZED` |
| POST | `/api/saved/{listingId}` | Session | — | `{ ok: true }` | `UNAUTHORIZED`, `NOT_FOUND` |
| DELETE | `/api/saved/{listingId}` | Session | — | `{ ok: true }` | `UNAUTHORIZED`, `NOT_FOUND` |
| POST | `/api/saved/merge` | Session | `savedMergeBodySchema` | `{ added }` | `VALIDATION_ERROR`, `UNAUTHORIZED` |
| POST | `/api/recently-viewed` | Session optional | `recentViewBodySchema` | `{ ok: true }` | `VALIDATION_ERROR` |
| POST | `/api/analytics/events` | Public | `analyticsEventBodySchema` | `{ eventId }` | `VALIDATION_ERROR` |
| POST | `/api/consent` | Public | `consentBodySchema` | `{ ok: true }` | `VALIDATION_ERROR` |
| GET | `/api/health` | Public | — | `{ ok: true }` | `INTERNAL` |

Saved rows use the `Favourite` model. Analytics and consent do not have collections in T1.1. T6.1 owns sitemap and robots, which are pages, not these JSON routes.
