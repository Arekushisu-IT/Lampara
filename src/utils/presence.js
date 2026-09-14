/**
 * Player presence ("online").
 *
 * is_online is set at login and cleared only by an explicit logout, so a player who
 * closes the app, or whose phone dies, would otherwise stay online forever. A player
 * counts as online only while they have not logged out AND made an authenticated
 * request within ONLINE_WINDOW_MINUTES. verifyToken refreshes last_seen_at on player
 * requests (at most once per TOUCH_INTERVAL_SECONDS), so stale sessions age out on
 * their own.
 */

const ONLINE_WINDOW_MINUTES = 15;
const TOUCH_INTERVAL_SECONDS = 60;

/** SQL expression (1/0) for "this player is online". `alias` is the players table alias. */
function onlineSql(alias = 'p') {
  return `(${alias}.is_online = 1 AND ${alias}.last_seen_at >= NOW() - INTERVAL ${ONLINE_WINDOW_MINUTES} MINUTE)`;
}

let touchErrorLogged = false;

/**
 * Records player activity. Throttled in SQL so an active player costs at most one write
 * a minute. Never throws: presence is best-effort and must not block the request.
 */
async function touchPlayer(pool, playerId) {
  try {
    await pool.query(
      `UPDATE players SET last_seen_at = NOW(), is_online = 1
        WHERE id = ? AND (last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL ${TOUCH_INTERVAL_SECONDS} SECOND)`,
      [playerId]
    );
  } catch (err) {
    if (!touchErrorLogged) {
      touchErrorLogged = true;
      console.warn('[presence] Could not record player activity (run migrations/player_last_seen.sql):', err.message);
    }
  }
}

module.exports = { ONLINE_WINDOW_MINUTES, onlineSql, touchPlayer };
