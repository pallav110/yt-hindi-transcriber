import { spawn } from 'child_process';
import express, { Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { finished } from 'stream/promises';
import path from 'path';
import { promisify } from 'util';

const app = express();

// Middleware with enhanced configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));

// Enhanced timeout configuration
app.use((req, res, next) => {
  req.setTimeout(300000); // 5 minutes
  res.setTimeout(300000);
  next();
});

const rootPath = path.resolve(__dirname, '..');
const transcriptsDir = path.join(rootPath, 'transcripts');
const tempDir = path.join(rootPath, 'temp');

// Ensure directories exist
const ensureDirectories = () => {
  try {
    fs.mkdirSync(transcriptsDir, { recursive: true });
    fs.mkdirSync(tempDir, { recursive: true });
    console.log('📁 Directories created/verified');
  } catch (error) {
    console.error('❌ Failed to create directories:', error);
  }
};

// Initialize directories
ensureDirectories();

app.use(express.static(path.join(rootPath, 'public')));
app.use('/transcripts', express.static(transcriptsDir));

// Enhanced URL validation
const isValidYouTubeUrl = (url: string): boolean => {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]+(&[\w=]*)?$/;
  return youtubeRegex.test(url);
};

// Enhanced audio download with retry logic
const downloadAudio = async (url: string, outputPath: string): Promise<void> => {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🎧 Downloading audio (attempt ${attempt}/${maxRetries})`);
      
      const response = await axios({
        method: 'POST',
        url: 'https://yt-mp3-server-production.up.railway.app/api/convert',
        data: { url },
        responseType: 'stream',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; TranscriptionBot/1.0)'
        },
        timeout: 120000, // 2 minutes timeout
        maxContentLength: 100 * 1024 * 1024, // 100MB max
      });

      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);
      await finished(writer);
      
      // Verify file was created and has content
      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        throw new Error('Downloaded file is empty');
      }
      
      console.log(`✅ Audio downloaded successfully (${(stats.size / 1024).toFixed(2)} KB)`);
      return;
      
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Download attempt ${attempt} failed:`, error.message);
      
      // Clean up failed download
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`⏱️ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`Failed to download audio after ${maxRetries} attempts: ${lastError?.message}`);
};

// Enhanced transcription with better error handling
const transcribeAudio = async (audioPath: string, transcriptPath: string): Promise<void> => {
  const isWindows = process.platform === 'win32';
  const pythonExecutable = isWindows ? 'python' : 'python3';
  const pyPath = path.join(rootPath, 'transcriber', 'cli_transcribe.py');

  // Verify Python script exists
  if (!fs.existsSync(pyPath)) {
    throw new Error(`Python transcription script not found at: ${pyPath}`);
  }

  // Verify audio file exists and has content
  if (!fs.existsSync(audioPath)) {
    throw new Error('Audio file not found');
  }

  const audioStats = fs.statSync(audioPath);
  if (audioStats.size === 0) {
    throw new Error('Audio file is empty');
  }

  console.log(`🧠 Starting transcription of ${(audioStats.size / 1024).toFixed(2)} KB audio file`);

  const child = spawn(pythonExecutable, [pyPath, audioPath, transcriptPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 300000, // 5 minutes timeout
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (data) => {
    const output = data.toString().trim();
    stdout += output + '\n';
    console.log(`🧠 [Python]: ${output}`);
  });

  child.stderr.on('data', (data) => {
    const output = data.toString().trim();
    stderr += output + '\n';
    console.error(`❌ [Python ERROR]: ${output}`);
  });

  child.on('error', (err) => {
    console.error("❌ Failed to start subprocess:", err);
    throw new Error(`Failed to start Python process: ${err.message}`);
  });

  await new Promise<void>((resolve, reject) => {
    child.on('close', (code, signal) => {
      if (signal) {
        reject(new Error(`Python process was killed with signal ${signal}`));
      } else if (code === 0) {
        console.log('✅ Transcription completed successfully');
        resolve();
      } else {
        reject(new Error(`Python process exited with code ${code}. Error: ${stderr}`));
      }
    });
  });

  // Verify transcript was created
  if (!fs.existsSync(transcriptPath)) {
    throw new Error('Transcript file was not created');
  }

  const transcriptStats = fs.statSync(transcriptPath);
  if (transcriptStats.size === 0) {
    throw new Error('Transcript file is empty');
  }
};

// Enhanced cleanup function
const cleanupFiles = (...filePaths: string[]) => {
  filePaths.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`🧹 Cleaned up: ${path.basename(filePath)}`);
      } catch (error) {
        console.error(`❌ Failed to cleanup ${filePath}:`, error);
      }
    }
  });
};

// Enhanced main handler
const handler = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  const { url } = req.body;

  // Input validation
  if (!url || typeof url !== 'string') {
    res.status(400).json({ 
      error: 'Missing or invalid YouTube URL',
      details: 'Please provide a valid YouTube URL in the request body'
    });
    return;
  }

  if (!isValidYouTubeUrl(url)) {
    res.status(400).json({ 
      error: 'Invalid YouTube URL format',
      details: 'Please provide a valid YouTube URL (youtube.com or youtu.be)'
    });
    return;
  }

  // Generate unique file paths
  const sessionId = uuidv4();
  const tempMp3Path = path.join(tempDir, `temp_audio_${sessionId}.mp3`);
  const transcriptFileName = `transcript_${sessionId}.txt`;
  const transcriptPath = path.join(transcriptsDir, transcriptFileName);

  console.log(`🚀 Starting transcription for session: ${sessionId}`);
  console.log(`📹 URL: ${url}`);

  try {
    // Download audio
    await downloadAudio(url, tempMp3Path);
    const audioStats = fs.statSync(tempMp3Path);
    
    // Check file size limits (adjust as needed)
    const maxSizeMB = 50;
    if (audioStats.size > maxSizeMB * 1024 * 1024) {
      throw new Error(`Audio file too large: ${(audioStats.size / 1024 / 1024).toFixed(2)}MB (max: ${maxSizeMB}MB)`);
    }

    // Transcribe audio
    await transcribeAudio(tempMp3Path, transcriptPath);

    // Read and validate transcript
    const transcript = fs.readFileSync(transcriptPath, 'utf-8');
    if (!transcript.trim()) {
      throw new Error('Transcription resulted in empty content');
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ Transcription completed in ${processingTime}ms`);

    // Send response
    res.json({
      success: true,
      transcript: transcript.trim(),
      file: transcriptFileName,
      path: `/transcripts/${transcriptFileName}`,
      size_kb: (audioStats.size / 1024).toFixed(2),
      method: 'Railway + CLI Vosk',
      processing_time_ms: processingTime,
      session_id: sessionId
    });

  } catch (err: any) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ Transcription failed for session ${sessionId}:`, err.message);
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to transcribe audio', 
      details: err.message,
      processing_time_ms: processingTime,
      session_id: sessionId
    });
  } finally {
    // Always cleanup temporary files
    setTimeout(() => {
      cleanupFiles(tempMp3Path, transcriptPath);
    }, 5000); // Delay cleanup to allow response to complete
  }
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    platform: process.platform,
    node_version: process.version
  });
});

// API endpoint
app.post('/api/transcribe-from-youtube', handler);

// Root endpoint
app.get('/', (_, res) => {
  const indexPath = path.join(rootPath, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ 
      message: 'YouTube Transcription API',
      endpoints: {
        transcribe: 'POST /api/transcribe-from-youtube',
        health: 'GET /health'
      }
    });
  }
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Start server
const PORT = process.env.PORT || 8080;
setTimeout(() => {
  console.log('\n🧭 ROUTES REGISTERED:');
  app._router.stack
    .filter((layer: any) => layer.route)
    .forEach((layer: any) => {
      console.log('📍', layer.route.path);
    });
}, 1000);

app.listen(PORT, () => {
  console.log(`✅ Node.js server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📁 Root path: ${rootPath}`);
  console.log(`📁 Transcripts dir: ${transcriptsDir}`);
  console.log(`📁 Temp dir: ${tempDir}`);
});

export default handler;