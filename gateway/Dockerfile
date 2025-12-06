FROM python:3.10-slim

# Install ffmpeg for audio trimming (Preview logic) - Gateway needs it for duration check? 
# Actually yt-dlp needs it sometimes, but usually metadata is JSON only.
# Safest to keep it if we run yt-dlp commands.
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for caching
COPY gateway/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Gateway Code
COPY gateway/ .

# Copy Frontend Code (from root context)
COPY frontend/ /app/frontend

# CMD for Production / Railway (dynamic port via $PORT)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
