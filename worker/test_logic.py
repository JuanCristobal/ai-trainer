import logging
import sys
import os

# Ensure we can import from the current directory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import process_subtitles, process_whisper

# Configure logging to stdout
logging.basicConfig(level=logging.INFO, stream=sys.stdout)

def test_transcription():
    # A short, safe YouTube video for testing (Google's "20 Years of Search" - short version or similar)
    # Using a very short video to save time: "Example Short Video"
    # Actually, let's use a known short video. 
    # "Homer Simpson - The Land of Chocolate" (approx 1 min) or something shorter.
    # Let's use a generic test video.
    test_url = "https://www.youtube.com/watch?v=jNQXAC9IVRw" # "Me at the zoo" (19s) - perfect for testing. 
    job_id = "test_manual_run"

    print(f"\n=== TESTING WITH URL: {test_url} ===\n")

    print("--- 1. Testing Subtitle Extraction (yt-dlp) ---")
    try:
        subs = process_subtitles(test_url, job_id)
        if subs:
            print(">>> SUCCESS: Subtitles found!")
            print(f"Snippet: {subs[:200]}...\n")
        else:
            print(">>> INFO: No subtitles found (or extraction returned None).\n")
    except Exception as e:
        print(f">>> ERROR: Subtitle extraction crashed: {e}\n")

    print("--- 2. Testing Whisper Transcription (faster-whisper) ---")
    print("Note: This downloads audio and runs the model. Please wait...")
    try:
        # process_whisper relies on the 'model' global in main.py being initialized.
        # Importing main should have triggered the model load.
        transcript = process_whisper(test_url, job_id)
        print(">>> SUCCESS: Whisper transcription complete!")
        print(f"Transcript Snippet: {transcript[:500]}...\n")
    except Exception as e:
        print(f">>> ERROR: Whisper crashed: {e}\n")

if __name__ == "__main__":
    test_transcription()
