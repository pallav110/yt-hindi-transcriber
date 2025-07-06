import express, { Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import FormData from 'form-data';
import { finished } from 'stream/promises';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

const downloadAudio = async (url: string, outputPath: string): Promise<void> => {
  const response = await axios({
    method: 'POST',
    url: 'https://yt-mp3-server-production.up.railway.app/api/convert',
    data: { url },
    responseType: 'stream',
    headers: { 'Content-Type': 'application/json' },
  });

  const writer = fs.createWriteStream(outputPath);
  response.data.pipe(writer);
  await finished(writer); // wait until stream finishes
};

const handler = async (req: Request, res: Response): Promise<void> => {
  const { url } = req.body;

  if (!url) {
    res.status(400).json({ error: 'Missing YouTube URL' });
    return;
  }

  const tempMp3Path = `temp_audio_${uuidv4()}.mp3`;

  try {
    console.log(`🎧 Downloading MP3 from Railway API for URL: ${url}`);
    await downloadAudio(url, tempMp3Path);

    if (!fs.existsSync(tempMp3Path)) {
      throw new Error('MP3 file was not saved properly');
    }

    const stats = fs.statSync(tempMp3Path);
    console.log(`✅ Downloaded audio (${(stats.size / 1024).toFixed(2)} KB)`);

    // Prepare form for Flask server
    const form = new FormData();
    form.append('audio', fs.createReadStream(tempMp3Path), {
      contentType: 'audio/mpeg',
      filename: path.basename(tempMp3Path),
    });

    const transcriptResponse = await axios.post('http://127.0.0.1:5000/transcribe', form, {
      headers: form.getHeaders(),
    });


    const transcript: string = transcriptResponse.data.transcript;

    // Save transcript to .txt file
    const transcriptDir = path.join(__dirname, 'transcripts');
    const transcriptFileName = `transcript_${uuidv4()}.txt`;
    const transcriptPath = path.join(transcriptDir, transcriptFileName);

    // Ensure directory exists
    fs.mkdirSync(transcriptDir, { recursive: true });

    // Write transcript to file
    fs.writeFileSync(transcriptPath, transcript, 'utf-8');
    console.log(`📝 Transcript saved to: ${transcriptPath}`);

    res.json({
      transcript,
      file: transcriptFileName,
      path: `/transcripts/${transcriptFileName}`,
      size_kb: (stats.size / 1024).toFixed(2),
      method: 'Railway + Flask Vosk',
    });

  } catch (err: any) {
    console.error('❌ Error during transcription:', err.message);
    res.status(500).json({ error: 'Failed to transcribe audio', details: err.message });
  } finally {
    if (fs.existsSync(tempMp3Path)) {
      fs.unlinkSync(tempMp3Path); // cleanup temp file
    }
  }
};

// ✅ Route binding
app.post('/api/transcribe-from-youtube', handler);

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Node.js server running on port ${PORT}`));

export default handler;
