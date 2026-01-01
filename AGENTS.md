# Shopify eSIM Fulfillment – Agent Instructions

## Goal
Build a backend system that automatically provisions and delivers eSIMs
after a successful Shopify payment, using vendor APIs.

The system must be reliable, idempotent, and simple to operate for low volume
(≤ 1000 eSIMs total).

---

## High-level Architecture

- Shopify store handles products, checkout, and payment
- Shopify **Custom App** exists ONLY for:
  - Admin API access token
  - Webhook registration
  - Webhook HMAC verification secret
- All business logic lives in an external Node.js backend

One repository, two runtime processes:
- **API process**: receives Shopify webhooks, admin endpoints
- **Worker process**: provisions eSIMs, sends emails, marks fulfillment

No embedded Shopify UI.  
No App Bridge.  
No OAuth.  
No App Store listing.

---

## Shopify Integration

### Shopify Custom App (single store)
- Created in Shopify Admin
- Purpose:
  - Receive `orders/paid` webhook
  - Read orders + variant metafields
  - Create fulfillments
- Treated as credentials + permissions only (not a hosted service)

### Required API scopes
- read_orders
- read_fulfillments
- write_fulfillments
- read_metafields

### Webhooks
- `orders/paid`
- (optional later) `refunds/create`, `orders/cancelled`

---

## Vendor eSIM Portal Integration

### Source of truth for vendor API
- All API endpoints, request/response formats, authentication, error codes, and required headers
  for the eSIM portal MUST be implemented according to **FiRoam_documentation.pdf** (treat it as canonical).

### Implementation rules
- Wrap vendor API access behind a single module (e.g. `src/vendor/firoamClient.ts`)
- Normalize vendor responses into an internal “canonical eSIM payload” shape used by the app
- Never store vendor secrets in code; use environment variables only
- Encrypt sensitive payload fields at rest (LPA string, activation codes, ICCID if applicable)

---

## Product & Variant Modeling

- Each eSIM offer is a Shopify product
- Variants represent plan differences (data / duration / region)
- Variant metafields store vendor mapping:
  - vendor.planCode
  - vendor.productId
  - vendor.region
  - delivery.type (qr | activation_code)

Backend logic MUST rely on metafields, not product titles or SKUs.

---

## Backend Technology Choices (Dev-first)

- Node.js + TypeScript
- Fastify (or Express if preferred)
- Postgres as the primary database
- Prisma ORM + migrations
- Background jobs:
  - Preferred: pg-boss (Postgres-backed queue)
  - Alternative: BullMQ + Redis
- Email delivery: Postmark / SendGrid / AWS SES
- QR generation from vendor LPA string
- Sensitive fields (LPA, activation codes) encrypted at rest

---

## Runtime Processes

### API Process
Responsibilities:
- Receive `orders/paid` webhook
- Verify Shopify HMAC signature
- Perform idempotency check (order_id + line_item_id)
- Persist delivery records
- Enqueue provisioning job
- Return HTTP 200 quickly

Also exposes:
- Admin endpoints (protected):
  - resend delivery
  - view status
  - manual retry
- Optional customer retrieval endpoint:
  - GET /delivery/:token

### Worker Process
Responsibilities:
- Dequeue provisioning jobs
- Fetch order + variant metafields if needed
- Call vendor API (per **FiRoam_documentation.txt**) to issue eSIM
- Normalize vendor payload
- Persist result in database
- Generate QR code
- Send delivery email
- Create fulfillment in Shopify
- Update delivery status

Implements:
- Retries with backoff
- Terminal failure state after max attempts

---

## Data Model (Minimum)

### esim_deliveries
- id
- shop
- order_id
- order_name
- line_item_id
- variant_id
- customer_email
- vendor_reference_id
- payload_encrypted (LPA / activation info)
- status: pending | provisioning | delivered | failed | refunded
- last_error
- timestamps

### delivery_attempts
- delivery_id
- channel (email)
- result
- timestamps

### jobs
- managed by queue system (pg-boss or BullMQ)

---

## Delivery Strategy

Primary:
- Email with:
  - QR code
  - fallback activation codes
  - setup instructions (iOS / Android)
  - link to retrieval page

Secondary:
- Optional retrieval page for re-access:
  - GET /delivery/:token
  - Token-based auth
  - Shows QR + instructions

---

## Reliability Rules (Non-negotiable)

- Never provision eSIM inside webhook handler
- Webhook handler must be idempotent
- All vendor calls happen in worker jobs
- Shopify webhook retries must not cause duplicate provisioning
- Failures are logged and retry-limited
- Manual resend must be possible

---

## What Is Explicitly Out of Scope (for MVP)

- Embedded Shopify UI
- App Store distribution
- Multi-store support
- Advanced fraud detection
- Autoscaling / multi-region
- Kubernetes

---

## Deployment (Later, Not Blocking Dev)

- PaaS (Render / Railway / Fly) with:
  - one API service
  - one Worker service
  - managed Postgres
- Can migrate to AWS/GCP later with minimal changes

---

## Success Criteria

- Customer receives eSIM within minutes of payment
- Duplicate provisioning never happens
- Failed deliveries are visible and recoverable
- Backend is simple to reason about and extend