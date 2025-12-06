/**
 * Video To Text - Frontend Application
 * Handles Localization, Cart Logic, Preview, and Job Polling.
 */

const API_BASE = '/api';

// --- Localization Configuration ---
const TRANSLATIONS = {
    en: {
        title: "Video To Text",
        subtitle: "Extract transcripts & metadata from YouTube.",
        placeholder_url: "Paste YouTube URL here...",
        btn_add: "Add",
        cart_title: "Your Cart",
        cart_empty: "Your cart is currently empty.",
        fee_base: "Base Fee",
        fee_duration: "Duration Fee",
        total: "Total",
        btn_checkout: "Pay with Stripe",
        btn_preview: "Preview (30s)",
        downloads_title: "Your Downloads",
        downloads_subtitle: "Processing your videos. This page updates automatically.",
        downloads_loading: "Loading status...",
        btn_new_order: "Start New Order",
        alert_cart_full: "Cart full! Please checkout now (Max 10 videos).",
        alert_error: "Error: ",
        status_pending: "Pending",
        status_processing: "Processing",
        status_completed: "Completed",
        status_failed: "Failed",
        whimsical: [
            'Discombobulating neural networks...',
            'Teaching Python to listen...',
            'Herding bits and bytes...',
            'Heating up the GPU...',
            'Downloading the internet...'
        ]
    },
    es: {
        title: "Video a Texto",
        subtitle: "Extrae transcripciones y metadatos de YouTube.",
        placeholder_url: "Pega la URL de YouTube aquí...",
        btn_add: "Agregar",
        cart_title: "Tu Carrito",
        cart_empty: "Tu carrito está vacío actualmente.",
        fee_base: "Tarifa Base",
        fee_duration: "Tarifa por Duración",
        total: "Total",
        btn_checkout: "Pagar con Stripe",
        btn_preview: "Vista Previa (30s)",
        downloads_title: "Tus Descargas",
        downloads_subtitle: "Procesando tus videos. Esta página se actualiza sola.",
        downloads_loading: "Cargando estado...",
        btn_new_order: "Nueva Orden",
        alert_cart_full: "¡Carrito lleno! Por favor paga ahora (Máx 10 videos).",
        alert_error: "Error: ",
        status_pending: "Pendiente",
        status_processing: "Procesando",
        status_completed: "Completado",
        status_failed: "Fallido",
        whimsical: [
            'Descombobulando redes neuronales...',
            'Enseñándole a escuchar a Python...',
            'Arreando bits y bytes...',
            'Calentando la GPU...',
            'Descargando internet...'
        ]
    }
};

// --- State Management ---
const state = {
    lang: 'en',
    sessionId: null,
    cart: [],
    whimsicalIndex: 0,
    previews: {} // Stores job_id -> { status, result }
};

const GEAR_ICON = `<svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
const TRASH_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

// --- Core Functions ---

function init() {
    console.log("App init started");
    // Detect Language
    const userLang = navigator.language || navigator.userLanguage;
    if (userLang.startsWith('es')) {
        state.lang = 'es';
    }

    // Apply Text
    const t = TRANSLATIONS[state.lang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.textContent = t[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (t[key]) el.placeholder = t[key];
    });

    // Session Management
    let storedSession = localStorage.getItem('vtt_session_id');
    if (!storedSession) {
        storedSession = crypto.randomUUID();
        localStorage.setItem('vtt_session_id', storedSession);
    }
    state.sessionId = storedSession;
    console.log("Session ID:", state.sessionId);

    // Load History
    loadHistory();

    // Route Handler
    if (document.getElementById('cart-list')) {
        console.log("Detected Cart Page");
        initCartPage();
    } else if (document.getElementById('status-list')) {
        console.log("Detected Downloads Page");
        initDownloadsPage();
    }
    
    // Start Whimsical Rotator globally
    setInterval(rotateWhimsicalText, 2500);
}

// --- History Logic ---

function loadHistory() {
    const container = document.getElementById('history-container');
    const list = document.getElementById('history-list');
    if (!container || !list) return;

    let raw = localStorage.getItem('recentSessions');
    let sessions = raw ? JSON.parse(raw) : [];
    
    const now = Date.now();
    const oneHour = 3600 * 1000;
    
    // Filter expired sessions
    const validSessions = sessions.filter(s => (now - s.timestamp) < oneHour);
    
    // Save cleaned list
    localStorage.setItem('recentSessions', JSON.stringify(validSessions));
    
    // Remove current session from view if present in history (unlikely but possible)
    const visibleSessions = validSessions.filter(s => s.id !== state.sessionId);

    if (visibleSessions.length === 0) {
        container.style.display = 'none';
        return;
    }

    // Render
    container.style.display = 'block'; // Show container
    list.innerHTML = '';
    
    visibleSessions.forEach(s => {
        const elapsedMins = Math.floor((now - s.timestamp) / 60000);
        const minsLeft = 60 - elapsedMins;
        
        const li = document.createElement('li');
        // CSS class handles styling now
        li.innerHTML = `
            <div onclick="restoreSession('${s.id}')" style="flex-grow:1;">
                <span>Order ...${s.id.slice(-4)}</span>
                <small style="opacity: 0.6; margin-left: 0.5rem;">${minsLeft}m</small>
            </div>
            <button onclick="deleteHistoryItem('${s.id}')" style="background:none; border:none; cursor:pointer; color:red; font-weight:bold; padding:0 0.5rem;">&times;</button>
        `;
        
        list.appendChild(li);
    });
}

function deleteHistoryItem(id) {
    let raw = localStorage.getItem('recentSessions');
    let sessions = raw ? JSON.parse(raw) : [];
    const newSessions = sessions.filter(s => s.id !== id);
    localStorage.setItem('recentSessions', JSON.stringify(newSessions));
    loadHistory(); // Re-render
}

function restoreSession(oldId) {
    if (confirm("Switch to this previous order? Current cart will be saved.")) {
        // Save current if needed (handled by resetSession usually, but here we switch manually)
        // We reuse resetSession logic but point to oldId
        
        // Manually switch
        resetSession(oldId, true); 
    }
}

function resetSession(targetId = null, isRestore = false) {
    // 1. Save current session to history ONLY if it has actual orders
    if (state.sessionId) {
        const hasOrders = localStorage.getItem(`vtt_has_orders_${state.sessionId}`);
        
        if (hasOrders === 'true') {
            let raw = localStorage.getItem('recentSessions');
            let sessions = raw ? JSON.parse(raw) : [];
            
            // Add current only if not already there
            if (!sessions.find(s => s.id === state.sessionId)) {
                sessions.push({ id: state.sessionId, timestamp: Date.now() });
                localStorage.setItem('recentSessions', JSON.stringify(sessions));
            }
        }
        // Cleanup flag
        localStorage.removeItem(`vtt_has_orders_${state.sessionId}`);
    }

    // 2. Switch ID
    const newId = targetId || crypto.randomUUID();
    localStorage.setItem('vtt_session_id', newId);
    
    // 3. Redirect
    if (isRestore) {
        window.location.href = "downloads.html";
    } else {
        window.location.href = "index.html";
    }
}

// --- Cart Logic ---

async function initCartPage() {
    console.log("initCartPage running");
    const addBtn = document.getElementById('add-btn');
    const input = document.getElementById('url-input');
    const checkoutBtn = document.getElementById('checkout-btn');

    if(addBtn) {
        addBtn.addEventListener('click', () => {
            console.log("Add Button Clicked");
            addToCart(input.value);
        });
    } else {
        console.error("Add Button not found!");
    }
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addToCart(input.value);
    });

    checkoutBtn.addEventListener('click', handleCheckout);

    // Dev Pay Handler
    const devBtn = document.getElementById('dev-pay-btn');
    if (devBtn) {
        devBtn.addEventListener('click', async () => {
            if (state.cart.length === 0) return;
            
            devBtn.disabled = true;
            devBtn.textContent = "...";
            
            try {
                const res = await fetch(`${API_BASE}/dev/pay`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: state.sessionId })
                });
                
                if (!res.ok) throw new Error("Dev pay failed");
                
                // Success: Redirect to downloads
                window.location.href = "downloads.html";
            } catch (e) {
                alert("Dev Error: " + e.message);
                devBtn.disabled = false;
                devBtn.textContent = "⚡ Dev Pay";
            }
        });
    }

    // Initial Fetch
    await fetchCart();
}

async function fetchCart() {
    try {
        const res = await fetch(`${API_BASE}/cart?session_id=${state.sessionId}`);
        const data = await res.json();
        state.cart = data.items || [];
        renderCart();
    } catch (e) {
        console.error("Failed to fetch cart:", e);
    }
}

async function addToCart(url) {
    console.log("addToCart called with:", url);
    const t = TRANSLATIONS[state.lang];
    const input = document.getElementById('url-input');

    if (!url) {
        console.warn("No URL provided");
        return;
    }
    if (state.cart.length >= 10) {
        alert(t.alert_cart_full);
        return;
    }

    const addBtn = document.getElementById('add-btn');
    const originalText = addBtn.textContent;
    addBtn.disabled = true;
    addBtn.textContent = "...";

    try {
        console.log("Fetching API...");
        const response = await fetch(`${API_BASE}/cart/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: url,
                session_id: state.sessionId
            })
        });

        if (!response.ok) throw new Error('Failed to add video');

        const data = await response.json();
        console.log("Added item:", data);
        // Refresh cart from server to be safe
        await fetchCart(); 
        
        input.value = '';
        input.focus();
    } catch (err) {
        console.error(err);
        alert(t.alert_error + err.message);
    } finally {
        addBtn.disabled = false;
        addBtn.textContent = originalText;
    }
}

async function requestPreview(url, btnElement, resultContainerId) {
    const t = TRANSLATIONS[state.lang];
    const resultDiv = document.getElementById(resultContainerId);

    // 1. Check Cache
    if (state.previews[url]) {
        const cachedResult = state.previews[url];
        renderPreviewResult(cachedResult, resultDiv, btnElement, url);
        return;
    }
    
    // 2. API Request
    // Disable button
    btnElement.disabled = true;
    btnElement.textContent = "...";

    try {
        // Request Job
        const res = await fetch(`${API_BASE}/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: url,
                session_id: state.sessionId
            })
        });

        if (!res.ok) throw new Error("Preview request failed");
        
        const data = await res.json();
        const jobId = data.job_id;
        
        // Start Polling
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
            <div style="color: var(--accent-pink); font-weight:bold;">
                ${GEAR_ICON} <span id="whimsical-text-${jobId}" class="whimsical-target">${t.status_processing}...</span>
            </div>
        `;

        pollPreviewJob(jobId, resultDiv, btnElement, url);

    } catch (e) {
        alert(t.alert_error + e.message);
        btnElement.disabled = false;
        btnElement.textContent = t.btn_preview;
    }
}

function pollPreviewJob(jobId, container, btn, url) {
    const t = TRANSLATIONS[state.lang];
    
    const interval = setInterval(async () => {
        try {
            const res = await fetch(`${API_BASE}/job/${jobId}`);
            if (res.status === 404) return; 
            
            const job = await res.json();
            
            if (job.status === 'completed') {
                clearInterval(interval);
                // Save to Cache
                state.previews[url] = job.result;
                renderPreviewResult(job.result, container, btn, url);
                
            } else if (job.status === 'failed') {
                clearInterval(interval);
                container.innerHTML = `<small style="color:red;">${t.status_failed}: ${job.error}</small>`;
                btn.disabled = false;
                btn.textContent = t.btn_preview;
            }
        } catch (e) {
            console.error("Polling error", e);
        }
    }, 2000);
}

function renderPreviewResult(text, container, btn, url) {
    const t = TRANSLATIONS[state.lang];
    
    container.style.display = 'block';
    container.innerHTML = `
        <textarea readonly class="input" style="margin-top:1rem; height:300px; resize: vertical; background-color: #fff;">${text}</textarea>
    `;
    
    // Update Button to "Done"
    btn.textContent = "Done";
    btn.disabled = false;
    btn.onclick = (e) => {
        e.stopPropagation();
        container.style.display = 'none'; // Just hide
        btn.textContent = t.btn_preview;  // Reset text
        // Reset click handler to trigger cache check next time
        btn.onclick = (ev) => window.handlePreviewClick(ev, btn, url, container.id);
    };
}

function renderCart() {
    const list = document.getElementById('cart-list');
    // Updated ID to match the new Navbar structure
    const countSpan = document.getElementById('nav-cart-count');
    const totalEl = document.getElementById('total-price');
    const t = TRANSLATIONS[state.lang];

    list.innerHTML = '';
    
    if (countSpan) {
        countSpan.textContent = state.cart.length > 0 ? `Cart (${state.cart.length})` : 'Cart';
    }

    if (state.cart.length === 0) {
        list.innerHTML = `<p style="opacity: 0.6;">${t.cart_empty}</p>`;
        totalEl.textContent = '$0.00';
        return;
    }

    let total = 0;

    state.cart.forEach((item, index) => {
        const el = document.createElement('div');
        el.className = 'card mb-4'; // Removed modal click handler
        el.style.padding = '1rem';
        
        const resultId = `preview-result-${index}`;
        
        el.innerHTML = `
            <div class="flex-row" style="justify-content: space-between;">
                <div>
                    <strong>${index + 1}. ${item.title || 'Video'}</strong><br>
                    <small>${Math.round(item.duration || 0)}s</small>
                </div>
                <div class="text-right">
                    <div class="flex-row" style="gap: 0.5rem; justify-content: flex-end; align-items: center;">
                        <div style="font-weight: bold;">$${(item.price || 0).toFixed(2)}</div>
                        <button title="Remove" style="background:none; border:none; cursor:pointer; color: #000; padding: 4px; display: flex; align-items: center;" onmouseover="this.style.color='red'" onmouseout="this.style.color='#000'" onclick="removeFromCart('${item.id}')">
                            ${TRASH_ICON}
                        </button>
                    </div>
                    <div class="preview-wrapper">
                        <button class="btn" style="margin-top: 0.5rem; background-color: #ffffff;" onclick="handlePreviewClick(event, this, '${item.url}', '${resultId}')">
                            ${t.btn_preview}
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Inline Result Area -->
            <div id="${resultId}" style="display:none; margin-top: 1rem; border-top: 2px solid #000; padding-top: 1rem;"></div>
        `;
        list.appendChild(el);
        total += (item.price || 0);
    });

    totalEl.textContent = `$${total.toFixed(2)}`;
}

async function removeFromCart(itemId) {
    const t = TRANSLATIONS[state.lang];
    // Optional: Confirm dialog
    // if (!confirm("Remove this video?")) return;

    try {
        const res = await fetch(`${API_BASE}/cart/${itemId}?session_id=${state.sessionId}`, {
            method: 'DELETE'
        });
        
        if (!res.ok) throw new Error("Failed to delete");
        
        await fetchCart(); // Refresh list
    } catch (e) {
        alert(t.alert_error + e.message);
    }
}

// Global handler
window.handlePreviewClick = function(event, btn, url, resultId) {
    // If button text is "Done", we should probably just collapse? 
    // But the onclick replacement in pollPreviewJob handles that.
    // This entry point is for "Start Preview".
    requestPreview(url, btn, resultId);
};
window.removeFromCart = removeFromCart;
window.resetSession = resetSession;
window.restoreSession = restoreSession;
window.deleteHistoryItem = deleteHistoryItem;

/* Removed Modal Functions (openCardModal, closeModal) */


async function handleCheckout() {
    const t = TRANSLATIONS[state.lang];
    if (state.cart.length === 0) return;

    const checkoutBtn = document.getElementById('checkout-btn');
    checkoutBtn.disabled = true;
    checkoutBtn.textContent = "...";

    try {
        const response = await fetch(`${API_BASE}/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: state.sessionId })
        });
        
        const data = await response.json();
        if (data.url) {
            window.location.href = data.url;
        } else {
            throw new Error('No checkout URL returned');
        }
    } catch (err) {
        alert(t.alert_error + err.message);
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = t.btn_checkout;
    }
}

// --- Downloads Logic ---

function initDownloadsPage() {
    pollJobs();
    setInterval(pollJobs, 3000);
}

async function pollJobs() {
    try {
        const response = await fetch(`${API_BASE}/jobs?session_id=${state.sessionId}`);
        const data = await response.json();
        renderJobs(data.jobs || []);
    } catch (err) {
        console.error("Polling error:", err);
    }
}

function renderJobs(jobs) {
    const list = document.getElementById('status-list');
    const t = TRANSLATIONS[state.lang];
    
    if (!jobs || jobs.length === 0) {
        // ... existing auto-cleanup logic ...
        let raw = localStorage.getItem('recentSessions');
        let sessions = raw ? JSON.parse(raw) : [];
        const isHistory = sessions.find(s => s.id === state.sessionId);
        
        if (isHistory) {
            console.warn("Session is empty/expired. Cleaning up.");
            alert("This order has expired or is empty.");
            deleteHistoryItem(state.sessionId); 
            window.location.href = "index.html";
            return;
        }

        list.innerHTML = `<p class="text-center" style="opacity: 0.6;">${t.downloads_loading}</p>`;
        return;
    }

    // Mark session as having valid orders so it can be saved to history
    localStorage.setItem(`vtt_has_orders_${state.sessionId}`, 'true');

    list.innerHTML = ''; 

    // Check completed count
    const completedCount = jobs.filter(j => j.status === 'completed').length;
    if (completedCount > 1) {
        const zipBtn = document.createElement('div');
        zipBtn.style.textAlign = 'right';
        zipBtn.style.marginBottom = '1rem';
        zipBtn.innerHTML = `
            <a href="${API_BASE}/download-all/${state.sessionId}" class="btn" style="background-color: #333; color: white;">
                Download All (.zip)
            </a>
        `;
        list.appendChild(zipBtn);
    }
    // Removed duplicate New Order button injection

    jobs.forEach(job => {
        const card = document.createElement('div');
        card.className = 'card mb-4';
        card.style.padding = '1rem';
        
        let statusHtml = '';

        if (job.status === 'completed') {
            // Use the generic /api/download/{job_id} endpoint
            statusHtml = `<a href="${API_BASE}/download/${job.job_id}" class="btn btn-primary" target="_blank">Download</a>`;
        } else if (job.status === 'failed') {
            statusHtml = `<span style="color: red;">Failed</span>`;
        } else {
            statusHtml = `
                <div style="color: var(--accent-pink); display:flex; align-items:center;">
                    ${GEAR_ICON}
                    <span class="whimsical-target">${t.status_processing}...</span>
                </div>`;
        }

        card.innerHTML = `
            <div class="flex-row" style="justify-content: space-between; align-items: center;">
                <div>
                    <strong>${job.title || 'Unknown Video'}</strong>
                </div>
                <div>
                    ${statusHtml}
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

function rotateWhimsicalText() {
    const t = TRANSLATIONS[state.lang];
    // Target the new class used inside the span next to the icon
    const elements = document.querySelectorAll('.whimsical-target');
    
    if (elements.length === 0) return;

    const text = t.whimsical[state.whimsicalIndex];
    state.whimsicalIndex = (state.whimsicalIndex + 1) % t.whimsical.length;

    elements.forEach(el => {
        el.textContent = text;
    });
}

document.addEventListener('DOMContentLoaded', init);
