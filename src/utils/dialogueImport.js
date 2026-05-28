function normalizeNewlineText(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/\\n/g, '\n')
    .trim();
}

function buildChoiceFields(dialogue, includeChoices) {
  if (!includeChoices) {
    return {
      option_a_text: '',
      option_b_text: '',
      option_c_text: null,
      option_a_correct: 0,
      option_b_correct: 0,
      option_c_correct: 0,
      suspicion_penalty: 0,
      option_a_delta: 0,
      option_b_delta: 0,
      option_c_delta: 0,
      context_notes: ''
    };
  }

  return {
    option_a_text: dialogue.option_a_text || '',
    option_b_text: dialogue.option_b_text || '',
    option_c_text: dialogue.option_c_text || null,
    option_a_correct: dialogue.option_a_correct ?? 1,
    option_b_correct: dialogue.option_b_correct ?? 0,
    option_c_correct: dialogue.option_c_correct ?? 0,
    suspicion_penalty: dialogue.suspicion_penalty ?? 10,
    option_a_delta: dialogue.option_a_delta ?? -10,
    option_b_delta: dialogue.option_b_delta ?? 10,
    option_c_delta: dialogue.option_c_delta ?? 35,
    context_notes: dialogue.context_notes || ''
  };
}

function parseSpeakerBlocks(rawText, fallbackNpcName = 'NPC') {
  const text = normalizeNewlineText(rawText);
  const speakerPattern = /^([^:\n]+):\n([\s\S]*?)(?=\n\n[^:\n]+:\n|$)/gm;
  const speakerBlocks = [];
  let lastIndex = 0;
  let match;

  while ((match = speakerPattern.exec(text)) !== null) {
    const leadingText = text.slice(lastIndex, match.index).trim();
    const npcText = match[2].trim();

    speakerBlocks.push({
      npc_name: match[1].trim() || fallbackNpcName,
      npc_text: leadingText ? `${leadingText}\n\n${npcText}`.trim() : npcText
    });

    lastIndex = match.index + match[0].length;
  }

  const trailingText = text.slice(lastIndex).trim();
  if (trailingText && speakerBlocks.length > 0) {
    const lastBlock = speakerBlocks[speakerBlocks.length - 1];
    lastBlock.npc_text = `${lastBlock.npc_text}\n\n${trailingText}`.trim();
  }

  return speakerBlocks.filter(block => block.npc_text);
}

function normalizeImportedDialogue(dialogue) {
  const speakerBlocks = parseSpeakerBlocks(dialogue.npc_text, dialogue.npc_name);
  const blocks = speakerBlocks.length > 0
    ? speakerBlocks
    : [{
        npc_name: dialogue.npc_name || 'NPC',
        npc_text: normalizeNewlineText(dialogue.npc_text)
      }];

  return blocks.map((block, index) => {
    const isLastBlock = index === blocks.length - 1;

    return {
      quest_id: dialogue.quest_id,
      npc_name: block.npc_name || dialogue.npc_name || 'NPC',
      npc_text: block.npc_text,
      ...buildChoiceFields(dialogue, isLastBlock)
    };
  });
}

function normalizeImportedDialogues(dialogues) {
  const nextSequenceByQuest = new Map();
  const sortedDialogues = [...dialogues].sort((a, b) => (
    a.quest_id - b.quest_id ||
    a.sequence_order - b.sequence_order
  ));
  const normalized = [];

  for (const dialogue of sortedDialogues) {
    for (const row of normalizeImportedDialogue(dialogue)) {
      const nextSequence = (nextSequenceByQuest.get(row.quest_id) || 0) + 1;
      nextSequenceByQuest.set(row.quest_id, nextSequence);
      normalized.push({
        ...row,
        sequence_order: nextSequence
      });
    }
  }

  return normalized;
}

module.exports = {
  normalizeImportedDialogues
};
