import { spawn } from 'child_process';
import express, { Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { finished } from 'stream/promises';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

const rootPath = path.resolve(__dirname, '..');
const transcriptsDir = path.join(rootPath, 'transcripts');

app.use(express.static(path.join(rootPath, 'public')));
app.use('/transcripts', express.static(transcriptsDir));

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
  await finished(writer);
};

const handler = async (req: Request, res: Response): Promise<void> => {
  const { url } = req.body;

  if (!url) {
    res.status(400).json({ error: 'Missing YouTube URL' });
    return;
  }

  const tempMp3Path = `temp_audio_${uuidv4()}.mp3`;
  const transcriptFileName = `transcript_${uuidv4()}.txt`;
  const transcriptPath = path.join(transcriptsDir, transcriptFileName);

  try {
    console.log(`🎧 Downloading MP3 from Railway API for URL: ${url}`);
    await downloadAudio(url, tempMp3Path);

    const stats = fs.statSync(tempMp3Path);
    console.log(`✅ Downloaded audio (${(stats.size / 1024).toFixed(2)} KB)`);

    const isProduction = process.env.NODE_ENV === 'production';
    const isWindows = process.platform === 'win32';
    const pythonExecutable = isWindows ? 'python' : 'python3';

    // Path to cli_transcribe.py
    const pyPath = path.join(rootPath, 'transcriber', 'cli_transcribe.py');

    // Ensure transcripts directory exists
    fs.mkdirSync(transcriptsDir, { recursive: true });

    const child = spawn(pythonExecutable, [pyPath, tempMp3Path, transcriptPath]);

    child.stdout.on('data', (data) => console.log(`🧠 [Python]: ${data.toString()}`));
    child.stderr.on('data', (data) => console.error(`❌ [Python ERROR]: ${data.toString()}`));

    await new Promise<void>((resolve, reject) => {
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`cli_transcribe.py exited with code ${code}`));
      });
    });

    const transcript = fs.readFileSync(transcriptPath, 'utf-8');

    res.json({
      transcript,
      file: transcriptFileName,
      path: `/transcripts/${transcriptFileName}`,
      size_kb: (stats.size / 1024).toFixed(2),
      method: 'Railway + CLI Vosk',
    });

  } catch (err: any) {
    console.error('❌ Error during transcription:', err.message);
    res.status(500).json({ error: 'Failed to transcribe audio', details: err.message });
  } finally {
    if (fs.existsSync(tempMp3Path)) fs.unlinkSync(tempMp3Path);
  }
};

app.post('/api/transcribe-from-youtube', handler);
app.get('/', (_, res) => res.sendFile(path.join(rootPath, 'public', 'index.html')));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`✅ Node.js server running on port ${PORT}`));

export default handler;
