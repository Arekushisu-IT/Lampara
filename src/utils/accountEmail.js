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

/** True when any player already registered with this address (normalized). */
async function emailHasAccount(pool, email) {
  const [rows] = await pool.query(
    `SELECT id FROM players WHERE ${NORMALIZED_EMAIL_SQL} = ? LIMIT 1`,
    [normalizeAccountEmail(email)]
  );
  return rows.length > 0;
}

module.exports = { normalizeAccountEmail, isMultiAccountEmail, emailHasAccount };
