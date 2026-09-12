# Lampara — Actual Database Schema

**Last captured:** 2026-09-12
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
| [`player_quests`](#player_quests) | 96 | Per-player quest progress + FR5/FR6 metrics |
| [`players`](#players) | 107 | Game accounts |
| [`post_comments`](#post_comments) | 1 | Comments on posts |
| [`post_likes`](#post_likes) | 5 | Likes on posts |
| [`quest_dialogues`](#quest_dialogues) | 239 | NPC dialogue + A/B/C choices |
| [`quests`](#quests) | 35 | Quest definitions (7 × 5 grid) |

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
| `created_at` | timestamp | YES | | CURRENT_TIMESTAMP |
| `updated_at` | timestamp | YES | | CURRENT_TIMESTAMP on update |
| `is_online` | tinyint(1) | YES | | 0 |
| `suspicion` | int | YES | | 0 |
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
> up `(chapter, main_quest, sub_quest)` — see the note under [`quests`](#quests).

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
| `main_quest` | int | NO | | 1 |
| `sub_quest` | int | NO | | 1 |
| `title` | varchar(255) | NO | | |
| `description` | text | YES | | NULL |
| `artifact_resource_path` | varchar(255) | YES | | NULL |
| `artifacts_total` | int | **NO** | | 0 |
| `status` | enum('active','inactive','archived','standby') | YES | idx | `active` |
| `created_at` | timestamp | YES | | CURRENT_TIMESTAMP |
| `updated_at` | timestamp | YES | | CURRENT_TIMESTAMP on update |

Indexes: **`uq_chapter_mq_sq` (chapter, main_quest, sub_quest) UNIQUE**, `idx_chapter`, `idx_status`

- `artifacts_total` — **FR5**: denominator of `R = (artifacts_found / artifacts_total) × 100`.
- `status = 'standby'` marks unused placeholder rows (15 of the 35). All 20 real
  sub-quests are `active`. `GET /players/:id/progression` filters on `status = 'active'`.

### ⚠️ The 7 × 5 grid — read before writing quest IDs

All 35 rows are `chapter = 1`. The table is a fixed grid: **every main quest occupies 5
slots** whether it uses them or not, with `Standby` rows filling the gaps.

```
id = (main_quest - 1) * 5 + sub_quest

MQ1 →  1   2   3   4  [5]          [ ] = Standby placeholder
MQ2 →  6   7   8   9  [10]
MQ3 → 11  12  13  14  [15]
MQ4 → 16  17  18  19  [20]
MQ5 → 21  22 [23] [24] [25]
MQ6 → 26 [27] [28] [29] [30]
MQ7 → 31 [32] [33] [34] [35]
```

Playable sub-quests per main quest: MQ1–MQ4 = 4, MQ5 = 2, MQ6 = 1, MQ7 = 1 (20 total).

The **stride is 5, not the playable count.** A packed offset table
(`{0,0,4,8,12,16,18,19}`) was previously used in the Unity client and silently wrote
progress to the wrong row for 16 of 20 sub-quests — two of them onto `Standby` rows.
Fixed 2026-09-05. Always resolve by `(chapter, main_quest, sub_quest)`, or use the
formula above.

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
