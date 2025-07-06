#!/usr/bin/env python3
import os
import sys
import wave
import json
import logging
import tempfile
from vosk import Model, KaldiRecognizer
from pydub import AudioSegment

# ✅ Silence unnecessary Vosk logs
logging.getLogger().setLevel(logging.ERROR)

# ✅ Unicode output (especially for Hindi)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding='utf-8')

def print_error(msg):
    print(f"[CLI ERROR]: {msg}", file=sys.stderr)

# ✅ Validate arguments
if len(sys.argv) < 3:
    print_error("Usage: python cli_transcribe.py <mp3_path> <output_path>")
    sys.exit(1)

mp3_path, output_path = sys.argv[1], sys.argv[2]

if not os.path.exists(mp3_path):
    print_error(f"File not found: {mp3_path}")
    sys.exit(1)

if not os.path.isfile(mp3_path):
    print_error(f"Path is not a file: {mp3_path}")
    sys.exit(1)

if os.path.getsize(mp3_path) == 0:
    print_error(f"File is empty: {mp3_path}")
    sys.exit(1)

print(f"[INFO]: Input file size: {os.path.getsize(mp3_path) / 1024:.2f} KB")

# ✅ Locate model path
model_paths = [
    "transcriber/vosk-model/vosk-model-hi-0.22",
    "vosk-model/vosk-model-hi-0.22",
    "./vosk-model-hi-0.22",
    "../vosk-model-hi-0.22",
    os.path.join(os.path.dirname(__file__), "vosk-model", "vosk-model-hi-0.22")
]
model_path = next((p for p in model_paths if os.path.exists(p)), None)

if not model_path:
    print_error("Hindi Vosk model not found.")
    for p in model_paths:
        print_error(f"  - {p}")
    sys.exit(1)

print(f"[INFO]: Using model at: {model_path}")

# ✅ Load model
try:
    print("[INFO]: Loading Vosk model...")
    model = Model(model_path)
    print("[INFO]: Model loaded successfully")
except Exception as e:
    print_error(f"Failed to load model: {e}")
    sys.exit(1)

# ✅ Convert MP3 → WAV
temp_wav_path = None
try:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_wav:
        temp_wav_path = temp_wav.name
    print("[INFO]: Converting MP3 to WAV...")
    audio = AudioSegment.from_file(mp3_path)
    audio = audio.set_channels(1).set_frame_rate(16000)
    audio.export(temp_wav_path, format="wav")

    if os.path.getsize(temp_wav_path) == 0:
        raise Exception("WAV conversion failed, empty file")

    print(f"[INFO]: WAV created: {os.path.getsize(temp_wav_path)/1024:.2f} KB")

    # ✅ Transcribe
    result_text = ""
    with wave.open(temp_wav_path, "rb") as wf:
        if wf.getnchannels() != 1 or wf.getframerate() != 16000:
            print_error("WAV must be mono and 16kHz")
            sys.exit(1)

        rec = KaldiRecognizer(model, wf.getframerate())
        while True:
            data = wf.readframes(4000)
            if not data:
                break
            if rec.AcceptWaveform(data):
                res = json.loads(rec.Result())
                result_text += res.get("text", "") + " "

        final = json.loads(rec.FinalResult())
        result_text += final.get("text", "")

    if not result_text.strip():
        print_error("Transcription resulted in empty text")

    # ✅ Save to file
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(result_text.strip())

    print(f"[INFO]: Transcript saved to: {output_path}")
    print(result_text.strip())  # For Node.js capture

except Exception as e:
    print_error(f"Transcription failed: {e}")
    sys.exit(1)

finally:
    if temp_wav_path and os.path.exists(temp_wav_path):
        try:
            os.remove(temp_wav_path)
            print("[INFO]: Temporary WAV file deleted", file=sys.stderr)
        except Exception as cleanup_err:
            print(f"[Cleanup Warning]: {cleanup_err}", file=sys.stderr)
    if not os.path.exists(output_path):
        print_error(f"Output file not created: {output_path}")
        sys.exit(1)
    print("[INFO]: Transcription completed successfully", file=sys.stderr)
    sys.exit(0)
# ✅ End of script
# This script transcribes Hindi audio from MP3 to text using Vosk and saves the result