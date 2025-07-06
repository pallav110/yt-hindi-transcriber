import os
import sys
import wave
import json
import uuid
import logging
import tempfile
from vosk import Model, KaldiRecognizer
from pydub import AudioSegment

# ✅ Silence unnecessary Vosk logs
logging.getLogger().setLevel(logging.ERROR)

# ✅ Ensure proper Unicode output for Hindi text (safe across platforms)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding='utf-8')

# ✅ Check for MP3 path input
if len(sys.argv) < 2:
    print("[CLI ERROR]: Missing input MP3 file path", file=sys.stderr)
    sys.exit(1)

mp3_path = sys.argv[1]

if not os.path.exists(mp3_path):
    print(f"[CLI ERROR]: File not found: {mp3_path}", file=sys.stderr)
    sys.exit(1)

# ✅ Load Hindi Vosk model
model = Model("transcriber/vosk-model/vosk-model-hi-0.22")

# ✅ Safe temporary file handling using auto-cleanup
result_text = ""
try:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_wav:
        # 🔄 Convert MP3 to mono WAV (16kHz)
        sound = AudioSegment.from_file(mp3_path)
        sound = sound.set_channels(1).set_frame_rate(16000)
        sound.export(temp_wav.name, format="wav")

        # ✅ Safe file I/O with context manager
        with wave.open(temp_wav.name, "rb") as wf:
            rec = KaldiRecognizer(model, wf.getframerate())

            while True:
                data = wf.readframes(4000)
                if len(data) == 0:
                    break
                if rec.AcceptWaveform(data):
                    res = json.loads(rec.Result())
                    result_text += res.get("text", "") + " "

            final = json.loads(rec.FinalResult())
            result_text += final.get("text", "")

    print(result_text.strip())

except Exception as e:
    print(f"[CLI ERROR]: {e}", file=sys.stderr)
    sys.exit(1)

finally:
    # ✅ Safe cleanup with fallback
    try:
        os.remove(temp_wav.name)
    except Exception as cleanup_err:
        print(f"[Cleanup Warning]: {cleanup_err}", file=sys.stderr)

sys.exit(0)
