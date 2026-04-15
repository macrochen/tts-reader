const assert = require('node:assert/strict');
const test = require('node:test');

const {
  cleanMarkdown,
  splitSentences,
  createChunks,
  buildTextPlan
} = require('../src/textPipeline');

test('cleanMarkdown removes common markdown syntax while keeping readable text', () => {
  const input = [
    '# 标题',
    '',
    '这是**粗体**和[链接](https://example.com)。',
    '> 引用内容。',
    '- 列表项',
    '',
    '```js',
    'console.log("hidden");',
    '```'
  ].join('\n');

  const result = cleanMarkdown(input);

  assert.equal(
    result,
    '标题\n\n这是粗体和链接。\n引用内容。\n列表项\n\n[代码块]'
  );
});

test('splitSentences keeps global text offsets and avoids decimal point splits', () => {
  const text = '第一句。版本 3.14 很重要！最后一句';

  const sentences = splitSentences(text);

  assert.deepEqual(
    sentences.map((sentence) => ({
      index: sentence.index,
      start: sentence.start,
      end: sentence.end,
      text: sentence.text
    })),
    [
      { index: 0, start: 0, end: 4, text: '第一句。' },
      { index: 1, start: 4, end: 16, text: '版本 3.14 很重要！' },
      { index: 2, start: 16, end: 20, text: '最后一句' }
    ]
  );
});

test('createChunks groups complete sentences and records global sentence ranges', () => {
  const sentences = splitSentences('一二三四五。六七八九十。十一十二十三。');

  const chunks = createChunks(sentences, { maxChars: 12 });

  assert.deepEqual(
    chunks.map((chunk) => ({
      index: chunk.index,
      sentenceStartIndex: chunk.sentenceStartIndex,
      sentenceEndIndex: chunk.sentenceEndIndex,
      text: chunk.text
    })),
    [
      {
        index: 0,
        sentenceStartIndex: 0,
        sentenceEndIndex: 1,
        text: '一二三四五。六七八九十。'
      },
      {
        index: 1,
        sentenceStartIndex: 2,
        sentenceEndIndex: 2,
        text: '十一十二十三。'
      }
    ]
  );
});

test('createChunks splits a single oversized sentence into readable chunks', () => {
  const sentences = splitSentences('没有标点但非常长的一整段文字');

  const chunks = createChunks(sentences, { maxChars: 8 });

  assert.deepEqual(
    chunks.map((chunk) => ({
      sentenceStartIndex: chunk.sentenceStartIndex,
      sentenceEndIndex: chunk.sentenceEndIndex,
      text: chunk.text
    })),
    [
      { sentenceStartIndex: 0, sentenceEndIndex: 0, text: '没有标点但非常长' },
      { sentenceStartIndex: 0, sentenceEndIndex: 0, text: '的一整段文字' }
    ]
  );
});

test('buildTextPlan returns cleaned text, sentences, and chunks together', () => {
  const plan = buildTextPlan('## 小标题\n\n第一句。第二句。第三句。', { maxChars: 10 });

  assert.equal(plan.plainText, '小标题\n\n第一句。第二句。第三句。');
  assert.equal(plan.sentences.length, 3);
  assert.equal(plan.chunks.length, 2);
  assert.equal(plan.chunks[0].sentenceStartIndex, 0);
  assert.equal(plan.chunks[1].sentenceStartIndex, 1);
});
