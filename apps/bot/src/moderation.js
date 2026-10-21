const CAPS_MIN_LETTERS = 15;
const CAPS_RATIO_THRESHOLD = 0.85;

function isExcessiveCaps(messageText) {
  const alpha = messageText.replace(/[^a-zA-Z]/g, '');
  if (alpha.length < CAPS_MIN_LETTERS) return false;
  const upper = messageText.replace(/[^A-Z]/g, '');
  return upper.length / alpha.length > CAPS_RATIO_THRESHOLD;
}

module.exports = { isExcessiveCaps };
