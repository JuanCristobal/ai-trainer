/**
 * Video To Text - Frontend Application
 * Handles Localization, Cart Logic, Preview, and Job Polling.
 */

const API_BASE = '/api';

// --- Localization Configuration ---
const TRANSLATIONS = {
    en: {
        nav_history: "History",
        nav_cart: "Cart",
        hero_title: "Make Videos Readable.",
        hero_subtitle: "Stop hallucinations. Turn YouTube videos into structured data for your LLM.",
        placeholder_url: "Paste YouTube URL here...",
        btn_add: "Add",
        cart_title: "Your Cart",
        cart_empty: "Your cart is currently empty.",
        total: "Total",
        btn_checkout: "Pay Securely",
        btn_new_order: "Start New Order",
        feat_blackbox_title: "The Black Box Problem",
        feat_blackbox_text: "LLMs are blind to video. Sending a URL to ChatGPT often leads to hallucinations or generic summaries.",
        feat_extraction_title: "Deep Extraction",
        feat_extraction_text: "We don't just scrape. We download audio, transcribe with Whisper, and format timestamps precisely.",
        feat_rag_title: "RAG Ready",
        feat_rag_text: "Download a clean .md file. Drag & drop it into Claude or GPT-4 to chat with the video instantly.",
        footer_text: "Built for the AI era. © 2025 Video2MD.",
        link_terms: "Terms of Service",
        link_privacy: "Privacy Policy",
        btn_preview: "Preview (30s)",
        btn_done: "Done",
        btn_download: "Download",
        btn_download_zip: "Download All (.zip)",
        downloads_title: "Your Downloads",
        downloads_subtitle: "Processing your videos. This page updates automatically.",
        downloads_loading: "Loading status...",
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
        nav_history: "Historial",
        nav_cart: "Carro",
        hero_title: "Haz Videos Legibles.",
        hero_subtitle: "Basta de alucinaciones. Convierte videos de YouTube en datos estructurados para tu LLM.",
        placeholder_url: "Pega la URL de YouTube aquí...",
        btn_add: "Agregar",
        cart_title: "Tu Carro",
        cart_empty: "Tu carro está vacío actualmente.",
        total: "Total",
        btn_checkout: "Pagar Seguro",
        btn_new_order: "Nueva Orden",
        feat_blackbox_title: "El Problema de la Caja Negra",
        feat_blackbox_text: "Los LLMs son ciegos al video. Enviar una URL a ChatGPT a menudo resulta en alucinaciones o resúmenes genéricos.",
        feat_extraction_title: "Extracción Profunda",
        feat_extraction_text: "No solo hacemos scraping. Descargamos el audio, transcribimos con Whisper y formateamos las marcas de tiempo.",
        feat_rag_title: "Listo para RAG",
        feat_rag_text: "Descarga un archivo .md limpio. Arrástralo a Claude o GPT-4 para chatear con el video al instante.",
        footer_text: "Desarrollado para la era IA. © 2025 Video2MD.",
        link_terms: "Términos de Servicio",
        link_privacy: "Política de Privacidad",
        btn_preview: "Vista Previa",
        btn_done: "Listo",
        btn_download: "Descargar",
        btn_download_zip: "Descarga .zip",
        downloads_title: "Tus Descargas",
        downloads_subtitle: "Procesando tus videos. Esta página se actualiza sola.",
        downloads_loading: "Cargando estado...",
        btn_new_order: "Nueva Orden",
        alert_cart_full: "¡Carro lleno! Por favor paga ahora (Máx 10 videos).",
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

// Environment & traps
const IS_PROD = !location.hostname.match(/(?:localhost|127\.0\.0\.1)/);
const ASCII_FINGER = `
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⣴⣾⣿⣿⣿⣷⣦⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⣧⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⢀⣀⣀⣀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣀⣀⣀⡀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠙⠛⠛⠛⠛⠿⢿⣿⣿⣿⣿⡿⠿⠛⠛⠛⠛⠋⠀⠀⠀⠀⠀⠀⠀
`.trim();

function devPayTrap() {
    console.log(ASCII_FINGER);
    alert("Nice try. Check the console.");
}

// --- State Management ---
const state = {
    lang: 'en',
    sessionId: null,
    cart: [],
    whimsicalIndex: 0,
    previews: {} // Stores job_id -> { status, result }
};

const GEAR_ICON = `<svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
const TRASH_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
const LOCK_ICON = `<svg class="icon" style="margin-right: 0.5rem;" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;

// --- Paddle Init ---
let PADDLE_CLIENT_TOKEN = "";
let paddleInitialized = false;

// --- Core Functions ---

function init() {
    console.log("App init started");

    // 1. Immediate UI Init (Listeners)
    if (document.getElementById('cart-list')) {
        console.log("Detected Cart Page");
        initCartPage();
    } else if (document.getElementById('status-list')) {
        console.log("Detected Downloads Page");
        initDownloadsPage();
    }

    // 2. Load History
    loadHistory();
    
    // 3. Load Config (Non-blocking Promise)
    fetch(`${API_BASE}/config`)
        .then(res => res.json())
        .then(config => {
            console.log("Config loaded:", config);
            PADDLE_CLIENT_TOKEN = config.paddle_client_token;
            
            // Fix: Set Environment globally before Initialize
            if (config.env === 'sandbox') {
                Paddle.Environment.set('sandbox');
            }
            
            if (PADDLE_CLIENT_TOKEN && typeof Paddle !== 'undefined') {
                Paddle.Initialize({ 
                    token: PADDLE_CLIENT_TOKEN,
                    eventCallback: function(data) {
                        if (data.name === "checkout.completed") {
                            window.location.href = "downloads.html";
                        }
                    }
                });
                paddleInitialized = true;
                console.log("Paddle Initialized");
            }
        })
        .catch(e => console.error("Config load failed:", e));

    // Detect Language
    const userLang = navigator.language || navigator.userLanguage;
    if (userLang.startsWith('es')) {
        state.lang = 'es';
    }

    // Apply Text
    const t = TRANSLATIONS[state.lang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) {
            if (key === 'btn_checkout') {
                el.innerHTML = `${LOCK_ICON}${t[key]}`;
            } else {
                el.textContent = t[key];
            }
        }
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

    // Start Whimsical Rotator globally
    setInterval(rotateWhimsicalText, 2500);
    
    // Toggle Language Blocks (Legal Pages)
    toggleLanguageBlocks();
}

function toggleLanguageBlocks() {
    const lang = state.lang; 
    const enBlocks = document.querySelectorAll('.lang-en');
    const esBlocks = document.querySelectorAll('.lang-es');
    
    if (lang === 'es') {
        enBlocks.forEach(el => el.style.display = 'none');
        esBlocks.forEach(el => el.style.display = 'block');
    } else {
        enBlocks.forEach(el => el.style.display = 'block');
        esBlocks.forEach(el => el.style.display = 'none');
    }
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
    
    // Remove current session from view if present in history
    const visibleSessions = validSessions.filter(s => s.id !== state.sessionId);

    if (visibleSessions.length === 0) {
        container.style.display = 'none';
        return;
    }

    // Render
    container.style.display = 'block'; 
    list.innerHTML = '';
    
    visibleSessions.forEach(s => {
        const elapsedMins = Math.floor((now - s.timestamp) / 60000);
        const minsLeft = 60 - elapsedMins;
        
        const li = document.createElement('li');
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
    loadHistory(); 
}

function restoreSession(oldId) {
    if (confirm("Switch to this previous order? Current cart will be saved.")) {
        resetSession(oldId, true); 
    }
}

function resetSession(targetId = null, isRestore = false) {
    if (state.sessionId) {
        const hasOrders = localStorage.getItem(`vtt_has_orders_${state.sessionId}`);
        if (hasOrders === 'true') {
            let raw = localStorage.getItem('recentSessions');
            let sessions = raw ? JSON.parse(raw) : [];
            if (!sessions.find(s => s.id === state.sessionId)) {
                sessions.push({ id: state.sessionId, timestamp: Date.now() });
                localStorage.setItem('recentSessions', JSON.stringify(sessions));
            }
        }
        localStorage.removeItem(`vtt_has_orders_${state.sessionId}`);
    }

    const newId = targetId || crypto.randomUUID();
    localStorage.setItem('vtt_session_id', newId);
    
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
    }
    
    if(input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addToCart(input.value);
        });
    }

    if(checkoutBtn) {
        checkoutBtn.addEventListener('click', handleCheckout);
    }

    // Dev Pay Handler
    const devBtn = document.getElementById('dev-pay-btn');
    if (devBtn) {
        if (IS_PROD) {
            devBtn.style.display = 'none';
            devBtn.onclick = devPayTrap;
            window.devPay = devPayTrap; 
        } else {
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
                    window.location.href = "downloads.html";
                } catch (e) {
                    alert("Dev Error: " + e.message);
                    devBtn.disabled = false;
                    devBtn.textContent = "⚡ Dev Pay";
                }
            });
        }
    }

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

    if (!url) return;
    if (state.cart.length >= 10) {
        alert(t.alert_cart_full);
        return;
    }

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

async function removeFromCart(itemId) {
    const t = TRANSLATIONS[state.lang];
    try {
        // Use DELETE endpoint (consistent with backend)
        const res = await fetch(`${API_BASE}/cart/${itemId}?session_id=${state.sessionId}`, {
            method: 'DELETE'
        });
        
        if (!res.ok) throw new Error("Failed to delete");
        
        await fetchCart(); 
    } catch (e) {
        alert(t.alert_error + e.message);
    }
}

async function requestPreview(url, btnElement, resultContainerId) {
    const t = TRANSLATIONS[state.lang];
    const resultDiv = document.getElementById(resultContainerId);

    if (state.previews[url]) {
        const cachedResult = state.previews[url];
        renderPreviewResult(cachedResult, resultDiv, btnElement, url);
        return;
    }
    
    btnElement.disabled = true;
    btnElement.textContent = "...";

    try {
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
    
    btn.textContent = t.btn_done;
    btn.disabled = false;
    btn.onclick = (e) => {
        e.stopPropagation();
        container.style.display = 'none';
        btn.textContent = t.btn_preview;
        btn.onclick = (ev) => window.handlePreviewClick(ev, btn, url, container.id);
    };
}

function renderCart() {
    const list = document.getElementById('cart-list');
    const countSpan = document.getElementById('nav-cart-count');
    const totalEl = document.getElementById('total-price');
    const t = TRANSLATIONS[state.lang];

    list.innerHTML = '';
    
    if (countSpan) {
        const cartLabel = t.nav_cart || "Cart";
        countSpan.textContent = state.cart.length > 0 ? `${cartLabel} (${state.cart.length})` : cartLabel;
    }

    if (state.cart.length === 0) {
        list.innerHTML = `<p style="opacity: 0.6;">${t.cart_empty}</p>`;
        totalEl.textContent = '$0.00';
        return;
    }

    let total = 0;

    state.cart.forEach((item, index) => {
        const el = document.createElement('div');
        el.className = 'card mb-4'; 
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
            
            <div id="${resultId}" style="display:none; margin-top: 1rem; border-top: 2px solid #000; padding-top: 1rem;"></div>
        `;
        list.appendChild(el);
        total += (item.price || 0);
    });

    totalEl.textContent = `$${total.toFixed(2)}`;
}

async function handleCheckout() {
    const t = TRANSLATIONS[state.lang];
    if (state.cart.length === 0) return;

    if (!paddleInitialized) {
        alert("Paddle is not ready. Please reload the page.");
        return;
    }

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
        console.log("Checkout Response:", data);
        console.log("Using Client Token:", PADDLE_CLIENT_TOKEN);
        
        if (data.transactionId) {
            console.log("Opening Paddle with Transaction ID:", data.transactionId);
            
            Paddle.Checkout.open({
                transactionId: data.transactionId,
                settings: {
                    displayMode: "overlay",
                    theme: "light",
                    locale: state.lang // 'es' or 'en'
                }
            });
            checkoutBtn.disabled = false;
            checkoutBtn.textContent = t.btn_checkout;
        } else {
            throw new Error('No transaction ID returned');
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

    localStorage.setItem(`vtt_has_orders_${state.sessionId}`, 'true');

    list.innerHTML = ''; 

    const completedCount = jobs.filter(j => j.status === 'completed').length;
    if (completedCount > 1) {
        const zipBtn = document.createElement('div');
        zipBtn.style.textAlign = 'right';
        zipBtn.style.marginBottom = '1rem';
        zipBtn.innerHTML = `
            <a href="${API_BASE}/download-all/${state.sessionId}" class="btn" style="background-color: #333; color: white;">
                ${t.btn_download_zip}
            </a>
        `;
        list.appendChild(zipBtn);
    }

    jobs.forEach(job => {
        const card = document.createElement('div');
        card.className = 'card mb-4';
        card.style.padding = '1rem';
        
        let statusHtml = '';

        if (job.status === 'completed') {
            statusHtml = `<a href="${API_BASE}/download/${job.job_id}" class="btn btn-primary" target="_blank">${t.btn_download}</a>`;
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
    const elements = document.querySelectorAll('.whimsical-target');
    
    if (elements.length === 0) return;

    const text = t.whimsical[state.whimsicalIndex];
    state.whimsicalIndex = (state.whimsicalIndex + 1) % t.whimsical.length;

    elements.forEach(el => {
        el.textContent = text;
    });
}

// --- Expose Globals ---
window.handlePreviewClick = function(event, btn, url, resultId) {
    requestPreview(url, btn, resultId);
};
window.removeFromCart = removeFromCart;
window.resetSession = resetSession;
window.restoreSession = restoreSession;
window.deleteHistoryItem = deleteHistoryItem;

document.addEventListener('DOMContentLoaded', init);