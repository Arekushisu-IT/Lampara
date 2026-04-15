# Lampara — Actual Database Schema (from Railway)
# Last captured: 2026-04-07
# Source: Railway MySQL (shortline.proxy.rlwy.net:20695)

# ============================================================
# TABLES (7 total — all confirmed present)
# ============================================================

# 1. Admin_User (1 row)
# ----------------------------------------------------------
# Column              | Type                          | Notes
# --------------------|-------------------------------|---------------------------
# id                  | int (PK, AI)                  |
# email               | varchar(255)                  |
# password            | varchar(255)                  | bcrypt hashed
# name                | varchar(255)                  |
# role                | enum('admin','staff','user')  | default 'admin'
# status              | enum('active','inactive','suspended') | default 'active'
# created_at          | timestamp                     |
# updated_at          | timestamp                     |

# 2. players (57 rows)
# ----------------------------------------------------------
# Column              | Type                              | Notes
# --------------------|-----------------------------------|---------------------------
# id                  | int (PK, AI)                      |
# name                | varchar(255)                      |
# username            | varchar(255)                      | UNIQUE
# password            | varchar(255)                      | bcrypt hashed
# email               | varchar(255)                      | nullable
# age                 | int                               |
# level               | int                               | default 1
# experience          | int                               | default 0
# status              | enum('active','inactive','banned','suspended','pending') |
# last_login          | timestamp                         | nullable
# created_at          | timestamp                         |
# updated_at          | timestamp                         |
# is_online           | tinyint(1)                        | default 0
# suspicion           | int                               | default 0
# chapter             | int                               | default 1
# verify_token        | varchar(128)                      | nullable
# token_expires_at    | datetime                          | nullable
# has_completed_tutorial | tinyint(1)                     | default 0
# current_quest_id    | int                               | nullable
# current_sub_quest   | int                               | nullable

# 3. quests (35 rows)
# ----------------------------------------------------------
# Column              | Type                              | Notes
# --------------------|-----------------------------------|---------------------------
# id                  | int (PK, AI)                      |
# chapter             | int                               |
# main_quest          | int                               |
# sub_quest           | int                               |
# title               | varchar(255)                      |
# description         | text                              |
# artifact_resource_path| varchar(255)                    | nullable, AR artifact path
# status              | enum('active','inactive','archived') |
# created_at          | timestamp                         |
# updated_at          | timestamp                         |
# UNIQUE(chapter, main_quest, sub_quest) implied

# 4. player_quests (33 rows)
# ----------------------------------------------------------
# Column              | Type                              | Notes
# --------------------|-----------------------------------|---------------------------
# id                  | int (PK, AI)                      |
# player_id           | int                               | FK → players.id
# quest_id            | int                               | FK → quests.id
# status              | enum('in_progress','completed')   |
# progress_percent    | int                               | default 0
# completed_at        | timestamp                         | nullable
# created_at          | timestamp                         |
# updated_at          | timestamp                         |
# UNIQUE(player_id, quest_id) implied

# 5. activity_logs (152 rows)
# ----------------------------------------------------------
# Column              | Type                              | Notes
# --------------------|-----------------------------------|---------------------------
# id                  | int (PK, AI)                      |
# user_id             | int                               | FK → Admin_User.id
# action              | varchar(100)                      |
# description         | text                              |
# timestamp           | timestamp                         |

# 6. quest_dialogues (3 rows)
# ----------------------------------------------------------
# Column              | Type                              | Notes
# --------------------|-----------------------------------|---------------------------
# id                  | int (PK, AI)                      |
# quest_id            | int                               | FK → quests.id (CASCADE delete)
# sequence_order      | int                               | UNIQUE(quest_id, sequence_order)
# npc_name            | varchar(100)                      | default 'NPC'
# npc_text            | text                              |
# option_a_text       | text                              |
# option_b_text       | text                              |
# option_c_text       | text                              | nullable, Option C text
# option_a_correct    | tinyint(1)                        | default 0
# option_b_correct    | tinyint(1)                        | default 1
# option_c_correct    | tinyint(1)                        | default 0
# suspicion_penalty   | int                               | default 10
# context_notes       | text                              |
# created_at          | timestamp                         |
# updated_at          | timestamp                         |

# 7. game_config (6 rows)
# ----------------------------------------------------------
# Column              | Type                              | Notes
# --------------------|-----------------------------------|---------------------------
# id                  | int (PK, AI)                      |
# config_key          | varchar(100)                      | UNIQUE
# config_value        | varchar(255)                      |
# description         | text                              |
# updated_at          | timestamp                         |

# Seed values:
#   suspicion_start, suspicion_wrong_penalty, suspicion_streak_bonus,
#   suspicion_streak_threshold, suspicion_max, max_conversations

# ============================================================
# ALL TABLES CONFIRMED ✅ — Code and DB are in sync
# ============================================================
