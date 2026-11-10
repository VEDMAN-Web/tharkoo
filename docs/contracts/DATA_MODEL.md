# Data model

Mongo collections for the T1.1 models in `src/server/models`. UI and later API tasks use these names. Mongoose is 9.x. Every schema has an explicit TypeScript interface. Nothing uses `InferSchemaType`.

Import from `@/server/models`. Do not import these models from client components. Do not write the pre-T1.1 collections from this layer.

## Coexistence

`src/lib/models.ts` stays until T5.1. New code and that file share one Mongoose connection.

`src/server/models/names.ts` exports `V2` (`"V2"`) and `COLL_SUFFIX` (`"_v2"`). A model whose name already exists in `src/lib/models.ts` is registered as `<Name>V2` on collection `<collection>_v2`. Registration is `mongoose.models[name] ?? mongoose.model(...)`.

| Export | Mongoose name | Collection |
|---|---|---|
| `Category` | `CategoryV2` | `categories_v2` |
| `Location` | `LocationV2` | `locations_v2` |
| `Listing` | `ListingV2` | `listings_v2` |
| `Coupon` | `CouponV2` | `coupons_v2` |
| `Product` | `ProductV2` | `products_v2` |
| `CreditPack` | `CreditPackV2` | `credit_packs_v2` |
| `Site` | `SiteV2` | `sites_v2` |
| `Page` | `PageV2` | `pages_v2` |
| `HelpArticle` | `HelpArticleV2` | `help_articles_v2` |
| `BlogPost` | `BlogPostV2` | `blog_posts_v2` |
| `Banner` | `BannerV2` | `banners_v2` |
| `BannedWord` | `BannedWordV2` | `banned_words_v2` |
| `FeatureFlag` | `FeatureFlagV2` | `feature_flags_v2` |
| `AttributeGroup` | `AttributeGroupV2` | `attribute_groups_v2` |
| `SeoTemplate` | `SeoTemplateV2` | `seo_templates_v2` |

`Category`, `Location`, and `Listing` here are the new documents (owner, status machine, field definitions, five location levels). They are not copies of the old CMS-shaped documents. Those old documents remain in the un-suffixed collections until T5.1 deletes `src/lib/models.ts` and flips `V2` to `""` and `COLL_SUFFIX` to `""`.

New names use plain model names and collections: `User`, `Session`, `EmailVerificationToken`, `PasswordResetToken`, `IdentityVerification`, `ListingVersion`, `MediaAsset`, `Favourite`, `Thread`, `Message`, `Report`, `ModerationCase`, `PromotionProduct`, `PromotionOrder`, `Payment`, `WalletEntry`, `AuditEvent`, `ContentPage`, `SiteSettings`, `SeedBackup`.

## Append-only

`AuditEvent` (`audit_events`), `ListingVersion` (`listing_versions`), and `WalletEntry` (`wallet_entries`) use `appendOnlyPlugin` and `lockBulkWrites`. Update, delete, replace, and any bulk write other than `insertOne` throw `AppendOnlyError`. Insert and find are allowed. No TTL on `audit_events`.

`AuditRepository` exposes `append` and `list` only. `redact` replaces `passwordHash`, `tokenHash`, `contact`, `documentRef`, `password`, `token`, and `hashes` with `[redacted]` before a snapshot is stored.

## Users and sessions

`users`: `email` unique, `passwordHash` (`select: false`), `displayName`, `dateOfBirth`, `attestedAdultAt`, `emailVerifiedAt?`, `roles` default `["user"]`, `verificationStatus` (`unsubmitted`, `pending_review`, `approved`, `rejected`), `verificationId?`, `status` (`active`, `suspended`, `deleted`), timestamps.

`sessions`: `userId`, `tokenHash` unique, `userAgent?`, `ipHash?`, `expiresAt` TTL, `revokedAt?`.

`email_verification_tokens` and `password_reset_tokens`: `userId`, `tokenHash` unique, `expiresAt` TTL, `usedAt?`.

`identity_verifications`: `userId`, `provider` (`manual` or `vendor`), `documentRef`, `status` (`pending_review`, `approved`, `rejected`), `dateOfBirthAsserted`, `reviewerId?`, `decisionReason?`, `decidedAt?`.

## Catalogue

`categories_v2`: `slug` unique, `name`, `description`, `parentId`, `enabled`, `order`, `fields[]` (key, label, type, required, options, min, max, unit, order, enabled, filterable, shownOnCard, placeholder, optionLabels), `oldSlugs`, `deletedAt`, SEO fields (`seoTitle`, `seoDescription`, templates, `h1`, `introHtml`, `faqs`, `noindex`, `canonicalOverride`, `minListingsIndex` default 3, `minListingsLocality` default 10), `seedBatch`. Indexes: `{ parentId, order }`, `{ oldSlugs }`.

Field types: `text`, `textarea`, `number`, `select`, `multiselect`, `boolean`, `bool`, `date`, `range`. Listing attributes are parsed with `parseListingAttributes`.

`locations_v2`: `type` is `country`, `state`, `city`, `district`, or `locality`. `slug`, `name`, `parentId`, `enabled`, `order`, `countryCode` default `IN`, `oldSlugs`, SEO fields, `landingHtml`, `seedBatch`. Unique index `{ parentId, type, slug }`.

Category slugs, attribute keys, and product codes are rejected by `categoryDenied`, `attributeKeyDenied`, and `productCodeDenied`. The term lists are built in `src/server/shared/policy.ts` from joined fragments so the forbidden-terms scanner does not see the contiguous spellings. Allowed product codes: `featured`, `top`, `highlight`, `homepage`, `category`, `city`, `free`, `auto-boost`, `super-top`, `new`, `flash`, `star`.

## Listings and media

`listings_v2`: `ownerId`, `status` (`draft`, `pending`, `active`, `rejected`, `paused`, `expired`, `archived`, `removed`, `deleted`), `categoryId`, `stateId`, `cityId`, `districtId`, `localityId`, `title`, `slug` sparse unique, `description`, `attributes`, `contact` (`phone`, `whatsapp`, `telegram`, `acceptForm`, `select: false`), `mediaIds`, `coverMediaId`, `badges`, `qualityScore`, `publishedAt`, `expiresAt`, `lastModerationAt`, `seoNoindex` default true, `attestations`. Indexes: status + category + city + publishedAt, owner + status, text on title and description.

`listing_versions`: `listingId`, `version`, `snapshot`, `actorId`. Append-only.

`media_assets`: `ownerId`, `listingId?`, `kind` (`image`, `video`, `id_document`), `objectKey`, `thumbKey?`, `status` (`uploaded`, `scanning`, `processing`, `cleared`, `rejected_csam`, `rejected_policy`, `failed`, `deleted`), `hashes.sha256`, `csamMatch?` (ids only), `contentType`, `bytes`, `clearedAt`.

`favourites`: unique `{ userId, listingId }`.

`threads`: unique `{ listingId, buyerId }`, plus buyer and seller recency indexes. `messages`: `threadId`, `senderId`, `body` max 2000.

## Reports and moderation

`reports`: `listingId`, `reporterUserId?`, `reporterIpHash?`, `reason` (`prohibited_content`, `trafficking_concern`, `stolen_media`, `spam`, `fake`, `duplicate`, `wrong_contact`, `other`), `details`, `severity` (`S0`–`S3`), `status` (`open`, `ack`, `actioned`, `dismissed`), SLA dates, `assigneeId?`, `note`. Index `{ status, severity, createdAt }`.

`moderation_cases`: `type` (`prepublish`, `sensitive_edit`, `auto_classifier`, `csam`, `trafficking`, `report_escalation`), optional listing, user, and media ids, `severity`, `status` (`open`, `in_progress`, `closed`), `flags`, `decision`, `mandatoryReportStatus` (`required`, `filed`, `n/a`), `closedAt`.

## Billing

`promotion_products`: `code` unique, `name`, `description`, `amount`, `currency`, `durationDays`, `enabled`, `seedBatch`.

`promotion_orders`: `userId`, `listingId`, `productId`, `status` (`pending`, `active`, `failed`), `durationDays`, `startsAt`, `endsAt`. Index `{ listingId, status, endsAt }`.

`payments`: `userId`, `orderId`, `idempotencyKey` unique, `provider` default `mock`, `providerRef`, `providerEventId` sparse unique, `amount`, `currency`, `status` (`pending`, `paid`, `failed`).

`wallet_entries` (append-only): `userId`, `delta`, `reason`, `refType`, `refId`, `balanceAfter`, `idempotencyKey` unique. Index `{ userId, createdAt }`. Balance is the latest `balanceAfter`, not a stored counter.

`coupons_v2` keeps the CMS fields `code`, `label`, `value`, `expiry`, `status` and adds `kind` (`percent`, `credits`, `label`), `percent`, `credits`, `maxRedemptions`, `perUserLimit`, `redeemedCount`, `expiresAt`. `code` is sparse unique.

`credit_packs_v2`: `credits`, `price`, `bonus`, `tag`, `order`, `status`.

`products_v2`: CMS product row (`name`, `slug`, `benefits`, `credits`, `status`). Placement SKUs that are sold live on `promotion_products`.

## CMS and platform

`sites_v2`, `pages_v2`, `help_articles_v2`, `blog_posts_v2`, `banners_v2`, `banned_words_v2`, `feature_flags_v2`, `attribute_groups_v2`, and `seo_templates_v2` match the fields in `src/lib/models.ts`, on the `_v2` collections.

`content_pages`: `slug` unique, `title`, `body`, `metaDescription`, `canonical`, `noindex`, `enabled`, `deletedAt`. This is not `Page` / `pages_v2`.

`site_settings`: single-row style `key` unique default `site`, org and contact fields, `cityCategoryThreshold` default 3, `localityThreshold` default 10, default title and description templates. This is not `Site` / `sites_v2`.

`seed_backups`: `batch`, `takenAt`, `counts` (`locations`, `categories`, `promotion_products`), `collections` mixed. T1.2 uses this for rollback.

## Not modeled in T1.1

Phone OTP challenges, refund documents, contact-reveal events, analytics events, and consent records have request schemas in the API contract and no collection yet. The task that implements each route adds the collection if it needs one.

## Publish invariant

A listing becomes `active` only when `evaluatePublishGate` returns `{ ok: true }`: account `active`, adult attestation, age at least 18, verification `approved`, every media id `cleared`, category enabled and allowed, attributes allowed. `seoNoindex` stays true until an admin approve.
