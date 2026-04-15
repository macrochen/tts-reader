'use strict';

const { ipcRenderer } = require('electron');
const { buildTextPlan } = require('./textPipeline');
const { alignSubtitleCuesToSentences, findActiveSubtitleIndex } = require('./subtitles');

const MAX_CHUNK_CHARS = 1200;
const PREFETCH_AHEAD = 2;

let voices = [];
let currentText = '';
let sentenceSegments = [];
let sentenceDomPositions = [];
let currentSentenceIndex = -1;
let selectedVoice = 'zh-CN-XiaoxiaoNeural';
let rate = 2;
let volume = 0;

let audio = null;
let syncInterval = null;
let isPlaying = false;
let isPaused = false;
let isBuffering = false;

let playSessionId = 0;
let playbackPlan = null;
let chunkResults = new Map();
let chunkPromises = new Map();
let currentChunkIndex = -1;

document.addEventListener('DOMContentLoaded', async () => {
  if (window.marked) {
    marked.setOptions({ breaks: true });
  }

  await loadVoices();

  let debounceTimer;
  document.getElementById('inputText').addEventListener('input', () => {
    if (isPlaying || isPaused || isBuffering) {
      stopPlay();
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(updatePreview, 300);
  });

  updatePreview();
});

async function loadVoices() {
  try {
    voices = await ipcRenderer.invoke('get-voices');
    const select = document.getElementById('voiceSelect');
    select.innerHTML = '';

    const lastUsedVoice = localStorage.getItem('tts-last-voice');
    let defaultIndex = 0;

    if (lastUsedVoice) {
      const lastIndex = voices.findIndex((voice) => voice.name === lastUsedVoice);
      if (lastIndex >= 0) {
        defaultIndex = lastIndex;
      }
    } else {
      const xiaoxiaoIndex = voices.findIndex((voice) => voice.name === 'zh-CN-XiaoxiaoNeural');
      if (xiaoxiaoIndex >= 0) {
        defaultIndex = xiaoxiaoIndex;
      }
    }

    const sortedVoices = [...voices];
    if (defaultIndex > 0) {
      const defaultVoice = sortedVoices.splice(defaultIndex, 1)[0];
      sortedVoices.unshift(defaultVoice);
    }

    sortedVoices.forEach((voice, index) => {
      const option = document.createElement('option');
      option.value = voice.name;
      option.textContent = `${voice.name} (${voice.gender})${index === 0 ? ' ← 推荐' : ''}`;
      select.appendChild(option);
    });

    if (sortedVoices.length > 0) {
      selectedVoice = sortedVoices[0].name;
      select.value = selectedVoice;
    }
  } catch (err) {
    console.error('加载语音失败:', err);
    document.getElementById('voiceSelect').innerHTML = '<option value="">加载语音失败</option>';
  }
}

function updatePreview() {
  const input = document.getElementById('inputText').value;
  currentText = input;

  const charCount = document.getElementById('charCount');
  charCount.textContent = `${input.length} 字`;

  const outputText = document.getElementById('outputText');
  sentenceDomPositions = [];
  currentSentenceIndex = -1;
  clearHighlights();

  if (!input.trim()) {
    sentenceSegments = [];
    outputText.innerHTML = `
      <p style="color: #999; text-align: center; margin-top: 50px;">
        在左侧输入文字后，点击「播放」开始朗读
      </p>
    `;
    return;
  }

  const previewPlan = buildTextPlan(input, { maxChars: MAX_CHUNK_CHARS });
  sentenceSegments = previewPlan.sentences;
  outputText.innerHTML = window.marked ? marked.parse(input) : escapeHtml(input).replace(/\n/g, '<br>');
  sentenceDomPositions = buildSentenceDomPositions(outputText, sentenceSegments);
}

function buildSentenceDomPositions(outputDiv, sentences) {
  const fullText = outputDiv.textContent || '';
  const positions = [];
  let cursor = 0;

  for (const sentence of sentences) {
    let start = fullText.indexOf(sentence.text, cursor);

    if (start === -1 && sentence.text.length > 20) {
      start = fullText.indexOf(sentence.text.slice(0, 20), cursor);
    }

    if (start === -1) {
      start = fullText.indexOf(sentence.text);
    }

    if (start === -1) {
      positions[sentence.index] = null;
      continue;
    }

    const end = Math.min(fullText.length, start + sentence.text.length);
    positions[sentence.index] = { start, end };
    cursor = end;
  }

  return positions;
}

function togglePlay() {
  if (!currentText.trim()) {
    alert('请先输入要朗读的文字');
    return;
  }

  if (isPlaying && !isPaused && audio) {
    audio.pause();
    isPaused = true;
    updateUI('paused');
    return;
  }

  if (isPaused && audio) {
    audio.play();
    isPaused = false;
    updateUI('playing');
    return;
  }

  if (!isBuffering) {
    startPlay();
  }
}

async function startPlay() {
  const sessionId = ++playSessionId;
  cleanupPlaybackObjects();

  const plan = buildTextPlan(currentText, { maxChars: MAX_CHUNK_CHARS });
  if (!plan.plainText.trim() || plan.chunks.length === 0) {
    alert('没有可朗读的文字');
    resetPlaybackState();
    return;
  }

  playbackPlan = plan;
  sentenceSegments = plan.sentences;
  chunkResults = new Map();
  chunkPromises = new Map();
  currentChunkIndex = -1;

  updatePreview();
  updateUI('loading');
  showLoading(true);
  updateStatusText(`正在生成第 1/${plan.chunks.length} 段...`);

  try {
    await ensureChunkReady(0, sessionId);
    if (!isCurrentSession(sessionId)) {
      return;
    }

    await playChunk(0, sessionId);
  } catch (err) {
    if (!isCurrentSession(sessionId)) {
      return;
    }

    console.error('生成语音失败:', err);
    showLoading(false);
    alert('生成语音失败: ' + err.message);
    stopPlay();
  }
}

function requestChunk(chunkIndex, sessionId) {
  if (!playbackPlan || chunkIndex < 0 || chunkIndex >= playbackPlan.chunks.length) {
    return Promise.resolve(null);
  }

  if (chunkResults.has(chunkIndex)) {
    return Promise.resolve(chunkResults.get(chunkIndex));
  }

  if (chunkPromises.has(chunkIndex)) {
    return chunkPromises.get(chunkIndex);
  }

  const chunk = playbackPlan.chunks[chunkIndex];
  const promiseMap = chunkPromises;
  const promise = ipcRenderer.invoke('generate-speech-chunk', {
    text: chunk.text,
    voice: selectedVoice,
    volume,
    chunkIndex
  }).then((result) => {
    if (!isCurrentSession(sessionId)) {
      return null;
    }

    const enriched = {
      ...result,
      chunk
    };
    chunkResults.set(chunkIndex, enriched);

    if (result.fromCache && chunkIndex === 0) {
      showToast('使用缓存音频', 'success');
    }

    return enriched;
  }).finally(() => {
    if (chunkPromises === promiseMap) {
      chunkPromises.delete(chunkIndex);
    }
  });

  chunkPromises.set(chunkIndex, promise);
  return promise;
}

async function ensureChunkReady(chunkIndex, sessionId) {
  const result = await requestChunk(chunkIndex, sessionId);
  if (!result && isCurrentSession(sessionId)) {
    throw new Error(`第 ${chunkIndex + 1} 段生成失败`);
  }
  return result;
}

function prefetchChunks(currentIndex, sessionId) {
  for (let offset = 1; offset <= PREFETCH_AHEAD; offset += 1) {
    requestChunk(currentIndex + offset, sessionId).catch((err) => {
      if (isCurrentSession(sessionId)) {
        console.error(`预生成第 ${currentIndex + offset + 1} 段失败:`, err);
      }
    });
  }
}

async function playChunk(chunkIndex, sessionId) {
  const result = chunkResults.get(chunkIndex);
  if (!result || !isCurrentSession(sessionId)) {
    return;
  }

  cleanupCurrentAudio();
  currentChunkIndex = chunkIndex;
  isBuffering = false;

  const audioElement = new Audio(result.audioUrl);
  audio = audioElement;
  audioElement.playbackRate = rate;

  audioElement.addEventListener('ended', () => {
    handleChunkEnded(sessionId).catch((err) => {
      if (isCurrentSession(sessionId)) {
        console.error('播放下一段失败:', err);
        alert('播放下一段失败: ' + err.message);
        stopPlay();
      }
    });
  }, { once: true });

  audioElement.addEventListener('error', () => {
    if (!isCurrentSession(sessionId)) {
      return;
    }

    alert('音频播放失败');
    stopPlay();
  }, { once: true });

  await waitForAudioReady(audioElement);
  if (!isCurrentSession(sessionId)) {
    return;
  }

  await audioElement.play();
  isPlaying = true;
  isPaused = false;
  showLoading(false);
  updateUI('playing');
  updateStatusText(`正在播放第 ${chunkIndex + 1}/${playbackPlan.chunks.length} 段`);
  startSyncForChunk(result);
  prefetchChunks(chunkIndex, sessionId);
}

async function handleChunkEnded(sessionId) {
  if (!playbackPlan || !isCurrentSession(sessionId)) {
    return;
  }

  stopSync();
  const nextIndex = currentChunkIndex + 1;

  if (nextIndex >= playbackPlan.chunks.length) {
    finishPlayback();
    return;
  }

  isBuffering = true;
  updateUI('buffering');
  showLoading(true);
  updateStatusText(`正在生成第 ${nextIndex + 1}/${playbackPlan.chunks.length} 段...`);

  await ensureChunkReady(nextIndex, sessionId);
  if (isCurrentSession(sessionId)) {
    await playChunk(nextIndex, sessionId);
  }
}

function startSyncForChunk(result) {
  stopSync();

  const { chunk, subtitles = [] } = result;
  const sentenceCount = chunk.sentenceEndIndex - chunk.sentenceStartIndex + 1;
  const cueSentenceIndexes = alignSubtitleCuesToSentences(subtitles, playbackPlan.sentences, chunk);
  let lastHighlightedIndex = -1;

  function tick() {
    if (!audio || !playbackPlan || !isPlaying || isPaused) {
      return;
    }

    const duration = Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : 0;
    const progress = duration > 0 ? Math.min(1, audio.currentTime / duration) : 0;
    const globalSentenceIndex = getGlobalSentenceIndexForTime(
      chunk,
      subtitles,
      cueSentenceIndexes,
      audio.currentTime,
      progress,
      sentenceCount
    );

    if (globalSentenceIndex !== lastHighlightedIndex) {
      lastHighlightedIndex = globalSentenceIndex;
      highlightCurrentSentence(globalSentenceIndex);
    }

    updateProgress(chunk.index, progress);
  }

  tick();
  syncInterval = setInterval(tick, 50);
}

function getGlobalSentenceIndexForTime(chunk, subtitles, cueSentenceIndexes, currentTime, progress, sentenceCount) {
  if (sentenceCount <= 1) {
    return chunk.sentenceStartIndex;
  }

  if (Array.isArray(subtitles) && subtitles.length > 0) {
    const cueIndex = findActiveSubtitleIndex(subtitles, currentTime);
    if (cueSentenceIndexes[cueIndex] !== undefined) {
      return cueSentenceIndexes[cueIndex];
    }
  }

  const localIndex = Math.min(sentenceCount - 1, Math.floor(progress * sentenceCount));
  return chunk.sentenceStartIndex + localIndex;
}

function updateProgress(chunkIndex, localProgress) {
  if (!playbackPlan) {
    return;
  }

  const totalChars = playbackPlan.chunks.reduce((sum, chunk) => sum + chunk.text.length, 0);
  const completedChars = playbackPlan.chunks
    .slice(0, chunkIndex)
    .reduce((sum, chunk) => sum + chunk.text.length, 0);
  const currentChars = playbackPlan.chunks[chunkIndex]
    ? playbackPlan.chunks[chunkIndex].text.length * localProgress
    : 0;
  const progress = totalChars > 0 ? (completedChars + currentChars) / totalChars : 0;
  document.getElementById('progressFill').style.width = `${Math.min(100, progress * 100)}%`;
}

function highlightCurrentSentence(sentenceIndex) {
  if (sentenceIndex < 0 || sentenceIndex >= sentenceSegments.length) {
    return;
  }

  if (sentenceIndex === currentSentenceIndex) {
    return;
  }

  clearHighlights();
  currentSentenceIndex = sentenceIndex;

  const outputDiv = document.getElementById('outputText');
  const overlay = document.getElementById('highlightOverlay');
  const panelContent = document.getElementById('panelContent');
  const position = sentenceDomPositions[sentenceIndex];

  if (!position) {
    overlay.style.display = 'none';
    return;
  }

  const range = createRangeFromTextOffsets(outputDiv, position.start, position.end);
  if (!range) {
    overlay.style.display = 'none';
    return;
  }

  const rect = range.getBoundingClientRect();
  const panelRect = panelContent.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0) {
    overlay.style.display = 'none';
    return;
  }

  overlay.style.display = 'block';
  overlay.style.left = `${rect.left - panelRect.left + panelContent.scrollLeft}px`;
  overlay.style.top = `${rect.top - panelRect.top + panelContent.scrollTop}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;

  const targetTop = rect.top - panelRect.top + panelContent.scrollTop - panelContent.clientHeight * 0.35;
  panelContent.scrollTo({
    top: Math.max(0, targetTop),
    behavior: 'smooth'
  });
}

function createRangeFromTextOffsets(root, startOffset, endOffset) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
  const range = document.createRange();
  let currentOffset = 0;
  let rangeSet = false;
  let node;

  while ((node = walker.nextNode())) {
    const nodeLength = node.textContent.length;
    const nodeStart = currentOffset;
    const nodeEnd = currentOffset + nodeLength;

    if (!rangeSet && nodeEnd > startOffset) {
      range.setStart(node, Math.max(0, startOffset - nodeStart));
      rangeSet = true;
    }

    if (rangeSet && nodeEnd >= endOffset) {
      range.setEnd(node, Math.max(0, endOffset - nodeStart));
      return range;
    }

    currentOffset = nodeEnd;
  }

  return null;
}

function clearHighlights() {
  const overlay = document.getElementById('highlightOverlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

function updateRate() {
  rate = parseFloat(document.getElementById('rateSlider').value);
  document.getElementById('rateValue').textContent = `${rate}x`;

  if (audio && isPlaying && !isPaused) {
    audio.playbackRate = rate;
  }
}

function updateVolume() {
  volume = parseInt(document.getElementById('volumeSlider').value, 10);
}

function changeVoice() {
  selectedVoice = document.getElementById('voiceSelect').value;
  localStorage.setItem('tts-last-voice', selectedVoice);

  if (isPlaying || isPaused || isBuffering) {
    stopPlay();
    setTimeout(() => startPlay(), 100);
  }
}

function clearInput() {
  stopPlay();
  document.getElementById('inputText').value = '';
  updatePreview();
}

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();

    if (text && text.trim()) {
      stopPlay();
      document.getElementById('inputText').value = text;
      updatePreview();
      showToast(`已粘贴 ${text.length} 字`);
    } else {
      showToast('剪贴板为空', 'warning');
    }
  } catch (err) {
    console.error('读取剪贴板失败:', err);
    document.getElementById('inputText').focus();
    alert('需要剪贴板读取权限，或使用 Ctrl+V 手动粘贴');
  }
}

function stopPlay() {
  playSessionId += 1;
  cleanupPlaybackObjects();
  resetPlaybackState();
}

function finishPlayback() {
  cleanupPlaybackObjects();
  resetPlaybackState();
}

function cleanupPlaybackObjects() {
  cleanupCurrentAudio();
  stopSync();
  showLoading(false);
}

function cleanupCurrentAudio() {
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    audio = null;
  }
}

function stopSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

function resetPlaybackState() {
  isPlaying = false;
  isPaused = false;
  isBuffering = false;
  currentChunkIndex = -1;
  currentSentenceIndex = -1;
  playbackPlan = null;
  chunkResults = new Map();
  chunkPromises = new Map();
  clearHighlights();
  updateUI('stopped');
}

function updateUI(state) {
  const playBtn = document.getElementById('playBtn');
  const playIcon = document.getElementById('playIcon');
  const playText = document.getElementById('playText');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  switch (state) {
    case 'loading':
    case 'buffering':
      playIcon.textContent = '⏳';
      playText.textContent = state === 'loading' ? '生成中' : '缓冲中';
      playBtn.disabled = true;
      statusDot.className = 'status-dot loading';
      statusText.textContent = state === 'loading' ? '正在生成语音...' : '正在缓冲下一段...';
      break;
    case 'playing':
      playIcon.textContent = '⏸';
      playText.textContent = '暂停';
      playBtn.disabled = false;
      statusDot.className = 'status-dot playing';
      statusText.textContent = '播放中...';
      break;
    case 'paused':
      playIcon.textContent = '▶';
      playText.textContent = '继续';
      playBtn.disabled = false;
      statusDot.className = 'status-dot paused';
      statusText.textContent = '已暂停';
      break;
    case 'stopped':
    default:
      playIcon.textContent = '▶';
      playText.textContent = '播放';
      playBtn.disabled = false;
      statusDot.className = 'status-dot';
      statusText.textContent = '就绪';
      document.getElementById('progressFill').style.width = '0%';
      break;
  }
}

function updateStatusText(text) {
  document.getElementById('statusText').textContent = text;
}

function showLoading(show) {
  const overlay = document.getElementById('loadingOverlay');
  if (show) {
    overlay.classList.add('show');
  } else {
    overlay.classList.remove('show');
  }
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 14px;
    z-index: 1000;
    animation: fadeInOut 2s ease-in-out;
    ${type === 'success' ? 'background: #27ae60; color: white;' : ''}
    ${type === 'warning' ? 'background: #f39c12; color: white;' : ''}
    ${type === 'error' ? 'background: #e74c3c; color: white;' : ''}
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeInOut {
      0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
      15% { opacity: 1; transform: translateX(-50%) translateY(0); }
      85% { opacity: 1; transform: translateX(-50%) translateY(0); }
      100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
    style.remove();
  }, 2000);
}

function waitForAudioReady(audioElement) {
  if (audioElement.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    audioElement.addEventListener('canplay', resolve, { once: true });
    audioElement.addEventListener('error', reject, { once: true });
  });
}

function isCurrentSession(sessionId) {
  return sessionId === playSessionId;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

document.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && event.target.tagName !== 'TEXTAREA') {
    event.preventDefault();
    togglePlay();
  }

  if (event.code === 'Escape') {
    stopPlay();
  }

  if (event.code === 'ArrowUp' && event.ctrlKey) {
    event.preventDefault();
    const slider = document.getElementById('rateSlider');
    slider.value = String(Math.min(3, parseFloat(slider.value) + 0.25));
    updateRate();
  }

  if (event.code === 'ArrowDown' && event.ctrlKey) {
    event.preventDefault();
    const slider = document.getElementById('rateSlider');
    slider.value = String(Math.max(0.5, parseFloat(slider.value) - 0.25));
    updateRate();
  }
});

window.addEventListener('beforeunload', () => {
  stopPlay();
});

Object.assign(window, {
  pasteFromClipboard,
  togglePlay,
  stopPlay,
  updateRate,
  updateVolume,
  changeVoice,
  clearInput
});
