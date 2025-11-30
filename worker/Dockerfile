FROM python:3.10-slim

# Install system dependencies
# - ffmpeg: for audio processing
# - git: for installing python packages from git
# - build-essential: for compiling C extensions (needed for some faster-whisper deps)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONUNBUFFERED=1

CMD ["python", "main.py"]