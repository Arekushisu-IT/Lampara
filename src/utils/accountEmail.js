/**
 * One player account per email address -- per Google account for Gmail.
 *
 * Gmail ignores dots and "+tags" in the local part and treats googlemail.com as
 * gmail.com, so j.doe+2@googlemail.com reaches the same inbox as jdoe@gmail.com.
 * Comparing raw strings would let one Google account register without limit, so both
 * the new address and every stored address are normalized before comparing. Stored
 * addresses are normalized in SQL because older rows were saved as typed.
 *
 * Addresses listed in the MULTI_ACCOUNT_EMAILS environment variable (comma-separated)
 * may own several accounts, for testing. Kept out of source so personal addresses are
 * not committed.
 */

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

function normalizeAccountEmail(email) {
  if (typeof email !== 'string') return '';
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at < 1) return trimmed;

  let local = trimmed.slice(0, at);
  let domain = trimmed.slice(at + 1);
  if (GMAIL_DOMAINS.has(domain)) {
    local = local.split('+')[0].replace(/\./g, '');
    domain = 'gmail.com';
  }
  return `${local}@${domain}`;
}

function isMultiAccountEmail(email) {
  const allowed = String(process.env.MULTI_ACCOUNT_EMAILS || '')
    .split(',')
    .map(normalizeAccountEmail)
    .filter(Boolean);
  return allowed.includes(normalizeAccountEmail(email));
}

// The same normalization as normalizeAccountEmail, applied to the stored column.
const NORMALIZED_EMAIL_SQL = `
  CASE
    WHEN SUBSTRING_INDEX(LOWER(TRIM(email)), '@', -1) IN ('gmail.com', 'googlemail.com')
      THEN CONCAT(
        REPLACE(SUBSTRING_INDEX(SUBSTRING_INDEX(LOWER(TRIM(email)), '@', 1), '+', 1), '.', ''),
        '@gmail.com')
    ELSE LOWER(TRIM(email))
  END`;

/**
 * An expired sign-up: registered but never verified ('inactive' is the pending status),
 * and the 24-hour verification link has run out. Nobody proved they own the inbox, so
 * the row must not hold the email or username -- otherwise a fake or mistyped address,
 * or someone else's real Gmail, would be blocked forever.
 */
const EXPIRED_SIGNUP_SQL = `(status = 'inactive' AND token_expires_at IS NOT NULL AND token_expires_at < NOW())`;

/**
 * True when any player already uses this address (normalized). Expired sign-ups do not
 * count. Pass excludePlayerId when changing an existing player's email, so their own row
 * does not count.
 */
async function emailHasAccount(pool, email, excludePlayerId = null) {
  const [rows] = await pool.query(
    `SELECT id FROM players
      WHERE ${NORMALIZED_EMAIL_SQL} = ? AND NOT ${EXPIRED_SIGNUP_SQL} AND (? IS NULL OR id <> ?)
      LIMIT 1`,
    [normalizeAccountEmail(email), excludePlayerId, excludePlayerId]
  );
  return rows.length > 0;
}

/** True when a live (not expired sign-up) account has this username. */
async function usernameTaken(pool, username) {
  const [rows] = await pool.query(
    `SELECT id FROM players WHERE username = ? AND NOT ${EXPIRED_SIGNUP_SQL} LIMIT 1`,
    [username]
  );
  return rows.length > 0;
}

/**
 * Deletes expired sign-ups holding this username or email, so a new registration can use
 * them. Only rows that never started playing (no player_quests) are removed. For
 * MULTI_ACCOUNT_EMAILS addresses only the username is matched, so one registration does
 * not sweep away other test sign-ups. Returns the number of rows removed.
 */
async function releaseExpiredSignups(pool, { username, email }) {
  const matchEmail = email && !isMultiAccountEmail(email);
  const [result] = await pool.query(
    `DELETE FROM players
      WHERE ${EXPIRED_SIGNUP_SQL}
        AND (username = ? ${matchEmail ? `OR ${NORMALIZED_EMAIL_SQL} = ?` : ''})
        AND NOT EXISTS (SELECT 1 FROM player_quests pq WHERE pq.player_id = players.id)`,
    matchEmail ? [username, normalizeAccountEmail(email)] : [username]
  );
  return result.affectedRows;
}

module.exports = {
  normalizeAccountEmail, isMultiAccountEmail, emailHasAccount, usernameTaken, releaseExpiredSignups
};
