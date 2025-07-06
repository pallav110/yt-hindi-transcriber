from flask import Flask, request, jsonify
import os, wave, json, tempfile
from vosk import Model, KaldiRecognizer
from pydub import AudioSegment

app = Flask(__name__)

# FFmpeg auto-path
AudioSegment.converter = "ffmpeg"
AudioSegment.ffprobe = "ffprobe"

MODEL_PATH = "vosk-model/vosk-model-hi-0.22"
assert os.path.exists(MODEL_PATH), f"Model not found at {MODEL_PATH}"
model = Model(MODEL_PATH)

@app.route('/')
def index():
    return "✅ Vosk Hindi STT Flask server running"

@app.route('/transcribe', methods=['POST'])
def transcribe():
    if 'audio' not in request.files:
        return jsonify({"error": "Missing audio file"}), 400

    audio = request.files['audio']
    if not audio or audio.filename == '':
        return jsonify({"error": "Empty file"}), 400

    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_in:
        audio.save(temp_in.name)
        sound = AudioSegment.from_file(temp_in.name)
        sound = sound.set_channels(1).set_frame_rate(16000)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_wav:
            sound.export(temp_wav.name, format="wav")
            wf = wave.open(temp_wav.name, "rb")
            rec = KaldiRecognizer(model, wf.getframerate())
            result_text = ""

            while True:
                data = wf.readframes(4000)
                if len(data) == 0:
                    break
                if rec.AcceptWaveform(data):
                    res = json.loads(rec.Result())
                    result_text += res.get("text", "") + " "

            final = json.loads(rec.FinalResult())
            result_text += final.get("text", "")

            wf.close()
            os.remove(temp_in.name)
            os.remove(temp_wav.name)

    return jsonify({"transcript": result_text.strip()})

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000)
