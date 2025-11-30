# Project Handover: Frontend Implementation

**Current Status:**
*   Backend (Gateway & Worker) is implemented and tested (Worker logic verified).
*   Docker environment is set up.
*   Branch: `feature/frontend-implementation`

**Immediate Next Steps (To Be Completed):**

## 1. Create `frontend/styles.css`
Implement the "Gumroad/Neo-Brutalist" Design System.
*   **Variables:**
    *   `--bg-color: #ffffff`
    *   `--text-color: #000000`
    *   `--accent-pink: #ff90e8`
    *   `--accent-yellow: #ffc900`
    *   `--border: 2px solid #000`
    *   `--shadow: 4px 4px 0px #000`
*   **Reset:** Standard CSS reset.
*   **Components:** `.btn`, `.card`, `.input` using the border/shadow tokens.

## 2. Create `frontend/index.html`
The Main "Cart" Interface.
*   **Structure:**
    *   Header (Logo/Title).
    *   Input Section ("Paste URL" + "Add" Button).
    *   Cart Section (List of items with Thumbnails & Prices).
    *   Checkout Section (Total Price + "Pay with Stripe" Button).
*   **Linking:** Link `styles.css` and `app.js`.

## 3. Create `frontend/downloads.html`
The Post-Payment Interface.
*   **Structure:**
    *   Header.
    *   Status List (Polling for job completion).
    *   Download Buttons (appear when status = `completed`).

## 4. Create `frontend/app.js`
Re-implement the Logic (Note: Previous version was deleted).
*   **Features:**
    *   `addToCart()`: POST `/api/cart/add`.
    *   `renderCart()`: Update DOM.
    *   `checkout()`: POST `/api/checkout`.
    *   `pollJobs()`: GET `/api/jobs` (loop every 3s on downloads page).
    *   `download()`: Handle file blob download.

**Reference:**
Check `PROJECT_PLAN.md` Phase 4 for details.
