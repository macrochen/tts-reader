'use strict';

function parseTimecode(timecode) {
  const normalized = String(timecode || '').trim().replace(',', '.');
  const parts = normalized.split(':');

  if (parts.length === 3) {
    return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
  }

  if (parts.length === 2) {
    return Number(parts[0]) * 60 + Number(parts[1]);
  }

  return Number(normalized) || 0;
}

function parseSubtitleContent(content) {
  const lines = String(content || '').replace(/\r/g, '').split('\n');
  const cues = [];
  let current = null;

  function flush() {
    if (!current) {
      return;
    }

    const text = current.lines
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (text) {
      cues.push({
        start: current.start,
        end: current.end,
        text
      });
    }

    current = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line === 'WEBVTT') {
      flush();
      continue;
    }

    if (/^\d+$/.test(line) && !current) {
      continue;
    }

    if (line.includes('-->')) {
      flush();
      const [startRaw, endRaw] = line.split('-->');
      current = {
        start: parseTimecode(startRaw),
        end: parseTimecode(endRaw.trim().split(/\s+/)[0]),
        lines: []
      };
      continue;
    }

    if (current) {
      current.lines.push(line);
    }
  }

  flush();
  return cues;
}

function findActiveSubtitleIndex(cues, currentTime) {
  if (!Array.isArray(cues) || cues.length === 0) {
    return -1;
  }

  if (currentTime < cues[0].start) {
    return 0;
  }

  for (let i = 0; i < cues.length; i += 1) {
    const cue = cues[i];
    if (currentTime >= cue.start && currentTime < cue.end) {
      return i;
    }

    const nextCue = cues[i + 1];
    if (nextCue && currentTime >= cue.end && currentTime < nextCue.start) {
      return i;
    }
  }

  return cues.length - 1;
}

function alignSubtitleCuesToSentences(cues, sentences, chunk) {
  if (!Array.isArray(cues) || cues.length === 0 || !Array.isArray(sentences) || !chunk) {
    return [];
  }

  const chunkSentences = sentences.filter((sentence) => (
    sentence.index >= chunk.sentenceStartIndex &&
    sentence.index <= chunk.sentenceEndIndex
  ));

  if (chunkSentences.length === 0) {
    return cues.map(() => chunk.sentenceStartIndex);
  }

  const textRanges = [];
  let offset = 0;
  for (const sentence of chunkSentences) {
    const start = offset;
    offset += sentence.text.length;
    textRanges.push({
      start,
      end: offset,
      sentenceIndex: sentence.index
    });
  }

  const chunkText = chunk.text || chunkSentences.map((sentence) => sentence.text).join('');
  let searchCursor = 0;
  let lastSentenceIndex = chunkSentences[0].index;

  return cues.map((cue) => {
    const cueText = String(cue.text || '').trim();
    let cueStart = cueText ? chunkText.indexOf(cueText, searchCursor) : -1;

    if (cueStart === -1 && cueText.length > 10) {
      cueStart = chunkText.indexOf(cueText.slice(0, 10), searchCursor);
    }

    if (cueStart === -1) {
      return lastSentenceIndex;
    }

    const range = textRanges.find((item) => cueStart >= item.start && cueStart < item.end);
    if (range) {
      lastSentenceIndex = range.sentenceIndex;
    }

    searchCursor = Math.max(searchCursor, cueStart + Math.max(1, cueText.length));
    return lastSentenceIndex;
  });
}

function getChunkSentences(sentences, chunk) {
  if (!Array.isArray(sentences) || !chunk) {
    return [];
  }

  return sentences.filter((sentence) => (
    sentence.index >= chunk.sentenceStartIndex &&
    sentence.index <= chunk.sentenceEndIndex
  ));
}

function getSentenceTextRanges(chunkSentences) {
  const ranges = [];
  let offset = 0;

  for (const sentence of chunkSentences) {
    const start = offset;
    offset += sentence.text.length;
    ranges.push({
      start,
      end: offset,
      sentence
    });
  }

  return ranges;
}

function findRangeForOffset(ranges, offset) {
  return ranges.find((range) => offset >= range.start && offset < range.end) || null;
}

function buildSentenceCuesFromWordBoundaries(wordBoundaries, sentences, chunk) {
  if (!Array.isArray(wordBoundaries) || wordBoundaries.length === 0) {
    return [];
  }

  const chunkSentences = getChunkSentences(sentences, chunk);
  if (chunkSentences.length === 0) {
    return [];
  }

  const ranges = getSentenceTextRanges(chunkSentences);
  const chunkText = chunk.text || chunkSentences.map((sentence) => sentence.text).join('');
  const cueBySentence = new Map();
  let searchCursor = 0;

  for (const word of wordBoundaries) {
    const wordText = String(word.text || '').trim();
    if (!wordText) {
      continue;
    }

    let wordOffset = chunkText.indexOf(wordText, searchCursor);
    if (wordOffset === -1) {
      wordOffset = chunkText.indexOf(wordText);
    }

    if (wordOffset === -1) {
      continue;
    }

    const range = findRangeForOffset(ranges, wordOffset);
    if (!range) {
      continue;
    }

    const existing = cueBySentence.get(range.sentence.index);
    if (existing) {
      existing.end = Math.max(existing.end, word.end);
    } else {
      cueBySentence.set(range.sentence.index, {
        sentenceIndex: range.sentence.index,
        start: word.start,
        end: word.end,
        text: range.sentence.text
      });
    }

    searchCursor = Math.max(searchCursor, wordOffset + wordText.length);
  }

  return chunkSentences
    .map((sentence) => cueBySentence.get(sentence.index))
    .filter(Boolean);
}

module.exports = {
  parseTimecode,
  parseSubtitleContent,
  findActiveSubtitleIndex,
  alignSubtitleCuesToSentences,
  buildSentenceCuesFromWordBoundaries
};
