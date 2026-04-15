const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec, execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { parseSubtitleContent } = require('./src/subtitles');

let mainWindow;

// 临时目录存储生成的音频
const tempDir = path.join(os.tmpdir(), 'tts-reader-cache');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// 音频缓存（内存缓存）
const audioCache = new Map();
const MAX_CACHE_SIZE = 50;  // 最多缓存 50 个音频

// 生成缓存键（不包含语速，语速由 playbackRate 调整）
function getCacheKey(text, voice, volume) {
  const content = `${text}|${voice}|${volume}`;
  return crypto.createHash('md5').update(content).digest('hex');
}

function createTempSpeechFiles(prefix = 'audio') {
  const id = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  return {
    audioFile: path.join(tempDir, `${prefix}_${id}.mp3`),
    subtitleFile: path.join(tempDir, `${prefix}_${id}.srt`)
  };
}

function rememberAudioCache(cacheKey, audioFile, subtitleFile, subtitles) {
  if (audioCache.size >= MAX_CACHE_SIZE) {
    const firstKey = audioCache.keys().next().value;
    const oldCached = audioCache.get(firstKey);
    if (oldCached) {
      try {
        if (fs.existsSync(oldCached.audioFile)) fs.unlinkSync(oldCached.audioFile);
        if (fs.existsSync(oldCached.subtitleFile)) fs.unlinkSync(oldCached.subtitleFile);
      } catch (e) {}
    }
    audioCache.delete(firstKey);
  }

  audioCache.set(cacheKey, {
    audioFile,
    subtitleFile,
    subtitles
  });
}

function readSubtitles(subtitleFile) {
  if (!fs.existsSync(subtitleFile)) {
    return [];
  }

  const subtitleContent = fs.readFileSync(subtitleFile, 'utf-8');
  return parseSubtitleContent(subtitleContent);
}

function generateSpeechWithExecFile({ text, voice, volume, prefix = 'audio' }) {
  const cacheKey = getCacheKey(text, voice, volume);

  if (audioCache.has(cacheKey)) {
    const cached = audioCache.get(cacheKey);
    if (fs.existsSync(cached.audioFile) && fs.existsSync(cached.subtitleFile)) {
      console.log('🎯 使用缓存音频:', cacheKey);
      return Promise.resolve({
        audioUrl: `file://${cached.audioFile}`,
        subtitles: cached.subtitles,
        audioFile: cached.audioFile,
        subtitleFile: cached.subtitleFile,
        fromCache: true
      });
    }

    audioCache.delete(cacheKey);
  }

  const { audioFile, subtitleFile } = createTempSpeechFiles(prefix);
  const volumeStr = volume >= 0 ? `+${volume}%` : `${volume}%`;
  const args = [
    '--voice', voice,
    '--rate=+0%',
    `--volume=${volumeStr}`,
    '--write-media', audioFile,
    '--write-subtitles', subtitleFile,
    '--text', text
  ];

  console.log('🎤 生成语音 chunk:', `${text.length} chars`, cacheKey);

  return new Promise((resolve, reject) => {
    execFile('edge-tts', args, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) {
        console.error('edge-tts 错误:', stderr);
        reject(new Error('语音生成失败: ' + stderr));
        return;
      }

      const subtitles = readSubtitles(subtitleFile);
      rememberAudioCache(cacheKey, audioFile, subtitleFile, subtitles);

      console.log('✅ 语音 chunk 生成完成:', cacheKey);
      resolve({
        audioUrl: `file://${audioFile}`,
        subtitles,
        audioFile,
        subtitleFile,
        fromCache: false
      });
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: '朗读器 - Edge TTS',
    backgroundColor: '#f5f5f5'
  });

  mainWindow.loadFile('index.html');
  
  // 开发时打开开发者工具
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  cleanupTempFiles();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 清理临时文件
function cleanupTempFiles() {
  try {
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tempDir, file));
      }
    }
  } catch (err) {
    console.error('清理临时文件失败:', err);
  }
}

// 获取可用语音列表
ipcMain.handle('get-voices', async () => {
  return new Promise((resolve, reject) => {
    exec('edge-tts --list-voices', (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      
      const voices = stdout.split('\n')
        .filter(line => line.startsWith('zh-'))
        .map(line => {
          const parts = line.split(/\s+/);
          return {
            name: parts[0],
            gender: parts[2],
            locale: parts[1]
          };
        });
      
      resolve(voices);
    });
  });
});

// 生成语音（带缓存，基础语速 1x，播放时用 playbackRate 调整）
ipcMain.handle('generate-speech', async (event, { text, voice, rate, volume }) => {
  // 检查缓存（不包含语速）
  const cacheKey = getCacheKey(text, voice, volume);
  
  if (audioCache.has(cacheKey)) {
    const cached = audioCache.get(cacheKey);
    // 检查文件是否还存在
    if (fs.existsSync(cached.audioFile) && fs.existsSync(cached.subtitleFile)) {
      console.log('🎯 使用缓存音频:', cacheKey);
      return {
        audioUrl: `file://${cached.audioFile}`,
        subtitles: cached.subtitles,
        audioFile: cached.audioFile,
        subtitleFile: cached.subtitleFile,
        fromCache: true
      };
    } else {
      // 文件不存在，从缓存中删除
      audioCache.delete(cacheKey);
    }
  }
  
  // 生成新音频（使用 1x 语速作为基础）
  const audioFile = path.join(tempDir, `audio_${Date.now()}.mp3`);
  const subtitleFile = path.join(tempDir, `subtitle_${Date.now()}.vtt`);
  
  return new Promise((resolve, reject) => {
    const volumeStr = volume >= 0 ? `+${volume}%` : `${volume}%`;
    
    // 转义文本中的引号
    const escapedText = text.replace(/"/g, '\\"').replace(/`/g, '\\`');
    
    // 使用 1x 语速生成基础音频（语速由前端 playbackRate 调整）
    const command = `edge-tts --voice "${voice}" --rate="+0%" --volume="${volumeStr}" --write-media "${audioFile}" --write-subtitles "${subtitleFile}" --text "${escapedText}"`;
    
    console.log('🎤 生成语音（基础 1x）:', command.substring(0, 100) + '...');
    
    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) {
        console.error('edge-tts 错误:', stderr);
        reject(new Error('语音生成失败: ' + stderr));
        return;
      }
      
      const subtitles = readSubtitles(subtitleFile);
      
      const result = {
        audioUrl: `file://${audioFile}`,
        subtitles: subtitles,
        audioFile: audioFile,
        subtitleFile: subtitleFile,
        fromCache: false
      };
      
      rememberAudioCache(cacheKey, audioFile, subtitleFile, subtitles);
      
      console.log('✅ 语音生成完成，已缓存:', cacheKey);
      resolve(result);
    });
  });
});

// 生成单个文本分片的语音，供长文准流式播放使用
ipcMain.handle('generate-speech-chunk', async (event, { text, voice, volume, chunkIndex }) => {
  if (!text || !text.trim()) {
    throw new Error('没有可朗读的文字');
  }

  const result = await generateSpeechWithExecFile({
    text,
    voice,
    volume,
    prefix: `chunk_${chunkIndex ?? 0}`
  });

  return {
    ...result,
    chunkIndex
  };
});

// 解析 VTT 字幕文件
function parseVTT(vttContent) {
  return parseSubtitleContent(vttContent);
}

function parseVTTTime(timeStr) {
  const parts = timeStr.split(':');
  let seconds = 0;
  
  if (parts.length === 3) {
    seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
  } else if (parts.length === 2) {
    seconds = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  }
  
  return seconds;
}

// 清理特定文件
ipcMain.handle('cleanup-file', async (event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  } catch (err) {
    console.error('清理文件失败:', err);
    return false;
  }
});
