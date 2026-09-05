-- ============================================================
-- LAMPARA Quest Metrics Migration (FR5 / FR6 / FR7)
-- Run this in the Railway MySQL console BEFORE deploying the
-- matching backend changes in routes/players.js.
--
-- NOT idempotent — MySQL 8 has no ADD COLUMN IF NOT EXISTS.
-- Re-running throws ER_DUP_FIELDNAME (1060), which is harmless.
-- ============================================================

-- 1. failure_count — FR6: how many times a player triggered
--    "Game Over: Cover Blown" on this quest.
ALTER TABLE player_quests
  ADD COLUMN failure_count INT NOT NULL DEFAULT 0 AFTER progress_percent;

-- 2. artifacts_found — FR5: artifacts the player collected on this quest.
ALTER TABLE player_quests
  ADD COLUMN artifacts_found INT NOT NULL DEFAULT 0 AFTER failure_count;

-- 3. artifacts_total — static per-quest artifact count (denominator of
--    Artifact Completion Rate: R = (found / total) * 100).
ALTER TABLE quests
  ADD COLUMN artifacts_total INT NOT NULL DEFAULT 0 AFTER artifact_resource_path;

-- ------------------------------------------------------------
-- Populate artifacts_total per quest.
-- Set the real counts here, or edit them from the admin portal
-- (Quest Management → quest edit) once this migration is applied.
-- Example:
--   UPDATE quests SET artifacts_total = 3 WHERE id = 1;
--   UPDATE quests SET artifacts_total = 2 WHERE id = 2;
-- ------------------------------------------------------------

-- Verification
-- SELECT id, title, artifacts_total FROM quests ORDER BY id;
-- SELECT player_id, quest_id, failure_count, artifacts_found FROM player_quests LIMIT 10;
