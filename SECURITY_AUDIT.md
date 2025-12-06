## 🚨 Critical Vulnerabilities (Must Fix Before Deploy)
- **Issue:** None observed at this time  
  Current mitigations (URL validation, `--` barriers, timeouts, and dev-pay gating) address the previously noted critical paths. Remaining issues are listed below as medium/QA items.

## ⚠️ Medium Risks (Logic & Abuse)
- **Issue:** No rate limiting or job quotas on public APIs  
  **Location:** gateway/main.py (all `/api/*` routes)  
  **Impact:** Attackers can spam `/api/preview`, `/api/cart/add`, or checkout endpoints to tie up Redis, Stripe, and worker resources, causing DoS for legitimate users.  
  **Attack Vector:** Script thousands of preview or cart requests per second with random `session_id` values.

- **Issue:** Redis cart/session keys remain attacker-chosen and long-lived  
  **Location:** gateway/main.py:124-196  
  **Impact:** Unauthenticated users control `session_id` values; each cart persists 24h. Bots can generate massive numbers of unique IDs to fill Redis memory and degrade performance.  
  **Attack Vector:** Flood `/api/cart/add` with unique `session_id` values to accumulate `cart:*` hashes until Redis OOM.

- **Issue:** Internal network/SSRF exposure still possible via `yt-dlp` fetches  
  **Location:** gateway/main.py:93-158; worker/main.py:31-105; worker/preview.py:31-79  
  **Impact:** Domain validation allows generic `http(s)` hosts (including IPs); `yt-dlp` will fetch attacker-supplied URLs from both gateway and worker containers, enabling probing of internal services/metadata.  
  **Attack Vector:** Supply `http://169.254.169.254/latest/meta-data/` or internal service URLs as the video URL; requests are made server-side during metadata, preview, or transcription.

- **Issue:** Fully permissive CORS with credentials  
  **Location:** gateway/main.py:44-51  
  **Impact:** All origins with `allow_credentials=True` allow any website to perform API actions if browser credentials (cookies/Authorization) are ever introduced; today it enables cross-site abuse of session-based cart data.  
  **Attack Vector:** Malicious site issues XHRs to the API on behalf of visitors, manipulating their session IDs stored in localStorage.

- **Issue:** No authorization on job/result retrieval  
  **Location:** gateway/main.py:188-242, 300-344  
  **Impact:** Anyone who learns or guesses a `job_id` or `session_id` can read job status or download transcripts; IDs are UUIDs but may leak via logs or shared machines.  
  **Attack Vector:** Poll `/api/job/{job_id}` or `/api/download/{job_id}` with IDs obtained from browser storage or logs.

- **Issue:** 30-minute limit still relies on metadata and is not enforced in worker  
  **Location:** gateway/main.py:65-124; worker/main.py:76-152  
  **Impact:** If a source underreports duration (self-hosted/malformed streams), the worker downloads and transcribes the full audio with no hard cap, causing unbounded CPU/storage use.  
  **Attack Vector:** Host a multi-hour stream advertising a short duration; add to cart and process to force a long-running worker job.

## ℹ️ QA Observations (Edge Cases & Bugs)
- **Issue:** Preview path lacks `yt-dlp` timeout  
  **Location:** worker/preview.py:31-88  
  **Impact:** The preview pipeline only times out ffmpeg (45s); `yt-dlp` can hang indefinitely, tying up a worker process.  
  **Attack Vector:** Provide a slow or stalled stream; worker blocks until manually killed.

- **Issue:** Job/session access lacks authentication but is front-end accessible  
  **Location:** frontend/app.js:247-285 (dev pay UI still present)  
  **Impact:** Although `/api/dev/pay` is gated by `ENV`, the button remains; users will hit a 403 in non-dev environments and may report errors.  
  **Attack Vector:** Click “Dev Pay” in production; request is rejected but creates noisy errors.

- **Issue:** Stripe success URL includes session_id in query string  
  **Location:** gateway/main.py:226-236  
  **Impact:** Session IDs travel in redirect URLs and browser history; if logs/analytics capture them, they could be used to fetch job status/results due to missing auth.  
  **Attack Vector:** Access server/browser logs containing the `downloads.html?session_id=` URL and reuse it to query jobs.
