-- ============================================================
-- LAMPARA Performance Indexes Migration
-- Run this in Railway MySQL console
-- Safe to run multiple times (uses IF NOT EXISTS / CREATE INDEX IF NOT EXISTS)
-- ============================================================

-- 1. player_quests(player_id)
--    Used in every leaderboard query to count completed quests per player.
--    Without this, MySQL does a full table scan on player_quests for each player row.
CREATE INDEX IF NOT EXISTS idx_player_quests_player_id
  ON player_quests(player_id);

-- 2. player_quests(status)
--    Leaderboard filters WHERE status = 'completed' — speeds up that COUNT.
CREATE INDEX IF NOT EXISTS idx_player_quests_status
  ON player_quests(status);

-- 3. quest_dialogues(quest_id)
--    Unity calls /api/game/quest-content/:chapter/:quest/:subquest which SELECTs
--    all dialogues WHERE quest_id = ? ORDER BY sequence_order.
--    Without this, every NPC dialogue load scans the full table.
CREATE INDEX IF NOT EXISTS idx_quest_dialogues_quest_id
  ON quest_dialogues(quest_id);

-- 4. players(status)
--    Leaderboard WHERE p.status = 'active' — used in all ranking queries.
CREATE INDEX IF NOT EXISTS idx_players_status
  ON players(status);

-- 5. players(current_quest_id)
--    Used in the quest list query: COUNT(*) FROM players WHERE current_quest_id = q.id
CREATE INDEX IF NOT EXISTS idx_players_current_quest_id
  ON players(current_quest_id);
