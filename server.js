"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const cors_1 = __importDefault(require("cors"));
const uuid_1 = require("uuid");
const form_data_1 = __importDefault(require("form-data"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const handler = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { url } = req.body;
    if (!url) {
        res.status(400).json({ error: 'Missing YouTube URL' });
        return;
    }
    try {
        const tempMp3Path = `temp_audio_${(0, uuid_1.v4)()}.mp3`;
        // Step 1: Fetch MP3 blob from Railway API
        const audioResponse = yield (0, axios_1.default)({
            method: 'POST',
            url: 'https://yt-mp3-server-production.up.railway.app/api/convert',
            data: { url },
            responseType: 'stream',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        // Step 2: Save the MP3 file locally
        const writer = fs_1.default.createWriteStream(tempMp3Path);
        audioResponse.data.pipe(writer);
        writer.on('finish', () => __awaiter(void 0, void 0, void 0, function* () {
            // Step 3: Forward to local Flask STT API
            const form = new form_data_1.default();
            form.append('audio', fs_1.default.createReadStream(tempMp3Path));
            try {
                const transcriptResponse = yield axios_1.default.post('http://localhost:5000/transcribe', form, {
                    headers: form.getHeaders()
                });
                // Step 4: Send transcript to frontend
                res.json({
                    transcript: transcriptResponse.data.transcript,
                });
            }
            catch (err) {
                console.error('❌ Transcription error:', err);
                res.status(500).json({ error: 'Failed to transcribe audio' });
            }
            finally {
                fs_1.default.unlinkSync(tempMp3Path); // Clean up
            }
        }));
        writer.on('error', (err) => {
            console.error('❌ Error writing audio file:', err);
            res.status(500).json({ error: 'Failed to download audio' });
        });
    }
    catch (err) {
        console.error('❌ Failed to fetch audio:', err);
        res.status(500).json({ error: 'Failed to fetch audio from Railway API' });
    }
});
app.post('/api/transcribe-from-youtube', handler);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Node.js server running on port ${PORT}`));
app.post('/api/transcribe-from-youtube', handler);
// Export the handler for testing
exports.default = handler;
