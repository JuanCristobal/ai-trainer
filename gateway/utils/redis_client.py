import os
import redis

def get_redis_client():
    # Check for REDIS_URL (Railway/Prod) first, then fall back to local Docker hostname
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379")
    return redis.from_url(redis_url, decode_responses=True)
