# Role: Senior Software Architect & Developer

# Objective
I need you to plan the technical architecture for a web application based on the requirements below.

# Output Requirement (CRITICAL)
**DO NOT generate the Project Plan or Code yet.**
Instead, adopt a "Measure Twice, Cut Once" philosophy:
1.  Analyze the requirements I provide below deeply.
2.  Identify ANY ambiguity, edge case, or potential technical blocker (especially regarding the Microservices communication, Stripe flow, or Whisper implementation).
3.  **Ask me a series of clarifying questions.** Be extremely specific. Grill me on the details until you are 100% sure you have the full picture.
4.  **Wait for my answers.** Only once I answer your questions and give you the "Green Light", you will proceed to generate the final `PROJECT_PLAN.md`.

---

# Project Requirements & Answers

## Q1: Core Functionality & Data Handling
* **Goal:** Users paste a link (YouTube, Instagram, TikTok) and the app downloads a Markdown (.md), transcript, or JSON file.
* **Transcription Logic (Hybrid Strategy):**
    1.  **Priority 1:** Extract existing subtitles using `yt-dlp` (fast/free).
    2.  **Priority 2:** If no subtitles exist, download audio and use **OpenAI Whisper (Open Source via `faster-whisper`)** running locally on the backend worker.

## Q2: Target Audience
* LLM power users & Developers.
* Platform: Web App.

## Q3: User Flow
* **No Sign Up:** Guest checkout logic (frictionless).

## Q4: Monetization
* One-time purchase per download via Stripe.

## Q5: Tech Stack & Constraints
* **Frontend:**
    * **Styles:** **Pure CSS** (CSS Variables). No frameworks (No Tailwind/Bootstrap).
    * **Logic:** **Modern Vanilla JavaScript (ES6+)**. Standard `fetch`. No build steps.
* **Backend:** **Python (FastAPI)**.
* **Database:** **Supabase** (PostgreSQL).
    * *Rule:* Only log metadata. Content is ephemeral (deleted immediately after download).
* **Architecture:** **Microservices Architecture (Strict).**
    * **Service A (API Gateway):** Handles User Requests, Stripe Webhooks, Supabase logging.
    * **Service B (Worker/Processor):** Handles `yt-dlp` and `faster-whisper` (heavy compute).
    * **Communication:** **Redis** (Message Broker/Queue). Designed to be Kafka-ready in the future.
* **Hosting:** Railway.app (Dockerized).

## Q6: MVP Scope & Design
* **Timeline:** Max 1 month.
* **Design Reference:** `https://github.com/antiwork/gumroad`
    * **Instruction:** This repository contains the full Ruby on Rails source code. **Ignore the backend logic.**
    * **Task:** Analyze the frontend assets (`app/assets/stylesheets` or similar) to extract the **Visual Identity** (Color palette, Borders, Typography, Spacing).
    * **Requirement:** Replicate this exact "Gumroad/Brutalist Style" using ONLY **Pure CSS**.

---

# Action
Start the interrogation. Ask me your first set of critical questions now.