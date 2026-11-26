# APP_DECISIONS.md

## Store concept — Morrow & Moss

Morrow & Moss is a fictional premium indoor-plant and plant-care retailer. The visual direction uses warm ivory, deep forest green, muted sage, editorial typography, and generous product photography. The audience is design-conscious plant owners who want straightforward product discovery and practical care guidance.

The theme includes Home, Collection, Product, and Cart templates, reusable editorial/merchandising sections, and a Plant Care Bundle Builder. The builder creates a curated set of normal Shopify cart line items (plant + pot + care item). This avoids pretending a client-side bundle is a native discounted Shopify bundle.

## App idea — StockPilot

StockPilot is an embedded inventory decision-support app for small Shopify merchants. It ranks products by replenishment urgency, gives merchants an editable restock workflow, and records activity so decisions are explainable.

### Priority score

The demo score is composed of three normalized signals:

- Stockout risk (50%): urgency rises as days of stock coverage falls below supplier lead time.
- Sales velocity (30%): higher daily unit sales increase urgency.
- Lead-time exposure (20%): longer supplier lead time increases the need to act early.

The result is clamped to 0–100. Days of coverage is `available quantity / average daily units sold`. If average sales are zero or unavailable, the UI labels coverage as unknown and the score avoids division by zero. The demo uses seeded values; a production app must calculate sales velocity from Shopify orders over a documented lookback window and account for returns, draft/cancelled orders, inventory locations, and seasonality.

## Architecture and schema decisions

- **Liquid theme:** Native Shopify theme architecture keeps storefront rendering close to Shopify's Online Store and avoids unnecessary client-side rendering. JavaScript is limited to the bundle builder and cart interactions.
- **Vite + React:** Fast local iteration for the admin UI while honoring the requested frontend stack.
- **Node.js + Express:** A small API boundary separates browser UI from credentials, Shopify API calls, and persistence.
- **Drizzle + MySQL:** Typed schema and explicit SQL migrations make relational constraints and query behavior visible.
- **Shop tenancy:** `shops` is the tenant root. Products, snapshots, plans, and logs reference a shop, so reads and writes can be scoped to one merchant.
- **History:** Inventory snapshots preserve dated stock observations; activity logs capture user/system actions; restock plans represent an editable workflow rather than transient UI state.
- **Embedded auth:** Shopify App Bridge ID tokens are exchanged server-side for offline Admin API access tokens. Secrets never enter the browser bundle.

## Shopify synchronization

The embedded app uses App Bridge ID tokens for browser-to-server authentication. The API exchanges the ID token server-side for an offline Admin API access token. The Inventory view exposes a manual product synchronization action when demo mode is disabled. It fetches the first page of Shopify products and variants, aggregates available inventory across variants, upserts shop-scoped product records, writes inventory snapshots, and records an activity event. This is an initial integration, not a complete catalog sync: cursor pagination, location-level inventory, webhook-driven updates, and order-derived sales velocity remain future work.

## Tradeoffs

- The first iteration uses clearly labelled mock data to keep development moving before a Shopify store and app credentials exist.
- The initial score is explainable and deterministic rather than machine-learning based. This is easier for merchants to trust and easier to test.
- The bundle builder adds individual variants to cart. A true discounted bundle would need Shopify Bundles or a server-side discount strategy and additional validation.
- The initial schema stores product-level inventory fields for the demo. A production version should model variants and inventory levels per Shopify location.

## What I would improve with more time

1. Extend the initial Shopify GraphQL product/inventory sync with cursor pagination, location-level inventory, order-derived sales velocity, and webhooks with idempotent processing.
2. Model inventory per variant and location, and calculate sales velocity from fulfilled/eligible orders over configurable periods.
3. Encrypt access tokens at rest, rotate secrets, implement uninstall cleanup, webhook HMAC verification, rate-limit/backoff handling, and tenant isolation tests.
4. Add supplier records, purchase-order export, CSV import, and configurable safety-stock policies.
5. Add automated unit, integration, accessibility, and theme tests; deploy the app and test against a real development store.
6. Improve bundle UX with availability checks, native discount configuration, and analytics for bundle conversion.
