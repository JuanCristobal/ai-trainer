import os
import json
import time
import logging
import shutil
import subprocess
from utils.redis_client import get_redis_client
from faster_whisper import WhisperModel
from preview import generate_preview
from markdown_generator import generate_markdown

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("worker")

redis_client = get_redis_client()

# Initialize Whisper (Load once on startup)
# Use "base" model as per requirements for CPU/Speed balance
model_size = "base"
try:
    logger.info(f"Loading Whisper model: {model_size}...")
    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    logger.info("Whisper model loaded.")
except Exception as e:
    logger.error(f"Failed to load Whisper model: {e}")
    model = None # Handle gracefully later

def update_job_status(job_id, status, result=None, error=None):
    payload = {"status": status}
    if result:
        payload["result_text"] = result
    if error:
        payload["error"] = error
        
    redis_client.hset(f"job:{job_id}", mapping=payload)
    logger.info(f"Job {job_id} -> {status}")

def process_subtitles(url, job_id):
    """Priority 1: Try extracting existing subs"""
    try:
        cmd = [
            "yt-dlp",
            "--write-sub",
            "--skip-download",
            "--sub-lang", "en,es",
            "--convert-subs", "vtt",
            "--output", f"/tmp/{job_id}",
            url
        ]
        subprocess.run(cmd, check=True, capture_output=True)
        
        # Check for both EN and ES vtt files
        for lang in ["en", "es"]:
            vtt_path = f"/tmp/{job_id}.{lang}.vtt"
            if os.path.exists(vtt_path):
                with open(vtt_path, "r") as f:
                    content = f.read()
                # Cleanup all potential sub files
                for l in ["en", "es"]:
                    p = f"/tmp/{job_id}.{l}.vtt"
                    if os.path.exists(p):
                        os.remove(p)
                return content
    except Exception as e:
        logger.warning(f"Subtitle extraction failed: {e}")
    return None

def process_whisper(url, job_id, job_metadata):
    """Priority 2: Download audio & Transcribe"""
    # we don't know the extension yet, so we look for any file starting with job_id
    try:
        # 1. Download Audio (Best Quality, No Re-encoding)
        logger.info(f"Downloading audio for {job_id}...")
        subprocess.run([
            "yt-dlp",
            "-f", "ba", # Best Audio
            "--output", f"/tmp/{job_id}.%(ext)s",
            url
        ], check=True, capture_output=True)
        
        # Find the downloaded file (m4a, webm, etc)
        audio_path = None
        for file in os.listdir("/tmp"):
            if file.startswith(job_id) and file != job_id: # ignore directories
                audio_path = os.path.join("/tmp", file)
                break
        
        if not audio_path:
            raise Exception("Audio download failed")

        # 2. Transcribe
        logger.info(f"Transcribing {job_id} with Whisper...")
        segments_generator, info = model.transcribe(audio_path, beam_size=5)
        
        # Iterate generator to get full list for our markdown generator
        segments = list(segments_generator)
        
        # 3. Generate Markdown
        markdown = generate_markdown(job_metadata, segments)
            
        return markdown
        
    except Exception as e:
        logger.error(f"Whisper failed: {e}")
        raise e
    finally:
        # Cleanup
        if os.path.exists(audio_path):
            os.remove(audio_path)

def worker_loop():
    logger.info("Worker started. Waiting for jobs...")
    while True:
        # Blocking pop from queue (timeout 5s to allow clean shutdown checks)
        task = redis_client.blpop("queue:transcription", timeout=5)
        
        if not task:
            continue
            
        _, payload_json = task
        job = json.loads(payload_json)
        job_id = job["job_id"]
        url = job["url"]
        
        logger.info(f"Processing job: {job_id} ({url})")
        update_job_status(job_id, "processing")
        
        try:
            job_type = job.get("type", "full")
            
            if job_type == "preview":
                # Preview Mode
                duration = job.get("duration", 0)
                if not model:
                     raise Exception("Whisper model not available")
                result = generate_preview(url, duration, model)
                update_job_status(job_id, "completed", result=result)
            else:
                # Full Transcription Mode
                # Strategy 1: Subtitles
                result = process_subtitles(url, job_id)
                
                # Strategy 2: Whisper
                if not result:
                    logger.info("No subtitles found. Falling back to Whisper.")
                    if model:
                        result = process_whisper(url, job_id, job)
                    else:
                        raise Exception("Whisper model not available")                
                if result:
                    update_job_status(job_id, "completed", result=result)
                else:
                    update_job_status(job_id, "failed", error="Could not extract transcript")
                
        except Exception as e:
            logger.error(f"Job {job_id} failed: {e}")
            update_job_status(job_id, "failed", error=str(e))

if __name__ == "__main__":
    worker_loop()
