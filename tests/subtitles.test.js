const assert = require('node:assert/strict');
const test = require('node:test');

const {
  parseSubtitleContent,
  findActiveSubtitleIndex,
  alignSubtitleCuesToSentences
} = require('../src/subtitles');

test('parseSubtitleContent parses SRT timestamps with comma milliseconds', () => {
  const input = [
    '1',
    '00:00:00,100 --> 00:00:01,500',
    '第一句。',
    '',
    '2',
    '00:00:01,500 --> 00:00:03,250',
    '第二句。'
  ].join('\n');

  const cues = parseSubtitleContent(input);

  assert.deepEqual(cues, [
    { start: 0.1, end: 1.5, text: '第一句。' },
    { start: 1.5, end: 3.25, text: '第二句。' }
  ]);
});

test('parseSubtitleContent parses WEBVTT timestamps with dot milliseconds', () => {
  const input = [
    'WEBVTT',
    '',
    '00:00.000 --> 00:01.250',
    '开头。',
    '',
    '00:01.250 --> 00:02.000',
    '结尾。'
  ].join('\n');

  const cues = parseSubtitleContent(input);

  assert.deepEqual(cues, [
    { start: 0, end: 1.25, text: '开头。' },
    { start: 1.25, end: 2, text: '结尾。' }
  ]);
});

test('findActiveSubtitleIndex returns the cue active at a given playback time', () => {
  const cues = [
    { start: 0, end: 1.2, text: '一。' },
    { start: 1.2, end: 2.4, text: '二。' },
    { start: 2.4, end: 3, text: '三。' }
  ];

  assert.equal(findActiveSubtitleIndex(cues, 0), 0);
  assert.equal(findActiveSubtitleIndex(cues, 1.2), 1);
  assert.equal(findActiveSubtitleIndex(cues, 2.9), 2);
  assert.equal(findActiveSubtitleIndex(cues, 4), 2);
});

test('alignSubtitleCuesToSentences keeps multiple cues inside the same sentence', () => {
  const sentences = [
    { index: 10, text: '第一句很长，里面有逗号，也有停顿。' },
    { index: 11, text: '第二句。' },
    { index: 12, text: '第三句。' }
  ];
  const chunk = {
    sentenceStartIndex: 10,
    sentenceEndIndex: 12,
    text: '第一句很长，里面有逗号，也有停顿。第二句。第三句。'
  };
  const cues = [
    { start: 0, end: 1, text: '第一句很长，' },
    { start: 1, end: 2, text: '里面有逗号，' },
    { start: 2, end: 3, text: '也有停顿。' },
    { start: 3, end: 4, text: '第二句。' },
    { start: 4, end: 5, text: '第三句。' }
  ];

  const aligned = alignSubtitleCuesToSentences(cues, sentences, chunk);

  assert.deepEqual(aligned, [10, 10, 10, 11, 12]);
});
