'use strict';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getStableScrollTop({
  currentScrollTop,
  viewportHeight,
  contentHeight,
  targetTop,
  targetHeight,
  upperBand = 0.18,
  lowerBand = 0.72,
  anchorBand = 0.35
}) {
  const maxScrollTop = Math.max(0, contentHeight - viewportHeight);
  if (currentScrollTop > maxScrollTop) {
    return maxScrollTop;
  }

  const relativeTop = targetTop - currentScrollTop;
  const relativeBottom = relativeTop + targetHeight;
  const comfortTop = viewportHeight * upperBand;
  const comfortBottom = viewportHeight * lowerBand;

  if (relativeTop >= comfortTop && relativeBottom <= comfortBottom) {
    return null;
  }

  const desired = targetTop - viewportHeight * anchorBand;
  return Math.round(clamp(desired, 0, maxScrollTop));
}

module.exports = {
  getStableScrollTop
};
