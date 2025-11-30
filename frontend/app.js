/**
 * Video To Text - Frontend Application
 * Handles Localization, Cart Logic, and Job Polling.
 */

const API_BASE = 'http://localhost:8000';

// --- Localization Configuration ---
const TRANSLATIONS = {
    en: {
        title: "Video To Text",
        subtitle: "Extract transcripts & metadata from YouTube, TikTok, Instagram.",
        placeholder_url: "Paste video URL here...",
        btn_add: "Add",
        cart_title: "Your Cart",
        cart_empty: "Your cart is currently empty.",
        fee_base: "Base Fee",
        fee_duration: "Duration Fee",
        total: "Total",
        btn_checkout: "Pay with Stripe",
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
        subtitle: "Extrae transcripciones y metadatos de YouTube, TikTok, Instagram.",
        placeholder_url: "Pega la URL del video aquí...",
        btn_add: "Agregar",
        cart_title: "Tu Carrito",
        cart_empty: "Tu carrito está vacío actualmente.",
        fee_base: "Tarifa Base",
        fee_duration: "Tarifa por Duración",
        total: "Total",
        btn_checkout: "Pagar con Stripe",
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
    whimsicalIndex: 0
};

// --- Core Functions ---

// 1. Initialization & Localization
function init() {
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

    // Route Handler
    if (document.getElementById('cart-list')) {
        initCartPage();
    } else if (document.getElementById('status-list')) {
        initDownloadsPage();
    }
}

// 2. Cart Page Logic
function initCartPage() {
    const addBtn = document.getElementById('add-btn');
    const input = document.getElementById('url-input');
    const checkoutBtn = document.getElementById('checkout-btn');

    addBtn.addEventListener('click', () => addToCart(input.value));
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addToCart(input.value);
    });

    checkoutBtn.addEventListener('click', handleCheckout);
}

async function addToCart(url) {
    const t = TRANSLATIONS[state.lang];
    const input = document.getElementById('url-input');

    if (!url) return;

    // Spam Protection
    if (state.cart.length >= 10) {
        alert(t.alert_cart_full);
        return;
    }

    // Optimistic UI: Disable button
    const addBtn = document.getElementById('add-btn');
    const originalText = addBtn.textContent;
    addBtn.disabled = true;
    addBtn.textContent = "...";

    try {
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
        // Assuming backend returns the full cart object or the new item
        // For now, let's assume it returns the added item details + pricing
        
        // Since we don't have a persistent GET /cart endpoint in the requirement,
        // we rely on the response or just push to local state.
        // Let's assume the backend returns the added item metadata.
        // If not, we might need to refactor.
        
        // Mocking the push for now if response is just "OK", 
        // but ideally backend returns: { title: "...", duration: 120, price: 0.50 }
        
        // Note: In a real scenario, we should handle errors gracefully.
        state.cart.push(data); 
        
        renderCart();
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

function renderCart() {
    const list = document.getElementById('cart-list');
    const countSpan = document.getElementById('cart-count');
    const totalEl = document.getElementById('total-price');
    const t = TRANSLATIONS[state.lang];

    list.innerHTML = '';
    countSpan.textContent = `${state.cart.length} items`;

    if (state.cart.length === 0) {
        list.innerHTML = `<p style="opacity: 0.6;">${t.cart_empty}</p>`;
        totalEl.textContent = '$0.00';
        return;
    }

    let total = 0;

    state.cart.forEach((item, index) => {
        // Expecting item to have: title, duration, price (calculated by backend)
        const el = document.createElement('div');
        el.className = 'card mb-4';
        el.style.padding = '1rem';
        el.innerHTML = `
            <div class="flex-row" style="justify-content: space-between;">
                <div>
                    <strong>${index + 1}. ${item.title || 'Video'}</strong><br>
                    <small>${Math.round(item.duration || 0)}s</small>
                </div>
                <div>$${(item.price || 0).toFixed(2)}</div>
            </div>
        `;
        list.appendChild(el);
        total += (item.price || 0);
    });

    totalEl.textContent = `$${total.toFixed(2)}`;
}

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

// 3. Downloads Page Logic
function initDownloadsPage() {
    // Start Polling
    pollJobs();
    setInterval(pollJobs, 3000); // Check every 3s
    
    // Start Whimsical Rotator
    setInterval(rotateWhimsicalText, 2500);
}

async function pollJobs() {
    try {
        const response = await fetch(`${API_BASE}/jobs?session_id=${state.sessionId}`);
        const jobs = await response.json();
        renderJobs(jobs);
    } catch (err) {
        console.error("Polling error:", err);
    }
}

function renderJobs(jobs) {
    const list = document.getElementById('status-list');
    const t = TRANSLATIONS[state.lang];
    
    if (!jobs || jobs.length === 0) {
        list.innerHTML = `<p class="text-center" style="opacity: 0.6;">${t.downloads_loading}</p>`;
        return;
    }

    list.innerHTML = ''; // Clear current list

    jobs.forEach(job => {
        const card = document.createElement('div');
        card.className = 'card mb-4';
        card.style.padding = '1rem';
        
        let statusHtml = '';
        let statusClass = '';

        if (job.status === 'completed') {
            statusHtml = `<a href="${API_BASE}/download/${job.id}" class="btn btn-primary" target="_blank">Download</a>`;
            statusClass = 'color: green; font-weight: bold;';
        } else if (job.status === 'failed') {
            statusHtml = `<span style="color: red;">Failed</span>`;
        } else {
            // Processing or Pending
            // Use the whimsical text container class to target it later
            statusHtml = `<span class="whimsical-text" style="color: var(--accent-pink);">${t.status_processing}...</span>`;
        }

        card.innerHTML = `
            <div class="flex-row" style="justify-content: space-between; align-items: center;">
                <div>
                    <strong>${job.video_url}</strong>
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
    const elements = document.querySelectorAll('.whimsical-text');
    
    if (elements.length === 0) return;

    const text = t.whimsical[state.whimsicalIndex];
    state.whimsicalIndex = (state.whimsicalIndex + 1) % t.whimsical.length;

    elements.forEach(el => {
        el.textContent = text;
    });
}

// Start App
document.addEventListener('DOMContentLoaded', init);
