const assert = require('node:assert/strict');
const test = require('node:test');

const { getStableScrollTop } = require('../src/scrollSync');

test('getStableScrollTop does not scroll when target is inside comfort band', () => {
  const next = getStableScrollTop({
    currentScrollTop: 100,
    viewportHeight: 500,
    contentHeight: 2000,
    targetTop: 260,
    targetHeight: 32
  });

  assert.equal(next, null);
});

test('getStableScrollTop scrolls down when target is below comfort band', () => {
  const next = getStableScrollTop({
    currentScrollTop: 100,
    viewportHeight: 500,
    contentHeight: 2000,
    targetTop: 520,
    targetHeight: 32
  });

  assert.equal(next, 345);
});

test('getStableScrollTop scrolls up when target is above comfort band', () => {
  const next = getStableScrollTop({
    currentScrollTop: 500,
    viewportHeight: 500,
    contentHeight: 2000,
    targetTop: 540,
    targetHeight: 32
  });

  assert.equal(next, 365);
});

test('getStableScrollTop clamps to scrollable bounds', () => {
  const next = getStableScrollTop({
    currentScrollTop: 1200,
    viewportHeight: 500,
    contentHeight: 1500,
    targetTop: 1480,
    targetHeight: 32
  });

  assert.equal(next, 1000);
});
