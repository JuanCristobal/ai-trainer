# Project Plan: AI Video Transcriber (Batch/Cart Edition)

## Phase 1: Infrastructure & Foundation (Days 1-3)
**Goal:** Set up the "Plumbing" (Docker, Redis, Stripe, Supabase).

### 1.1 Project Structure & Docker
*   [ ] Create monorepo structure:
    *   `/frontend` (Static files served by Nginx or FastAPI static mount)
    *   `/gateway` (FastAPI)
    *   `/worker` (Python Consumer)
*   [ ] Create `docker-compose.yml` for local dev (Gateway, Worker, Redis).
*   [ ] Configure `Dockerfile` for Gateway (Lightweight).
*   [ ] Configure `Dockerfile` for Worker (Heavyweight - needs `ffmpeg`, `git`, `python 3.10+`).

### 1.2 Redis Schema Definition
*   [ ] Implement Redis Helper Class in Shared Lib.
*   [ ] Define Keys:
    *   `cart:{session_id}` (Hash: URL -> Metadata/Price) - TTL 24h.
    *   `jobs:{session_id}` (List: Job IDs) - Created after payment.
    *   `job:{job_id}` (Hash: Status, Result, Progress) - TTL 1h.
    *   `queue:transcription` (List: Job Payloads).

### 1.3 Pricing Logic Module
*   [ ] Implement `PricingService`:
    *   Input: Duration (seconds).
    *   Logic: `Base ($0.20) + ($0.10 * Duration_Minutes)`.
    *   Constraint: Throw error if Duration > 30 mins.

---

## Phase 2: The Cart Engine (Gateway Service) (Days 4-10)
**Goal:** Allow users to add videos, get prices, and see their cart.

### 2.1 Metadata Extractor
*   [ ] Implement `yt-dlp` wrapper in Gateway.
*   [ ] Command: `yt-dlp --dump-json --flat-playlist {url}`.
*   [ ] Extract: Title, Duration, Thumbnail, Platform.

### 2.2 Cart API Endpoints
*   [ ] `POST /api/cart/add`:
    *   Input: `{ session_id, url }`.
    *   Action: Fetch Metadata -> Calculate Price -> Save to Redis `cart:{session_id}`.
*   [ ] `GET /api/cart`:
    *   Input: `session_id`.
    *   Output: List of items + Total Price.
*   [ ] `DELETE /api/cart/{item_id}`: Remove item.

### 2.3 Stripe Integration
*   [ ] `POST /api/checkout`:
    *   Calculate Total from Redis Cart.
    *   Create Stripe Checkout Session (Metadata: `session_id`).
*   [ ] `POST /api/webhook/stripe`:
    *   Verify Signature.
    *   On `checkout.session.completed`:
        *   Retrieve `session_id`.
        *   Move items from `cart:{session_id}` to `queue:transcription`.
        *   Initialize `job:{job_id}` keys with status `queued`.

---

## Phase 3: The Worker Service (Days 11-18)
**Goal:** Process the Queue (The Heavy Lifting).

### 3.1 Queue Consumer
*   [ ] Implement blocking pop (`BLPOP`) from `queue:transcription`.
*   [ ] Ensure single concurrency (Mutex or simple loop).

### 3.2 Transcription Logic (The Core)
*   [ ] **Step 1 (Subtitles):** Try `yt-dlp --write-sub --skip-download`.
    *   If success -> Parse VTT -> Convert to JSON/MD -> Save to Redis -> Mark Done.
*   [ ] **Step 2 (Whisper):**
    *   If Step 1 fails:
        *   Download Audio: `yt-dlp -x --audio-format mp3 ...`.
        *   Run `faster-whisper` (`base` model).
        *   Output -> JSON/MD -> Save to Redis -> Mark Done.
*   [ ] **Error Handling:** Handle timeouts/failures gracefully (Update Redis status to `error`).

---

## Phase 4: Frontend (Vanilla JS & Pure CSS) (Days 19-25)
**Goal:** The Gumroad-style UI.

### 4.1 Visual Setup
*   [ ] Create `variables.css` (Colors, Spacing, Typography based on Gumroad).
*   [ ] Create `layout.css` (Flexbox/Grid structures).

### 4.2 Logic Implementation (No Bundler)
*   [ ] `app.js`:
    *   Generate/Retrieve `session_id` from localStorage.
    *   Handle "Paste Link" -> `fetch('/api/cart/add')`.
    *   Render Cart Items (DOM manipulation).
*   [ ] **Result Polling:**
    *   After success return from Stripe, redirect to `/downloads.html`.
    *   Poll `GET /api/jobs?session_id=...` every 3s.
    *   Update UI (Progress bars -> Download Buttons).

---

## Phase 5: Deployment & QA (Days 26-30)
*   [ ] Deploy to Railway.app.
*   [ ] Configure Environment Variables (Stripe Keys, Redis URL, Supabase URL).
*   [ ] Test "Guest Cart" flow end-to-end.
*   [ ] Stress Test: Add 5 videos to cart -> Pay -> Verify Worker processes them 1-by-1.
