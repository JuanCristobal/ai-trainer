import os
import json
import logging
import subprocess
import uuid
import io
import zipfile
from typing import List, Dict
from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
import stripe
from utils.redis_client import get_redis_client

print("Gateway Starting...")

# --- Config ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gateway")

app = FastAPI()

# CORS - Allow everything for MVP/Local dev
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

# --- Helpers ---
def calculate_price(duration_seconds: int) -> float:
    """
    Pricing: $0.20 Base + $0.10 per minute
    Example: 5 min video = 0.20 + (5 * 0.10) = $0.70
    """
    if duration_seconds > 1800: # 30 mins hard limit
        raise ValueError("Video exceeds 30 minute limit.")
    
    minutes = duration_seconds / 60.0
    price = 0.20 + (minutes * 0.10)
    return round(price, 2)

def get_video_metadata(url: str) -> Dict:
    """Extracts metadata using yt-dlp"""
    try:
        cmd = [
            "yt-dlp",
            "--dump-json",
            "--no-warnings",
            url
        ]
        # Run command
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(result.stdout)
        
        # DEBUG LOGGING
        logger.info(f"yt-dlp raw data keys: {data.keys()}")
        
        duration = data.get("duration")
        duration_string = data.get("duration_string")
        
        # Fallback: Try duration_string if duration is missing/zero
        if not duration and duration_string:
            d_str = duration_string
            logger.info(f"Numeric duration missing, attempting to parse: {d_str}")
            try:
                # Handle HH:MM:SS or MM:SS or SS
                parts = list(map(int, d_str.split(':')))
                if len(parts) == 3:
                    duration = parts[0]*3600 + parts[1]*60 + parts[2]
                elif len(parts) == 2:
                    duration = parts[0]*60 + parts[1]
                elif len(parts) == 1:
                    duration = parts[0]
            except Exception as e:
                logger.error(f"Failed to parse duration_string '{d_str}': {e}")
                
        if not duration:
            logger.warning("No valid duration found! Defaulting to 1s.")
            duration = 1 
            
        return {
            "title": data.get("title", "Unknown Video"),
            "duration": duration,
            "thumbnail": data.get("thumbnail"),
            "platform": data.get("extractor_key"),
            "uploader": data.get("uploader")
        }
    except subprocess.CalledProcessError as e:
        logger.error(f"yt-dlp error for URL {url}: {e.stderr}")
        # Include snippet of stderr in details
        detail_msg = f"Invalid URL or metadata error. Details: {e.stderr[:200] if e.stderr else 'Unknown error'}"
        raise HTTPException(status_code=400, detail=detail_msg)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- Endpoints ---

@app.get("/")
def health_check():
    return {"status": "ok", "service": "gateway"}

@app.post("/api/cart/add")
def add_to_cart(req: AddToCartRequest):
    # 1. Fetch Metadata
    metadata = get_video_metadata(req.url)
    
    # 2. Calculate Price
    try:
        price = calculate_price(metadata["duration"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 3. Create Cart Item
    item_id = str(uuid.uuid4())
    item = {
        "id": item_id,
        "url": req.url,
        "title": metadata["title"],
        "duration": metadata["duration"],
        "thumbnail": metadata["thumbnail"],
        "price": price
    }

    # 4. Save to Redis
    key = f"cart:{req.session_id}"
    redis_client.hset(key, item_id, json.dumps(item))
    redis_client.expire(key, 86400) # 24h TTL

    return {"message": "Added to cart", "item": item}

@app.post("/api/preview")
def request_preview(req: PreviewRequest):
    # 1. Fetch Metadata (to get duration)
    try:
        metadata = get_video_metadata(req.url)
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Metadata fetch failed: {e}")
        raise HTTPException(status_code=400, detail="Could not fetch video metadata")

    # 2. Create Job
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

    # 3. Store in Redis
    redis_client.hset(f"job:{job_id}", mapping=job_payload)
    redis_client.expire(f"job:{job_id}", 3600)

    # 4. Push to Worker Queue
    redis_client.rpush("queue:transcription", json.dumps(job_payload))

    return {"job_id": job_id, "message": "Preview generation started"}

@app.get("/api/job/{job_id}")
def get_job_status(job_id: str):
    # Generic endpoint for both Preview and Full jobs
    job = redis_client.hgetall(f"job:{job_id}")
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    return {
        "job_id": job.get("job_id"),
        "status": job.get("status"),
        "result": job.get("result_text"),
        "error": job.get("error")
    }

@app.get("/api/cart")
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

@app.delete("/api/cart/{item_id}")
def remove_from_cart(item_id: str, session_id: str):
    key = f"cart:{session_id}"
    deleted = redis_client.hdel(key, item_id)
    if deleted:
        return {"message": "Item removed"}
    raise HTTPException(status_code=404, detail="Item not found")

@app.post("/api/checkout")
def create_checkout_session(req: CheckoutRequest):
    # 1. Get Cart
    key = f"cart:{req.session_id}"
    items_raw = redis_client.hgetall(key)
    
    if not items_raw:
        raise HTTPException(status_code=400, detail="Cart is empty")
        
    line_items = []
    total_amount = 0
    
    for item_json in items_raw.values():
        item = json.loads(item_json)
        amount_cents = int(item["price"] * 100)
        total_amount += amount_cents
        
        line_items.append({
            "price_data": {
                "currency": "usd",
                "product_data": {
                    "name": item["title"],
                    "description": f"Duration: {item['duration']}s",
                    "images": [item["thumbnail"]] if item.get("thumbnail") else [],
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

@app.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
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
    """Moves items from Cart to Job Queue"""
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
        
        # 1. Create Job Status Key
        redis_client.hset(f"job:{job_id}", mapping=job_payload)
        redis_client.expire(f"job:{job_id}", 3600) # 1h TTL
        
        # 2. Link Job to Session
        redis_client.rpush(f"jobs:{session_id}", job_id)
        redis_client.expire(f"jobs:{session_id}", 3600)
        
        # 3. Push to Worker Queue
        redis_client.rpush("queue:transcription", json.dumps(job_payload))
        
    # Clear Cart
    redis_client.delete(cart_key)
    logger.info(f"Processed payment for session {session_id}. Jobs queued.")

@app.post("/api/dev/pay")
async def dev_simulate_payment(req: CheckoutRequest):
    """
    DEV ONLY: Simulates a successful payment webhook.
    Moves items from cart to worker queue immediately.
    """
    logger.info(f"DEV: Simulating payment for session {req.session_id}")
    
    # Reuse the exact same logic as the webhook
    await process_successful_payment(req.session_id)
    
    return {"status": "success", "message": "Dev payment simulated"}

@app.get("/api/jobs")
def get_jobs(session_id: str):
    job_ids = redis_client.lrange(f"jobs:{session_id}", 0, -1)
    jobs = []
    
    for jid in job_ids:
        job_data = redis_client.hgetall(f"job:{jid}")
        if job_data:
            jobs.append(job_data)
            
    return {"jobs": jobs}

@app.get("/api/download/{job_id}")
def download_result(job_id: str, format: str = "md"):
    # Check if job exists
    job = redis_client.hgetall(f"job:{job_id}")
    if not job or job.get("status") != "completed":
        raise HTTPException(status_code=404, detail="Result not found or not ready")
        
    content = job.get("result_text") 
    
    if not content:
         raise HTTPException(status_code=404, detail="Content empty")
    
    # Clean filename
    title = job.get("title", "transcript").replace("/", "_").replace("\\", "_")
    filename = f"{title}.{format}"

    # Return as file download
    return Response(
        content=content,
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/api/download-all/{session_id}")
def download_all_zip(session_id: str):
    """Bundles all completed transcripts into a single ZIP file."""
    # 1. Get all jobs for session
    job_ids = redis_client.lrange(f"jobs:{session_id}", 0, -1)
    if not job_ids:
        raise HTTPException(status_code=404, detail="No jobs found for this session")

    # 2. Prepare ZIP in memory
    zip_buffer = io.BytesIO()
    files_added = 0

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for jid in job_ids:
            job = redis_client.hgetall(f"job:{jid}")
            if job and job.get("status") == "completed":
                content = job.get("result_text")
                if content:
                    # Clean filename
                    title = job.get("title", f"transcript_{jid}").replace("/", "_").replace("\\", "_")
                    filename = f"{title}.md"
                    zf.writestr(filename, content)
                    files_added += 1
    
    if files_added == 0:
        raise HTTPException(status_code=404, detail="No completed transcripts found to zip.")

    zip_buffer.seek(0)
    
    # 3. Stream Response
    return StreamingResponse(
        zip_buffer, 
        media_type="application/zip", 
        headers={"Content-Disposition": f"attachment; filename=transcripts_{session_id[:8]}.zip"}
    )