import os
import subprocess
import logging
import uuid
import time

logger = logging.getLogger("worker")

def generate_preview(url: str, total_duration: float, model) -> str:
    """
    Generates a text preview for a video by:
    1. Calculating the preview duration (Max 30s or 30% of total).
    2. Streaming & Trimming audio on-the-fly (yt-dlp -> ffmpeg).
    3. Transcribing the small clip with Whisper.
    """
    
    # 1. Calculate Preview Duration
    # Rule: MIN(30 seconds, Total_Duration * 0.30)
    preview_duration = min(30.0, float(total_duration) * 0.30)
    
    # Safety floor
    if preview_duration < 1.0:
        preview_duration = 1.0

    logger.info(f"Generating preview for {url}. Target duration: {preview_duration:.2f}s")

    # Temporary file for the audio snippet
    temp_filename = f"/tmp/preview_{uuid.uuid4().hex}.wav"

    p1 = None
    p2 = None

    try:
        # 2. The Pipeline (Streaming Pipe)
        # yt-dlp -> stdout | ffmpeg -> file
        
        # yt-dlp command: fetch best audio, dump to stdout
        # -f ba: Best Audio
        # -o -: Stdout
        yt_dlp_cmd = [
            "yt-dlp",
            "-f", "ba", 
            "-o", "-",        
            "--quiet",        
            "--no-warnings",
            url
        ]

        # ffmpeg command: read from pipe:0 (stdin), trim, convert to Whisper format
        # -t duration: Stop writing after 'duration' seconds
        # -ac 1: Mono
        # -ar 16000: 16kHz sample rate
        # -c:a pcm_s16le: WAV PCM format
        ffmpeg_cmd = [
            "ffmpeg",
            "-i", "pipe:0",
            "-t", str(preview_duration),
            "-ac", "1",
            "-ar", "16000",
            "-c:a", "pcm_s16le",
            "-y",
            temp_filename
        ]

        logger.info("Starting streaming download and trim...")
        start_time = time.time()

        # pipe yt-dlp stdout -> ffmpeg stdin
        p1 = subprocess.Popen(yt_dlp_cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        p2 = subprocess.Popen(ffmpeg_cmd, stdin=p1.stdout, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # Allow p1 to receive SIGPIPE if p2 exits early
        # We close the write end of the pipe in the parent so only p2 holds it
        p1.stdout.close()

        try:
            # Wait for ffmpeg to finish (it controls the duration)
            p2.wait(timeout=45)
        except subprocess.TimeoutExpired:
            logger.error("Preview generation timed out (45s). Killing processes.")
            p2.kill()
            if p1: p1.kill()
            raise TimeoutError("Preview extraction timed out.")

        # Ensure p1 terminates (it should have received SIGPIPE when p2 closed stdin, or finished)
        p1.wait()

        if not os.path.exists(temp_filename) or os.path.getsize(temp_filename) == 0:
             raise Exception("FFmpeg failed to generate audio file.")

        logger.info(f"Audio snippet created ({time.time() - start_time:.2f}s). Transcribing...")

        # 3. Transcribe with Whisper
        # We use the passed model instance
        segments, _ = model.transcribe(
            temp_filename, 
            beam_size=5,
            # We don't strictly enforce language, letting Whisper detect it, 
            # but usually for preview English is the safe bet if forced.
            # Keeping it auto for now.
        )

        transcript = []
        for segment in segments:
            transcript.append(segment.text.strip())
        
        full_text = " ".join(transcript)
        return full_text

    except Exception as e:
        logger.error(f"Preview failed: {e}")
        # Clean up processes if they are still running
        if p2 and p2.poll() is None: p2.kill()
        if p1 and p1.poll() is None: p1.kill()
        raise e
        
    finally:
        # 4. Cleanup
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
