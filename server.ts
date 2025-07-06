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
const tempDir = path.join(rootPath, 'temp');

// Ensure directories exist
fs.mkdirSync(transcriptsDir, { recursive: true });
fs.mkdirSync(tempDir, { recursive: true });

// Serve static files
app.use(express.static(path.join(rootPath, 'public')));
app.use('/transcripts', express.static(transcriptsDir));

// Download audio from Railway API
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

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Missing or invalid YouTube URL' });
    return;
  }

  const sessionId = uuidv4();
  const tempMp3Path = path.join(tempDir, `temp_audio_${sessionId}.mp3`);
  const transcriptFileName = `transcript_${sessionId}.txt`;
  const transcriptPath = path.join(transcriptsDir, transcriptFileName);

  try {
    console.log(`🎧 Downloading MP3 from Railway API for URL: ${url}`);
    await downloadAudio(url, tempMp3Path);

    const stats = fs.statSync(tempMp3Path);
    console.log(`✅ Downloaded audio (${(stats.size / 1024).toFixed(2)} KB)`);

    const isWindows = process.platform === 'win32';
    const pythonExecutable = isWindows ? 'python' : 'python3';
    const pyPath = path.join(rootPath, 'transcriber', 'cli_transcribe.py');

   const child = spawn(pythonExecutable, [pyPath, tempMp3Path, transcriptPath]);

    child.stdout.on('data', data => {
      console.log(`🧠 [Python]: ${data.toString().trim()}`);
    });

    child.stderr.on('data', data => {
      console.error(`❌ [Python ERROR]: ${data.toString().trim()}`);
    });

    child.on('error', err => {
      console.error("❌ Failed to start subprocess:", err);
    });

    // Catch exit codes and signals robustly
    await new Promise<void>((resolve, reject) => {
      child.on('exit', (code, signal) => {
        if (code !== null) {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`cli_transcribe.py exited with code ${code}`));
          }
        } else if (signal !== null) {
          reject(new Error(`cli_transcribe.py was killed by signal ${signal}`));
        } else {
          reject(new Error(`cli_transcribe.py exited with unknown status`));
        }
      });
    });

    // New: listen to close event to catch stdio closure & signals
    child.on('close', (code, signal) => {
      if (signal) {
        console.error(`❌ cli_transcribe.py closed due to signal: ${signal}`);
      } else {
        console.log(`cli_transcribe.py closed with code: ${code}`);
      }
    });


    console.log(`✅ Transcription completed, saving to ${transcriptPath}`);


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
    if (fs.existsSync(transcriptPath)) fs.unlinkSync(transcriptPath);
  }
};

// Routes
app.post('/api/transcribe-from-youtube', handler);
app.get('/', (_, res) => {
  const indexPath = path.join(rootPath, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('<h1>YouTube Hindi Transcriber API</h1>');
  }
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Node.js server running on port ${PORT}`);
  console.log(`📁 Transcripts dir: ${transcriptsDir}`);
  console.log(`📁 Temp dir: ${tempDir}`);
});

export default handler;
