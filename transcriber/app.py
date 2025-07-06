from flask import Flask, request, jsonify
import os, wave, json, tempfile, time
from vosk import Model, KaldiRecognizer
from pydub import AudioSegment
from datetime import datetime

app = Flask(__name__)

# FFmpeg auto-path
AudioSegment.converter = "ffmpeg"
AudioSegment.ffprobe = "ffprobe"

MODEL_PATH = "transcriber/vosk-model/vosk-model-hi-0.22"
assert os.path.exists(MODEL_PATH), f"Model not found at {MODEL_PATH}"
print(f"[{datetime.now()}] ✅ Vosk model loaded from {MODEL_PATH}")
model = Model(MODEL_PATH)

@app.route('/')
def index():
    return "✅ Vosk Hindi STT Flask server running"

@app.route('/transcribe', methods=['POST'])
def transcribe():
    print(f"\n[{datetime.now()}] 📥 Received /transcribe request")
    start_time = time.time()

    if 'audio' not in request.files:
        print("❌ No 'audio' file in request")
        return jsonify({"error": "Missing audio file"}), 400

    audio = request.files['audio']
    if not audio or audio.filename == '':
        print("❌ Empty file uploaded")
        return jsonify({"error": "Empty file"}), 400

    result_text = ""
    temp_mp3 = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
    temp_wav = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")

    try:
        print(f"[{datetime.now()}] 💾 Saving incoming MP3 to {temp_mp3.name}")
        audio.save(temp_mp3.name)

        print(f"[{datetime.now()}] 🔄 Converting MP3 to WAV at 16kHz")
        sound = AudioSegment.from_file(temp_mp3.name)
        sound = sound.set_channels(1).set_frame_rate(16000)
        sound.export(temp_wav.name, format="wav")

        # Explicitly close AudioSegment's internal stream
        del sound  # 🧽 this helps release the file earlier

        print(f"[{datetime.now()}] ✅ WAV saved at {temp_wav.name}")

        print(f"[{datetime.now()}] 🧠 Transcribing audio...")
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

        print(f"[{datetime.now()}] ✅ Transcription complete")


    except Exception as e:
        print(f"❌ Exception: {e}")
        return jsonify({"error": str(e)}), 500

    finally:
        # 🧹 Clean up
        for f in [temp_mp3.name, temp_wav.name]:
            try:
                os.remove(f)
                print(f"🗑️ Deleted temp file: {f}")
            except Exception as cleanup_err:
                print(f"⚠️ Cleanup failed for {f}: {cleanup_err}")

    duration = time.time() - start_time
    print(f"⏱️ Total time taken: {duration:.2f} seconds")

    return jsonify({
        "transcript": result_text.strip(),
        "duration_sec": round(duration, 2)
    })

@app.route('/test')
def test():
    return jsonify({
        "status": "ok",
        "message": "Flask server is running",
        "time": datetime.now().isoformat()
    })

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000)
