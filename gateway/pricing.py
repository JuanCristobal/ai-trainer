import os

# Hardcoded fallback for dev, but should be in .env for Prod
PADDLE_API_KEY = os.getenv("PADDLE_API_KEY")

# Paddle Price IDs (To be filled with real IDs from Paddle Dashboard)
# Structure: "pri_..."
TIER_1_ID = os.getenv("PADDLE_TIER_1_ID", "pri_tier1_placeholder") # 0-15m
TIER_2_ID = os.getenv("PADDLE_TIER_2_ID", "pri_tier2_placeholder") # 16-45m
TIER_3_ID = os.getenv("PADDLE_TIER_3_ID", "pri_tier3_placeholder") # 46-120m

def get_price_id_for_duration(total_seconds: int) -> str:
    """
    Maps total cart duration to a specific Paddle Price ID.
    Tier 1: 0 - 15 mins (900s) -> $1.99
    Tier 2: 16 - 45 mins (2700s) -> $4.99
    Tier 3: 46 - 120 mins (7200s) -> $9.99
    """
    if total_seconds <= 900:
        return TIER_1_ID
    elif total_seconds <= 2700:
        return TIER_2_ID
    else:
        return TIER_3_ID
