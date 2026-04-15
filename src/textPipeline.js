'use strict';

function cleanMarkdown(text) {
  return String(text || '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/```[\s\S]*?```/g, '[代码块]')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^>\s*/gm, '')
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isSentenceEnding(text, index) {
  const char = text[index];

  if ('。！？；;'.includes(char)) {
    return true;
  }

  if (!'.!?'.includes(char)) {
    return false;
  }

  const previous = text[index - 1] || '';
  const next = text[index + 1] || '';
  if (/\d/.test(previous) && /\d/.test(next)) {
    return false;
  }

  return !next || /\s/.test(next);
}

function splitSentences(text) {
  const source = String(text || '');
  const sentences = [];
  let sentenceStart = 0;

  for (let i = 0; i < source.length; i += 1) {
    if (!isSentenceEnding(source, i)) {
      continue;
    }

    const end = i + 1;
    const raw = source.slice(sentenceStart, end);
    const trimmed = raw.trim();

    if (trimmed) {
      const leadingWhitespace = raw.search(/\S/);
      const start = sentenceStart + (leadingWhitespace < 0 ? 0 : leadingWhitespace);
      sentences.push({
        index: sentences.length,
        start,
        end,
        text: trimmed
      });
    }

    sentenceStart = end;
  }

  if (sentenceStart < source.length) {
    const raw = source.slice(sentenceStart);
    const trimmed = raw.trim();

    if (trimmed) {
      const leadingWhitespace = raw.search(/\S/);
      const start = sentenceStart + (leadingWhitespace < 0 ? 0 : leadingWhitespace);
      sentences.push({
        index: sentences.length,
        start,
        end: source.length,
        text: trimmed
      });
    }
  }

  return sentences;
}

function createChunks(sentences, options = {}) {
  const maxChars = Math.max(1, options.maxChars || 1200);
  const chunks = [];
  let current = [];
  let currentLength = 0;

  function flush() {
    if (current.length === 0) {
      return;
    }

    const first = current[0];
    const last = current[current.length - 1];
    chunks.push({
      index: chunks.length,
      sentenceStartIndex: first.index,
      sentenceEndIndex: last.index,
      text: current.map((sentence) => sentence.text).join('')
    });
    current = [];
    currentLength = 0;
  }

  for (const sentence of sentences) {
    if (sentence.text.length > maxChars) {
      flush();

      for (let start = 0; start < sentence.text.length; start += maxChars) {
        chunks.push({
          index: chunks.length,
          sentenceStartIndex: sentence.index,
          sentenceEndIndex: sentence.index,
          text: sentence.text.slice(start, start + maxChars)
        });
      }

      continue;
    }

    const nextLength = currentLength + sentence.text.length;

    if (current.length > 0 && nextLength > maxChars) {
      flush();
    }

    current.push(sentence);
    currentLength += sentence.text.length;
  }

  flush();
  return chunks;
}

function buildTextPlan(markdownText, options = {}) {
  const plainText = cleanMarkdown(markdownText);
  const sentences = splitSentences(plainText);
  const chunks = createChunks(sentences, options);

  return {
    plainText,
    sentences,
    chunks
  };
}

module.exports = {
  cleanMarkdown,
  splitSentences,
  createChunks,
  buildTextPlan
};
