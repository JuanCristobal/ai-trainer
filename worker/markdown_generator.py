from typing import List, Dict
from datetime import datetime

def seconds_to_timestamp(seconds: float) -> str:
    """Formats seconds to [MM:SS] or [HH:MM:SS]"""
    seconds = int(seconds)
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    
    if h > 0:
        return f"[{h:02d}:{m:02d}:{s:02d}]"
    return f"[{m:02d}:{s:02d}]"

def generate_markdown(metadata: Dict, segments: List) -> str:
    """
    Generates a Markdown string with Frontmatter and formatted transcript.
    Zero dependencies: Uses f-strings only.
    """
    
    # 1. Frontmatter (YAML-like)
    # Safely get values or defaults
    title = metadata.get("title", "Unknown Video").replace('"', '\"')
    url = metadata.get("url", "Unknown URL")
    date = datetime.now().strftime("%Y-%m-%d")
    
    frontmatter = f"""
---
title: "{title}"
source: "{url}"
date: {date}
generated_by: "Gemini Video To Text"
---

# {metadata.get('title', 'Transcript')}
"""

    # 2. Transcript Body
    # Buffer for efficient string concatenation
    lines = [frontmatter]
    
    for segment in segments:
        # Whisper segment object usually has: start, end, text
        ts = seconds_to_timestamp(segment.start)
        text = segment.text.strip()
        
        if text:
            lines.append(f"**{ts}** {text}\n")
            
    return "\n".join(lines)
