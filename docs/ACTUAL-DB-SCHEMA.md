# Lampara — Actual Database Schema

**Last captured:** 2026-09-12 · `quests` / `player_quests` re-verified 2026-09-14 after `migrations/quest_chapters.sql` and `migrations/artifact_data.sql`
**Source:** Railway MySQL (`shortline.proxy.rlwy.net:20695`), database `lampara_database`
**Captured from:** `INFORMATION_SCHEMA` — column types, keys, defaults and indexes are verbatim.

**12 tables.** Row counts are live at capture time and will drift.

| Table | Rows | Purpose |
|---|---|---|
| [`Admin_User`](#admin_user) | 1 | Admin panel accounts |
| [`activity_logs`](#activity_logs) | 251 | Admin action audit trail |
| [`community_posts`](#community_posts) | 2 | Player portal posts |
| [`game_config`](#game_config) | 6 | Suspicion meter tuning |
| [`notifications`](#notifications) | 6 | Player notifications |
| [`password_resets`](#password_resets) | 3 | Password reset tokens |
| [`player_quests`](#player_quests) | 92 | Per-player quest progress + FR5/FR6 metrics |
| [`players`](#players) | 107 | Game accounts |
| [`post_comments`](#post_comments) | 1 | Comments on posts |
| [`post_likes`](#post_likes) | 5 | Likes on posts |
| [`quest_dialogues`](#quest_dialogues) | 239 | NPC dialogue + A/B/C choices |
| [`quests`](#quests) | 20 | The 20 designed sub-quests, with El Filibusterismo chapter ranges |

---

## Admin_User

| Column | Type | Null | Key | Default |
|---|---|---|---|---|
| `id` | int | NO | PK, AI | |
| `email` | varchar(255) | NO | UNIQUE | |
| `password` | varchar(255) | NO | | bcrypt hash |
| `name` | varchar(255) | NO | | |
| `role` | enum('admin','staff','user') | YES | idx | `user` |
| `status` | enum('active','inactive','suspended') | YES | | `active` |
| `created_at` | timestamp | YES | | CURRENT_TIMESTAMP |
| `updated_at` | timestamp | YES | | CURRENT_TIMESTAMP on update |

Indexes: `email` (unique), `idx_email`, `idx_role`

---

## activity_logs

| Column | Type | Null | Key | Default |
|---|---|---|---|---|
| `id` | int | NO | PK, AI | |
| `user_id` | int | NO | FK → `Admin_User.id` | |
| `action` | varchar(100) | NO | idx | |
| `description` | text | YES | | NULL |
| `timestamp` | timestamp | YES | idx | CURRENT_TIMESTAMP |

Indexes: `idx_user_id`, `idx_action`, `idx_timestamp`

---

## community_posts

| Column | Type | Null | Key | Default |
|---|---|---|---|---|
| `id` | int | NO | PK, AI | |
| `player_id` | int | NO | FK → `players.id` | |
| `content` | text | NO | | |
| `likes_count` | int | YES | | 0 |
| `comments_count` | int | YES | | 0 |
| `created_at` | timestamp | YES | | CURRENT_TIMESTAMP |
| `updated_at` | timestamp | YES | | CURRENT_TIMESTAMP on update |

`likes_count` / `comments_count` are denormalised counters — keep them in step with
`post_likes` / `post_comments`.

---

## game_config

| Column | Type | Null | Key | Default |
|---|---|---|---|---|
| `id` | int | NO | PK, AI | |
| `config_key` | varchar(100) | NO | UNIQUE | |
| `config_value` | varchar(255) | NO | | |
| `description` | text | YES | | NULL |
| `updated_at` | timestamp | YES | | CURRENT_TIMESTAMP on update |

Seeded keys: `suspicion_start`, `suspicion_wrong_penalty`, `suspicion_streak_bonus`,
`suspicion_streak_threshold`, `suspicion_max`, `max_conversations`

---

## notifications

| Column | Type | Null | Key | Default |
|---|---|---|---|---|
| `id` | int | NO | PK, AI | |
| `player_id` | int | NO | FK → `players.id` | |
| `type` | enum('like','comment','verified','system') | NO | | |
| `message` | text | NO | | |
| `reference_id` | int | YES | | NULL |
| `is_read` | tinyint(1) | YES | | 0 |
| `created_at` | timestamp | YES | idx | CURRENT_TIMESTAMP |

Indexes: `idx_player_read` (player_id, is_read), `idx_created`

---

## password_resets

| Column | Type | Null | Key | Default |
|---|---|---|---|---|
| `id` | int | NO | PK, AI | |
| `player_id` | int | NO | FK → `players.id` | |
| `token` | varchar(128) | NO | UNIQUE | |
| `expires_at` | timestamp | NO | | |
| `used` | tinyint(1) | YES | | 0 |
| `created_at` | timestamp | YES | | CURRENT_TIMESTAMP |

Indexes: `token` (unique), `idx_token`, `player_id`

---

## player_quests

| Column | Type | Null | Key | Default |
|---|---|---|---|---|
| `id` | int | NO | PK, AI | |
| `player_id` | int | NO | FK → `players.id` | |
| `quest_id` | int | NO | FK → `quests.id` | |
| `status` | enum('in_progress','completed','failed') | YES | | `in_progress` |
| `progress_percent` | int | YES | | 0 |
| `failure_count` | int | **NO** | | 0 |
| `artifacts_found` | int | **NO** | | 0 |
| `completed_at` | timestamp | YES | | NULL |
| `created_at` | timestamp | YES | | CURRENT_TIMESTAMP |
| `updated_at` | timestamp | YES | | CURRENT_TIMESTAMP on update |

Indexes: **`uq_player_quest` (player_id, quest_id) UNIQUE**, `quest_id`

- `failure_count` — **FR6**: "Game Over: Cover Blown" triggers on this quest.
- `artifacts_found` — **FR5**: numerator of the Artifact Completion Rate.
- Both are `NOT NULL DEFAULT 0` so aggregate queries can never return `NULL`.
- Both are **monotonic**: `/complete-quest` and `/save-checkpoint` write them with
  `GREATEST(col, VALUES(col))`, never a blind overwrite. The client sends a running
  absolute total, so a clean replay used to lower the recorded count. Monotonic also
  makes those writes idempotent, which is what lets a redelivered offline request be
  a harmless no-op.
- The unique key on (player_id, quest_id) is what makes the `ON DUPLICATE KEY UPDATE`
  upserts in `routes/players.js` work.

---

## players

| Column | Type | Null | Key | Default |
|---|---|---|---|---|
| `id` | int | NO | PK, AI | |
| `name` | varchar(255) | NO | | |
| `username` | varchar(255) | NO | UNIQUE | |
| `password` | varchar(255) | NO | | bcrypt hash |
| `email` | varchar(255) | **NO** | | |
| `level` | int | YES | idx | 1 |
| `experience` | int | YES | | 0 |
| `status` | enum('active','inactive','banned') | YES | idx | `active` |
| `last_login` | timestamp | YES | | NULL |
| `last_seen_at` | timestamp | YES | | NULL |
| `created_at` | timestamp | YES | | CURRENT_TIMESTAMP |
| `updated_at` | timestamp | YES | | CURRENT_TIMESTAMP on update |
| `is_online` | tinyint(1) | YES | | 0 |
| `suspicion` | int | YES | | 0 |
| `suspicion_seq` | int | NO | | 0 |
| `chapter` | int | YES | | 1 |
| `verify_token` | varchar(128) | YES | UNIQUE | NULL |
| `token_expires_at` | datetime | YES | | NULL |
| `has_completed_tutorial` | tinyint(1) | YES | | 0 |
| `current_quest_id` | int | YES | | 0 |
| `current_sub_quest` | int | YES | | 0 |
| `birthdate` | date | NO | idx | |

Indexes: `uq_username` (unique), `idx_username`, `idx_status`, `idx_level`,
`idx_birthdate`, `verify_token` (unique)

> ⚠️ **`current_quest_id` is a misnomer.** It stores the player's **main quest number
> (1–7)**, *not* a foreign key into `quests.id`. `authController.js` maps it to
> `current_main_quest` in API responses. To resolve the player's actual quest row, look
> up `quests` by `(main_quest, sub_quest)` = `(current_quest_id, current_sub_quest)` — see
> the note under [`quests`](#quests).

> ⚠️ **`players.chapter` is also the main-quest number, not a book chapter.** The game sends
> the main-quest number as `advance_to_chapter`, so this column mirrors `current_quest_id`.
> It is **never** used to look up a quest. The El Filibusterismo book chapters a player is
> on come from their current quest's `quests.chapter_start` / `chapter_end`.

> **One account per email is enforced at registration, not by the database.** `email` has no
> UNIQUE key because existing test accounts share addresses (one address has 40 accounts).
> `POST /auth/player-register` rejects an address that already has an account (409), comparing
> normalized addresses: lowercased and trimmed, and for Gmail with dots and `+tags` removed and
> `googlemail.com` treated as `gmail.com` (`src/utils/accountEmail.js`). Addresses listed in the
> `MULTI_ACCOUNT_EMAILS` env var (comma-separated) are exempt, for testing. Suspended and rejected
> accounts are kept as `status = 'banned'`, so they also block re-registration with that address.
> Admin-created accounts follow the same rule: `POST /players` returns 409 for an address that
> already has an account, and `PUT /players/:id` returns 409 when an email is *changed* to one
> another player uses (resending a player's current email is allowed).

> **Unverified sign-ups expire.** Registration saves the player as `status = 'inactive'` until they
> click the emailed link (`verify_token`, valid 24 hours until `token_expires_at`). Once that link has
> expired unverified, the row no longer holds its email or username: availability checks ignore it,
> and the next registration using that username or email deletes it (only if it has no
> `player_quests` rows). `POST /auth/check-email` gives the register page a live "already used" hint.
> The web player portal refuses `inactive` accounts; the game shows its own waiting screen.

> **Online status is computed, not read from `is_online` alone.** `is_online` is set at login and
> cleared only by an explicit logout, so closing the app left players "online". Any authenticated
> player request refreshes `last_seen_at` (at most once a minute, `src/middleware/auth.js`), and the
> API reports a player as online only while `is_online = 1 AND last_seen_at` is within the last
> 15 minutes (`src/utils/presence.js`). Stale flags age out on their own; no cleanup job is needed.

**The two suspicion columns, and why there are two:**

- `suspicion` — a running **0–100 meter**, not a lifetime total. It rises on a wrong
  dialogue choice, falls on a streak bonus (`game_config.suspicion_streak_bonus`), and
  resets to 0 only when a failure at 100 restarts the sub-quest. It carries across
  sub-quest boundaries and across sessions. New players are seeded from
  `game_config.suspicion_start` at registration.
- `suspicion_seq` — a monotonic write counter. Because `suspicion` moves in **both**
  directions it cannot be merged with `GREATEST()` the way `failure_count` and
  `artifacts_found` are; there is no value-only rule that makes a write idempotent. The
  client bumps this on every registered choice, and the server applies a write only when
  the incoming seq exceeds the stored one — which makes a replayed offline write a
  harmless no-op instead of a corruption.

> Do not confuse `players.suspicion` with `player_quests.failure_count`. Suspicion is the
> live meter; `failure_count` counts how many times that meter actually reached 100 on a
> given quest. The leaderboard's `failCount` reports the latter.

---

## post_comments

| Column | Type | Null | Key | Default |
|---|---|---|---|---|
| `id` | int | NO | PK, AI | |
| `post_id` | int | NO | FK → `community_posts.id` | |
| `player_id` | int | NO | FK → `players.id` | |
| `content` | text | NO | | |
| `created_at` | timestamp | YES | | CURRENT_TIMESTAMP |

---

## post_likes

| Column | Type | Null | Key | Default |
|---|---|---|---|---|
| `id` | int | NO | PK, AI | |
| `post_id` | int | NO | FK → `community_posts.id` | |
| `player_id` | int | NO | FK → `players.id` | |
| `created_at` | timestamp | YES | | CURRENT_TIMESTAMP |

Indexes: **`unique_like` (post_id, player_id) UNIQUE** — one like per player per post.

---

## quest_dialogues

| Column | Type | Null | Key | Default |
|---|---|---|---|---|
| `id` | int | NO | PK, AI | |
| `quest_id` | int | NO | FK → `quests.id` | |
| `sequence_order` | int | NO | | 1 |
| `npc_name` | varchar(100) | NO | | `NPC` |
| `npc_text` | text | NO | | |
| `option_a_text` | text | NO | | |
| `option_b_text` | text | NO | | |
| `option_a_correct` | tinyint(1) | NO | | 0 |
| `option_b_correct` | tinyint(1) | NO | | 1 |
| `option_c_text` | text | YES | | NULL |
| `option_c_correct` | tinyint(1) | YES | | 0 |
| `suspicion_penalty` | int | NO | | 10 |
| `artifact_resource_path` | varchar(255) | YES | | NULL |
| `context_notes` | text | YES | | NULL |
| `created_at` | timestamp | YES | | CURRENT_TIMESTAMP |
| `updated_at` | timestamp | YES | | CURRENT_TIMESTAMP on update |
| `option_a_delta` | int | NO | | 0 |
| `option_b_delta` | int | NO | | 10 |
| `option_c_delta` | int | NO | | 10 |

Indexes: **`uq_quest_seq` (quest_id, sequence_order) UNIQUE**

Suspicion model: A = correct (`-10`), B = wrong (`+10`), C = reveals faster (`+35`).
The `option_*_delta` columns hold the signed change; Unity applies them client-side.
Populated by the `lampara-dialogue-import` pipeline (`seeds/`).

---

## quests

| Column | Type | Null | Key | Default |
|---|---|---|---|---|
| `id` | int | NO | PK, AI | |
| `chapter` | int | NO | idx | |
| `chapter_start` | int | YES | | NULL |
| `chapter_end` | int | YES | | NULL |
| `main_quest` | int | NO | | 1 |
| `sub_quest` | int | NO | | 1 |
| `title` | varchar(255) | NO | | |
| `description` | text | YES | | NULL |
| `artifact_resource_path` | varchar(255) | YES | | NULL |
| `artifacts_total` | int | **NO** | | 0 |
| `status` | enum('active','inactive','archived','standby') | YES | idx | `active` |
| `created_at` | timestamp | YES | | CURRENT_TIMESTAMP |
| `updated_at` | timestamp | YES | | CURRENT_TIMESTAMP on update |

Indexes: **`uq_mq_sq` (main_quest, sub_quest) UNIQUE** — the lookup key,
`uq_chapter_mq_sq` (chapter, main_quest, sub_quest) UNIQUE (legacy), `idx_chapter`, `idx_status`

- `artifacts_total` — **FR5**: denominator of `R = (artifacts_found / artifacts_total) × 100`.
  **1 for every sub-quest** — the game has exactly one AR artifact per sub-quest, and the AR scan
  stops after the first correct find. A quest "holds an artifact" when this is > 0; the API counts
  `artifacts_found` at most once per quest (three game scripts can record the same artifact).
- `artifact_resource_path` — the Unity `Resources` prefab path of the sub-quest's AR artifact, copied
  from the MQ scenes' `SubQuestSequenceConfig` (all 20 set). The game loads this value in preference
  to its Inspector copy, so a wrong path breaks that sub-quest's AR spawn. It also names the artifact in
  the glossary (`GET /players/:id/artifacts`), e.g. `PassageOfTheTabo_Artifact` → "Passage Of The Tabo".
  19 distinct prefabs: MQ6-SQ1 reuses MQ2-SQ4's `QuirogasCrate`, as configured in Unity.
- `chapter_start` / `chapter_end` — the **El Filibusterismo book chapters** the sub-quest
  covers (e.g. MQ2-SQ4 = Ch. 15–16). Set for all 20 rows by `migrations/quest_chapters.sql`.
- `chapter` — **legacy, always `1`. Not a lookup key and not a book chapter.** Kept because
  installed APKs still send a value in that URL slot.
- All 20 rows are `status = 'active'`. The 13 `Standby` placeholders and the undesigned
  5th sub-quest of MQ1 and MQ2 (ids 5 and 10) were deleted 2026-09-14.

### ⚠️ Quest IDs — read before writing or looking up a quest

**Look quests up by `(main_quest, sub_quest)`, never by `chapter`.** Every row stores
`chapter = 1` while the game sends the main-quest number in that slot, so a lookup that
included `chapter` matched nothing past MQ1 (fixed 2026-09-14, commit `e900210`).

IDs still follow the original 5-wide grid. Deleting the placeholders renumbered nothing,
so the gaps are expected — **never assume ids are packed end-to-end**:

```
id = (main_quest - 1) * 5 + sub_quest

        SQ1          SQ2          SQ3          SQ4
MQ1 →   1 Ch.1–2     2 Ch.3–4     3 Ch.5–6     4 Ch.7–8
MQ2 →   6 Ch.9–10    7 Ch.11–12   8 Ch.13–14   9 Ch.15–16
MQ3 →  11 Ch.17–18  12 Ch.19–20  13 Ch.21–22  14 Ch.23–24
MQ4 →  16 Ch.25–26  17 Ch.27–28  18 Ch.29–30  19 Ch.31–32
MQ5 →  21 Ch.33–34  22 Ch.35–36
MQ6 →  26 Ch.37–38
MQ7 →  31 Ch.39  (final boss)
```

The **stride is 5, not the playable count** — the Unity client computes ids with this
formula (`SubQuestSequenceManager.CalculateQuestID`). A packed offset table was previously
used there and silently wrote progress to the wrong row (fixed 2026-09-05). `POST /quests`
sets the id explicitly with this formula and bounds MQ to 1–7 and SQ to 1–5.

---

## Drift corrected in this capture

The previous version of this doc (2026-04-07) listed 7 tables and had several
inaccuracies. Fixed here:

| | Was documented | Actually |
|---|---|---|
| Table count | 7 | **12** — added `community_posts`, `notifications`, `password_resets`, `post_comments`, `post_likes` |
| `players.status` | included `'suspended'`, `'pending'` | only `('active','inactive','banned')` |
| `players.email` | nullable | **NOT NULL** |
| `players.current_quest_id` | nullable | `DEFAULT 0` |
| `player_quests.status` | 2 values | 3 — gained `'failed'` |
| `quests.status` | 3 values | 4 — gained `'standby'` |
| `quest_dialogues` | no artifact column | has `artifact_resource_path` |
| `Admin_User.role` default | `admin` | `user` |
| Foreign keys | not documented | all 9 now listed |
| Indexes | not documented | all now listed |

Columns added 2026-09-05 for FR5/FR6/FR7 (`migrations/quest_metrics.sql`):
`player_quests.failure_count`, `player_quests.artifacts_found`, `quests.artifacts_total`.

**2026-09-14 — `migrations/quest_chapters.sql`** (runner: `run-quest-chapters.js`):
- Deleted 15 `quests` rows: 13 `Standby` placeholders + ids 5 and 10 (a 5th sub-quest in
  MQ1/MQ2 absent from the design and the game, with no dialogue).
- FK `ON DELETE CASCADE` removed 8 `player_quests` rows (100 → 92). Every one duplicated
  that player's real SQ4 row, with 0 failures and 0 artifacts.
- Added `quests.chapter_start`, `quests.chapter_end`, and `UNIQUE uq_mq_sq (main_quest, sub_quest)`.
- Restore file: `migrations/backups/quest_cleanup_2026-09-14T03-17-36-382Z.sql` (local, not committed).

**2026-09-14 — `migrations/artifact_data.sql`** (runner: `run-artifact-data.js`), data only:
- Set `artifact_resource_path` for all 20 quests from the Unity MQ scenes (after Plastic changeset 120),
  and `artifacts_total = 1` for each (previously 3 quests had 1, the rest 0; every path was empty).
- Verified after apply: 0 empty paths, `SUM(artifacts_total)` = 20, 0 rows with `artifacts_found > artifacts_total`.
- Restore file: `migrations/backups/artifact_data_2026-09-14T04-33-52-907Z.sql` (local, not committed).

**2026-09-14 — `migrations/player_last_seen.sql`** (runner: `run-player-last-seen.js`):
- Added `players.last_seen_at TIMESTAMP NULL` after `last_login`, backfilled from `last_login` (83 players).
- Additive only; no restore file needed (`ALTER TABLE players DROP COLUMN last_seen_at` reverts it).
