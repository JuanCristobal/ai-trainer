import os
import json
import logging
import subprocess
import uuid
import io
import zipfile
from typing import List, Dict
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, Header, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import stripe
import asyncpg
from utils.redis_client import get_redis_client

print("Gateway Starting...")

# --- Config ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gateway")
DATABASE_URL = os.getenv("DATABASE_URL")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    if DATABASE_URL:
        try:
            logger.info("Connecting to DB...")
            app.state.db_pool = await asyncpg.create_pool(DATABASE_URL)
            
            async with app.state.db_pool.acquire() as connection:
                await connection.execute("""
                    CREATE TABLE IF NOT EXISTS sales_ledger (
                        id SERIAL PRIMARY KEY,
                        session_id TEXT NOT NULL,
                        provider_tx_id TEXT NOT NULL,
                        amount_cents INT NOT NULL,
                        item_count INT DEFAULT 1,
                        created_at TIMESTAMP DEFAULT NOW()
                    );
                """)
            logger.info("DB connected and table verified.")
        except Exception as e:
            logger.error(f"DB Connection failed: {e}")
            app.state.db_pool = None
    else:
        logger.warning("DATABASE_URL not set. Running without DB.")
        app.state.db_pool = None
        
    yield
    
    # Shutdown
    if app.state.db_pool:
        logger.info("Closing DB connection...")
        await app.state.db_pool.close()

app = FastAPI(lifespan=lifespan)

# --- CORS (CRITICAL: Must be first middleware) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Clients
redis_client = get_redis_client()
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

# --- Models ---
class AddToCartRequest(BaseModel):
    session_id: str
    url: str

class RemoveFromCartRequest(BaseModel):
    session_id: str
    item_id: str

class CheckoutRequest(BaseModel):
    session_id: str

class PreviewRequest(BaseModel):
    session_id: str
    url: str

import re

# --- Helpers ---
def validate_url(url: str) -> str:
    """
    Security: Prevent Command Injection and SSRF.
    1. Must start with http:// or https://
    2. Must match known domains (youtube, tiktok, instagram) or basic URL structure
    3. Must not contain leading dashes (argument injection)
    """
    if not url.startswith(("http://", "https://")):
        raise ValueError("Invalid URL schema")
    
    if url.strip().startswith("-"):
        raise ValueError("Invalid URL format")
        
    # Basic domain whitelist (adjust as needed)
    allowed_domains = [
        r"^https?://(www\.)?youtube\.com/",
        r"^https?://youtu\.be/",
        r"^https?://(www\.)?tiktok\.com/",
        r"^https?://(www\.)?instagram\.com/"
    ]
    
    if not any(re.match(pattern, url) for pattern in allowed_domains):
        # Fallback for now: allow generic http(s) but ensure no spaces/control chars
        # strictly to prevent shell expansion if any
        if not re.match(r"^https?://[a-zA-Z0-9\-\._~:/?#\[\]@!$&'\(\)*+,;=%]+$", url):
             raise ValueError("URL domain not allowed or malformed")

    return url

def calculate_price(duration_seconds: int) -> float:
    if duration_seconds > 1800:
        raise ValueError("Video exceeds 30 minute limit.")
    minutes = duration_seconds / 60.0
    price = 0.20 + (minutes * 0.10)
    return round(price, 2)

def get_video_metadata(url: str) -> Dict:
    """Extracts metadata using yt-dlp"""
    # 1. Validate URL
    try:
        safe_url = validate_url(url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        # 2. Secure Command (Use '--' to separate args)
        cmd = [
            "yt-dlp",
            "--dump-json",
            "--no-warnings",
            "--", # Security barrier
            safe_url
        ]
        # Run command with timeout
        result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=30)
        data = json.loads(result.stdout)
        
        duration = data.get("duration")
        duration_string = data.get("duration_string")
        
        if not duration and duration_string:
            d_str = duration_string
            try:
                parts = list(map(int, d_str.split(':')))
                if len(parts) == 3:
                    duration = parts[0]*3600 + parts[1]*60 + parts[2]
                elif len(parts) == 2:
                    duration = parts[0]*60 + parts[1]
                elif len(parts) == 1:
                    duration = parts[0]
            except Exception:
                pass
                
        if not duration:
            duration = 1 
            
        return {
            "title": data.get("title", "Unknown Video"),
            "duration": duration,
            "thumbnail": data.get("thumbnail"),
            "platform": data.get("extractor_key"),
            "uploader": data.get("uploader")
        }
    except subprocess.TimeoutExpired:
        logger.error(f"yt-dlp timeout for URL {url}")
        raise HTTPException(status_code=408, detail="Metadata fetch timed out")
    except subprocess.CalledProcessError as e:
        # Do NOT leak full stderr
        logger.error(f"yt-dlp error for URL {url}: {e.stderr}")
        raise HTTPException(status_code=400, detail="Could not fetch metadata. Is the video valid/public?")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- API Router ---
api = APIRouter(prefix="/api")

@api.get("/health")
def health_check():
    return {"status": "ok", "service": "gateway"}

@api.post("/cart/add")
def add_to_cart(req: AddToCartRequest):
    # Validate session_id
    if not re.match(r"^[a-f0-9\-]+$", req.session_id):
        raise HTTPException(status_code=400, detail="Invalid Session ID")

    metadata = get_video_metadata(req.url)
    try:
        price = calculate_price(metadata["duration"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    item_id = str(uuid.uuid4())
    item = {
        "id": item_id,
        "url": req.url,
        "title": metadata["title"],
        "duration": metadata["duration"],
        "thumbnail": metadata["thumbnail"],
        "price": price
    }

    key = f"cart:{req.session_id}"
    redis_client.hset(key, item_id, json.dumps(item))
    redis_client.expire(key, 86400) 

    return {"message": "Added to cart", "item": item}

@api.post("/preview")
def request_preview(req: PreviewRequest):
    try:
        metadata = get_video_metadata(req.url)
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Metadata fetch failed: {e}")
        raise HTTPException(status_code=400, detail="Could not fetch video metadata")

    job_id = f"preview:{uuid.uuid4()}"
    job_payload = {
        "job_id": job_id,
        "session_id": req.session_id,
        "url": req.url,
        "title": metadata["title"],
        "duration": metadata["duration"],
        "type": "preview",
        "status": "queued"
    }

    redis_client.hset(f"job:{job_id}", mapping=job_payload)
    redis_client.expire(f"job:{job_id}", 3600)
    redis_client.rpush("queue:transcription", json.dumps(job_payload))

    return {"job_id": job_id, "message": "Preview generation started"}

@api.get("/job/{job_id}")
def get_job_status(job_id: str):
    job = redis_client.hgetall(f"job:{job_id}")
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "job_id": job.get("job_id"),
        "status": job.get("status"),
        "result": job.get("result_text"),
        "error": job.get("error")
    }

@api.get("/cart")
def get_cart(session_id: str):
    key = f"cart:{session_id}"
    items_raw = redis_client.hgetall(key)
    items = []
    total_price = 0.0
    for item_json in items_raw.values():
        item = json.loads(item_json)
        items.append(item)
        total_price += item["price"]
    return {
        "items": items,
        "total_price": round(total_price, 2)
    }

@api.delete("/cart/{item_id}")
def remove_from_cart(item_id: str, session_id: str):
    key = f"cart:{session_id}"
    deleted = redis_client.hdel(key, item_id)
    if deleted:
        return {"message": "Item removed"}
    raise HTTPException(status_code=404, detail="Item not found")

@api.post("/checkout")
def create_checkout_session(req: CheckoutRequest):
    key = f"cart:{req.session_id}"
    items_raw = redis_client.hgetall(key)
    if not items_raw:
        raise HTTPException(status_code=400, detail="Cart is empty")
    
    line_items = []
    for item_json in items_raw.values():
        item = json.loads(item_json)
        amount_cents = int(item["price"] * 100)
        line_items.append({
            "price_data": {
                "currency": "usd",
                "product_data": {
                    "name": item["title"],
                    "description": f"Duration: {item['duration']}s",
                },
                "unit_amount": amount_cents,
            },
            "quantity": 1,
        })

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=line_items,
            mode="payment",
            success_url="http://localhost:3000/downloads.html?session_id=" + req.session_id, 
            cancel_url="http://localhost:3000/?canceled=true",
            metadata={"session_id": req.session_id}
        )
        return {"url": session.url}
    except Exception as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=500, detail="Stripe Checkout Error")

@api.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        session_id = session["metadata"].get("session_id")
        if session_id:
            await process_successful_payment(session_id)
    return {"status": "success"}

async def process_successful_payment(session_id: str):
    cart_key = f"cart:{session_id}"
    items_raw = redis_client.hgetall(cart_key)
    for item_id, item_json in items_raw.items():
        item = json.loads(item_json)
        job_id = str(uuid.uuid4())
        job_payload = {
            "job_id": job_id,
            "session_id": session_id,
            "url": item["url"],
            "title": item["title"],
            "status": "queued"
        }
        redis_client.hset(f"job:{job_id}", mapping=job_payload)
        redis_client.expire(f"job:{job_id}", 3600) 
        redis_client.rpush(f"jobs:{session_id}", job_id)
        redis_client.expire(f"jobs:{session_id}", 3600)
        redis_client.rpush("queue:transcription", json.dumps(job_payload))
    redis_client.delete(cart_key)
    logger.info(f"Processed payment for session {session_id}.")

@api.post("/dev/pay")
async def dev_simulate_payment(req: CheckoutRequest):
    # Security Gate
    if os.getenv("ENV") != "development":
        raise HTTPException(status_code=403, detail="Dev endpoints disabled in production")

    logger.info(f"DEV: Simulating payment for session {req.session_id}")
    
    # 1. Calculate Total Amount (Before cart is cleared)
    cart_key = f"cart:{req.session_id}"
    items_raw = redis_client.hgetall(cart_key)
    total_cents = 0
    item_count = 0
    
    if items_raw:
        for item_json in items_raw.values():
            item = json.loads(item_json)
            total_cents += int(item.get("price", 0) * 100)
            item_count += 1
            
    # 2. Process Payment (Moves to queue, clears cart)
    await process_successful_payment(req.session_id)
    
    # 3. Log to DB
    if app.state.db_pool:
        try:
            async with app.state.db_pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO sales_ledger (session_id, provider_tx_id, amount_cents, item_count)
                    VALUES ($1, $2, $3, $4)
                """, req.session_id, f"dev_mock_{uuid.uuid4()}", total_cents, item_count)
        except Exception as e:
            logger.error(f"Failed to log dev sale: {e}")
            
    return {"status": "success", "message": "Dev payment simulated"}

@api.get("/download/{job_id}")
def download_result(job_id: str, format: str = "md"):
    job = redis_client.hgetall(f"job:{job_id}")
    if not job or job.get("status") != "completed":
        raise HTTPException(status_code=404, detail="Result not found or not ready")
    content = job.get("result_text") 
    if not content:
         raise HTTPException(status_code=404, detail="Content empty")
    
    title = job.get("title", "transcript").replace("/", "_").replace("\\", "_")

    filename = f"{title}.{format}"
    
    return Response(
        content=content,
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@api.get("/download-all/{session_id}")
def download_all_zip(session_id: str):
    job_ids = redis_client.lrange(f"jobs:{session_id}", 0, -1)
    if not job_ids:
        raise HTTPException(status_code=404, detail="No jobs found for this session")
    zip_buffer = io.BytesIO()
    files_added = 0
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for jid in job_ids:
            job = redis_client.hgetall(f"job:{jid}")
            if job and job.get("status") == "completed":
                content = job.get("result_text")
                if content:
                    title = job.get("title", f"transcript_{jid}").replace("/", "_").replace("\\", "_")
                    filename = f"{title}.md"
                    zf.writestr(filename, content)
                    files_added += 1
    if files_added == 0:
        raise HTTPException(status_code=404, detail="No completed transcripts found.")
    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer, 
        media_type="application/zip", 
        headers={"Content-Disposition": f"attachment; filename=transcripts_{session_id[:8]}.zip"}
    )

@api.get("/jobs")
def get_jobs(session_id: str):
    job_ids = redis_client.lrange(f"jobs:{session_id}", 0, -1)
    jobs = []
    for jid in job_ids:
        job_data = redis_client.hgetall(f"job:{jid}")
        if job_data:
            jobs.append(job_data)
    return {"jobs": jobs}

# Register API Router
app.include_router(api)

# --- Static Files & Specific Routes ---

@app.get("/")
async def read_index():
    return FileResponse('/app/frontend/index.html')

@app.get("/app.js")
async def read_js():
    return FileResponse('/app/frontend/app.js', media_type="application/javascript")

@app.get("/styles.css")
async def read_css():
    return FileResponse('/app/frontend/styles.css', media_type="text/css")

@app.get("/downloads.html")
async def read_downloads():
    return FileResponse('/app/frontend/downloads.html')

# Fallback mount
app.mount("/", StaticFiles(directory="/app/frontend"), name="static")