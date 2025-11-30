import os
import json
import logging
import subprocess
import uuid
from typing import List, Dict
from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import stripe
from utils.redis_client import get_redis_client

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
            "--flat-playlist",
            "--no-warnings",
            url
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(result.stdout)
        
        duration = data.get("duration")
        if not duration:
            raise ValueError("Could not determine video duration.")
            
        return {
            "title": data.get("title", "Unknown Video"),
            "duration": duration,
            "thumbnail": data.get("thumbnail"),
            "platform": data.get("extractor_key"),
            "uploader": data.get("uploader")
        }
    except subprocess.CalledProcessError as e:
        logger.error(f"yt-dlp error: {e.stderr}")
        raise HTTPException(status_code=400, detail="Invalid URL or unable to fetch metadata.")
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

    # 4. Save to Redis (Hash: cart:{session_id})
    key = f"cart:{req.session_id}"
    redis_client.hset(key, item_id, json.dumps(item))
    redis_client.expire(key, 86400) # 24h TTL

    return {"message": "Added to cart", "item": item}

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
            success_url="http://localhost:3000/downloads.html?session_id=" + req.session_id, # Update for Prod
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
        
    content = job.get("result_text") # Assuming plain text/md stored
    
    if not content:
         raise HTTPException(status_code=404, detail="Content empty")

    # Basic content disposition (browser will download)
    return {
        "filename": f"{job.get('title', 'transcript')}.{format}",
        "content": content
    }
