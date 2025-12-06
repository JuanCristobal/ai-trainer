## 🚨 Critical Vulnerabilities (Must Fix Before Deploy)
- **Issue:** `yt-dlp` option injection enables arbitrary command execution  
  **Location:** gateway/main.py:100-134, worker/main.py:38-109, worker/preview.py:9-120  
  **Impact:** Attacker-controlled URLs are passed directly as CLI args without `--` delimiting or validation, letting adversaries smuggle `yt-dlp` options such as `--exec`/`--postprocessor-args` to run arbitrary system commands inside the containers. Compromise of worker and gateway hosts leads to full service takeover and potential lateral movement.  
  **Attack Vector:** Submit a URL starting with a dash (e.g., `--exec=sh {}` or `--output=/tmp/pwn`) to `/api/cart/add`, `/api/preview`, or any flow that dispatches a job; `yt-dlp` interprets it as options and executes attacker-supplied commands.

- **Issue:** Unauthenticated dev payment endpoint bypasses billing  
  **Location:** gateway/main.py:307-337; frontend/app.js:254-278  
  **Impact:** `/api/dev/pay` triggers `process_successful_payment` without Stripe verification, moving cart items into the transcription queue and logging a fake sale. Anyone can obtain unlimited full transcriptions for free in production.  
  **Attack Vector:** POST `{ "session_id": "<target session>" }` to `/api/dev/pay` (button is exposed in the UI) to enqueue paid jobs without completing real checkout or a valid webhook.

## ⚠️ Medium Risks (Logic & Abuse)
- **Issue:** 30-minute limit enforced only by client-side metadata; worker processes any length  
  **Location:** gateway/main.py:93-135, worker/main.py:68-154  
  **Impact:** A user can supply videos whose metadata underreports duration (self-hosted or malformed streams). Worker downloads and transcribes the entire audio with no hard cap, leading to unbounded CPU/storage use and service exhaustion.  
  **Attack Vector:** Host a multi-hour stream that advertises a tiny duration, add to cart, pay (or use dev pay), and the worker will attempt the full transcription.

- **Issue:** No rate limiting or job quota across public APIs  
  **Location:** gateway/main.py (all `/api/*` routes)  
  **Impact:** Attackers can spam `/api/preview`, `/api/cart/add`, or checkout endpoints to tie up Redis, Stripe, and worker resources, causing DoS for legitimate users.  
  **Attack Vector:** Script thousands of preview or cart requests per second with random `session_id` values.

- **Issue:** Redis cart/session keys are attacker-chosen and long-lived  
  **Location:** gateway/main.py:145-229  
  **Impact:** Unauthenticated users control `session_id` values; each cart persists 24h. Bots can generate millions of unique IDs to fill Redis memory and degrade performance.  
  **Attack Vector:** Flood `/api/cart/add` with unique `session_id` values to accumulate `cart:*` hashes until Redis OOM.

- **Issue:** Internal network/SSRF exposure via `yt-dlp` fetches  
  **Location:** gateway/main.py:100-134, worker/main.py:38-109, worker/preview.py:40-71  
  **Impact:** `yt-dlp` will fetch arbitrary URLs; attackers can target internal HTTP services or cloud metadata endpoints from both gateway and worker containers.  
  **Attack Vector:** Provide `http://169.254.169.254/latest/meta-data/` or internal service URLs as the video URL.

- **Issue:** Fully permissive CORS with credentials  
  **Location:** gateway/main.py:62-69  
  **Impact:** All origins with `allow_credentials=True` allow any website to perform authenticated actions if cookies or future auth headers are introduced; even today it enables cross-site abuse of the session-based cart.  
  **Attack Vector:** Malicious site issues XHRs to the API on behalf of visitors.

- **Issue:** No authorization on job/result retrieval  
  **Location:** gateway/main.py:196-206, 339-382  
  **Impact:** Anyone who learns or guesses a `job_id` or `session_id` can read job status or download transcripts; job IDs are UUIDs but may be exposed in logs or guessable via leaked session history.  
  **Attack Vector:** Poll `/api/job/{job_id}` or `/api/download/{job_id}` with IDs obtained from shared machines or log access.

## ℹ️ QA Observations (Edge Cases & Bugs)
- **Issue:** Whisper cleanup may crash on download failures  
  **Location:** worker/main.py:68-109  
  **Impact:** If the audio download fails before `audio_path` is set, `os.path.exists(audio_path)` raises a `TypeError`, masking the original failure and leaving jobs marked failed without clear reason.  
  **Attack Vector:** Trigger a download error (invalid URL/network drop); job fails with secondary exception.

- **Issue:** Gateway metadata fetch lacks timeouts and returns tool stderr to clients  
  **Location:** gateway/main.py:100-135  
  **Impact:** Hung `yt-dlp` processes can block request workers; stderr content may leak internal paths or package versions to users.  
  **Attack Vector:** Point to a slow or non-responsive endpoint to stall workers; inspect error detail in API responses for environment info.

- **Issue:** Worker downloads/transcribes without network or runtime timeouts  
  **Location:** worker/main.py:68-154, worker/preview.py:33-115  
  **Impact:** Long downloads or model runs can hang a worker indefinitely, reducing throughput and complicating recovery; preview kills ffmpeg after 45s but not `yt-dlp`.  
  **Attack Vector:** Provide a slow streaming source to keep the worker busy until manual intervention.
