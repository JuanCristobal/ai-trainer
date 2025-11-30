# Gemini Context: Video Transcript Downloader Project

## Project Overview
This project is a web application designed to allow users to extract transcripts and metadata from video links (YouTube, Instagram, TikTok). The primary target audience is LLM power users and developers.

**Core Functionality (Batch/Cart Model):**
1.  **Guest Cart:** Users build a list of video URLs without logging in.
2.  **Dynamic Pricing:** The backend fetches video duration immediately upon addition to the cart and calculates a price (Base + Per Minute).
3.  **Batch Payment:** User pays the total cart amount in one Stripe transaction.
4.  **Batch Processing:** Upon successful payment, the system processes all videos in the queue.
5.  **Hybrid Transcription:** Extracts subtitles (via `yt-dlp`) or generates them using OpenAI Whisper (running locally via `faster-whisper`).
6.  **Download:** User downloads the result as Markdown, Transcript, or JSON.

## Technical Architecture
The system follows a strict **Microservices Architecture**:

*   **Frontend:**
    *   **Technology:** Modern Vanilla JavaScript (ES6+) & Pure CSS.
    *   **Style:** "Gumroad/Brutalist" aesthetic.
    *   **State:** `session_id` stored in LocalStorage.
*   **Backend:**
    *   **Service A (API Gateway):** Python (FastAPI). Handles Cart management, Metadata fetching (`yt-dlp --dump-json`), Dynamic Pricing, Stripe Webhooks.
    *   **Service B (Worker/Processor):** Python. Handles heavy compute tasks (`yt-dlp` download and `faster-whisper` inference).
    *   **Communication:** Redis (Message Broker/Queue).
*   **Database:** Supabase (PostgreSQL) - Log metadata only.
*   **Storage:** Redis (Ephemeral storage for results with 1h TTL).

## Key Constraints
*   **Video Limit:** Max 30 minutes per video.
*   **Worker Concurrency:** 1 job at a time per container.
*   **Model:** `faster-whisper` (`base` model).
*   **Pricing Logic:** Duration-based.

## Current Status
**Phase:** Planning Complete. Ready for Implementation.

## Key Files
*   `requiremnts.md`: Initial requirements (partially superseded by Cart logic).
*   `PROJECT_PLAN.md`: The definitive execution roadmap.