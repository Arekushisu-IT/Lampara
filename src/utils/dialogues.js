function toInteger(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildOptionDeltas(dialogue = {}) {
  const legacyPenalty = toInteger(dialogue.suspicion_penalty);
  const defaultWrongDelta = legacyPenalty ?? 10;
  const defaultCorrectDelta = legacyPenalty !== null ? -Math.abs(legacyPenalty) : -10;

  const optionACorrect = Boolean(dialogue.option_a_correct);
  const optionBCorrect = Boolean(dialogue.option_b_correct);
  const optionCCorrect = Boolean(dialogue.option_c_correct);

  const optionADelta = toInteger(dialogue.option_a_delta) ?? (optionACorrect ? defaultCorrectDelta : defaultWrongDelta);
  const optionBDelta = toInteger(dialogue.option_b_delta) ?? (optionBCorrect ? defaultCorrectDelta : defaultWrongDelta);
  const optionCDelta = toInteger(dialogue.option_c_delta) ?? (optionCCorrect ? defaultCorrectDelta : defaultWrongDelta);

  return {
    optionADelta,
    optionBDelta,
    optionCDelta,
    suspicionPenalty: legacyPenalty ?? defaultWrongDelta
  };
}

module.exports = { buildOptionDeltas };
