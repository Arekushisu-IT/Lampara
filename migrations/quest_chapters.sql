-- ============================================================
-- LAMPARA Quest Chapters Migration (Phase 1, Step 1B)
--
-- Prefer the runner. It writes a restore file first, runs safety
-- pre-checks, and skips whatever is already done:
--   node migrations/run-quest-chapters.js            # dry run
--   node migrations/run-quest-chapters.js --apply    # execute
--
-- This raw SQL does NONE of that. It is here to document the change.
-- DESTRUCTIVE: step 1 deletes rows, and FK ON DELETE CASCADE also
-- deletes their player_quests rows. Take a backup before running it by hand.
--
-- Deploy order: the (main_quest, sub_quest) lookup fix must already be
-- live; the code that reads chapter_start / chapter_end ships AFTER this.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Remove quests that are not part of the questing design.
--
--    - 13 'standby' placeholder rows: 0 player rows, 0 dialogue rows.
--    - Quests 5 and 10: a 5th sub-quest in MQ1 / MQ2. The design has 4
--      sub-quests in each, and the Unity MQ1/MQ2 scenes and
--      Resources/Dialogues only contain SQ1-SQ4. They have no dialogue.
--      Their 8 player_quests rows are duplicates from the old off-by-one
--      completion bug (every one of those players also has the real SQ4
--      row, all with 0 failures and 0 artifacts). CASCADE removes them.
-- ------------------------------------------------------------
DELETE FROM quests WHERE id IN (5, 10) OR status = 'standby';

-- ------------------------------------------------------------
-- 2. El Filibusterismo book-chapter range covered by each sub-quest.
--    quests.chapter is legacy (always 1) and is NOT a lookup key;
--    players.chapter holds the main-quest number. Book chapters live here.
-- ------------------------------------------------------------
ALTER TABLE quests
  ADD COLUMN chapter_start INT NULL AFTER chapter,
  ADD COLUMN chapter_end   INT NULL AFTER chapter_start;

-- ------------------------------------------------------------
-- 3. Enforce the key the API now looks quests up by.
-- ------------------------------------------------------------
ALTER TABLE quests ADD UNIQUE KEY uq_mq_sq (main_quest, sub_quest);

-- ------------------------------------------------------------
-- 4. Chapter ranges from the questing design.
-- ------------------------------------------------------------
UPDATE quests SET chapter_start = 1,  chapter_end = 2  WHERE main_quest = 1 AND sub_quest = 1;
UPDATE quests SET chapter_start = 3,  chapter_end = 4  WHERE main_quest = 1 AND sub_quest = 2;
UPDATE quests SET chapter_start = 5,  chapter_end = 6  WHERE main_quest = 1 AND sub_quest = 3;
UPDATE quests SET chapter_start = 7,  chapter_end = 8  WHERE main_quest = 1 AND sub_quest = 4;
UPDATE quests SET chapter_start = 9,  chapter_end = 10 WHERE main_quest = 2 AND sub_quest = 1;
UPDATE quests SET chapter_start = 11, chapter_end = 12 WHERE main_quest = 2 AND sub_quest = 2;
UPDATE quests SET chapter_start = 13, chapter_end = 14 WHERE main_quest = 2 AND sub_quest = 3;
UPDATE quests SET chapter_start = 15, chapter_end = 16 WHERE main_quest = 2 AND sub_quest = 4;
UPDATE quests SET chapter_start = 17, chapter_end = 18 WHERE main_quest = 3 AND sub_quest = 1;
UPDATE quests SET chapter_start = 19, chapter_end = 20 WHERE main_quest = 3 AND sub_quest = 2;
UPDATE quests SET chapter_start = 21, chapter_end = 22 WHERE main_quest = 3 AND sub_quest = 3;
UPDATE quests SET chapter_start = 23, chapter_end = 24 WHERE main_quest = 3 AND sub_quest = 4;
UPDATE quests SET chapter_start = 25, chapter_end = 26 WHERE main_quest = 4 AND sub_quest = 1;
UPDATE quests SET chapter_start = 27, chapter_end = 28 WHERE main_quest = 4 AND sub_quest = 2;
UPDATE quests SET chapter_start = 29, chapter_end = 30 WHERE main_quest = 4 AND sub_quest = 3;
UPDATE quests SET chapter_start = 31, chapter_end = 32 WHERE main_quest = 4 AND sub_quest = 4;
UPDATE quests SET chapter_start = 33, chapter_end = 34 WHERE main_quest = 5 AND sub_quest = 1;
UPDATE quests SET chapter_start = 35, chapter_end = 36 WHERE main_quest = 5 AND sub_quest = 2;
UPDATE quests SET chapter_start = 37, chapter_end = 38 WHERE main_quest = 6 AND sub_quest = 1;
UPDATE quests SET chapter_start = 39, chapter_end = 39 WHERE main_quest = 7 AND sub_quest = 1;

-- ------------------------------------------------------------
-- Verification (expect 20 total, 20 active, 0 NULL ranges)
-- ------------------------------------------------------------
-- SELECT COUNT(*), SUM(status = 'active'), SUM(chapter_start IS NULL) FROM quests;
-- SELECT id, main_quest, sub_quest, chapter_start, chapter_end, title FROM quests ORDER BY main_quest, sub_quest;
