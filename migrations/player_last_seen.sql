-- ============================================================
-- LAMPARA player_last_seen migration
-- Prefer the runner (checks INFORMATION_SCHEMA, idempotent):
--   node migrations/run-player-last-seen.js            # dry run
--   node migrations/run-player-last-seen.js --apply    # execute
--
-- Apply BEFORE deploying the backend code that reads last_seen_at.
-- NOT idempotent as raw SQL (re-running the ALTER throws 1060, harmless).
-- ============================================================

-- last_seen_at -- when the player last made an authenticated request.
--
-- is_online is set at login and cleared only by an explicit logout, so closing the
-- app or losing power left players "online" forever. verifyToken now refreshes
-- last_seen_at (at most once a minute per player), and the API reports a player as
-- online only while is_online = 1 AND last_seen_at is within the last 15 minutes.
ALTER TABLE players
  ADD COLUMN last_seen_at TIMESTAMP NULL DEFAULT NULL AFTER last_login;

-- Backfill from last_login so recent sessions are not shown offline until the next request.
UPDATE players SET last_seen_at = last_login WHERE last_seen_at IS NULL AND last_login IS NOT NULL;

-- Verification
-- SHOW COLUMNS FROM players LIKE 'last_%';
