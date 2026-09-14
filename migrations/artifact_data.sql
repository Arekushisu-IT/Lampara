-- ============================================================
-- LAMPARA Artifact Data (Phase 2, Step 1) — data only, no schema change
--
-- Prefer the runner, which writes a restore file first and skips rows
-- that already match:
--   node migrations/run-artifact-data.js            # dry run
--   node migrations/run-artifact-data.js --apply    # execute
--
-- Copies each sub-quest's AR artifact from the game into quests, and
-- sets artifacts_total = 1 (the game has exactly one AR artifact per
-- sub-quest, and the AR scan stops after the first correct find).
--
-- Source: Unity MQ scenes, SubQuestSequenceConfig.artifactResourcePath,
-- read 2026-09-14 after Plastic changeset 120. All 20 prefabs exist under
-- Assets/Resources. The game already uses these paths, so players see no
-- change; the data becomes visible to the admin panel, leaderboard and
-- the artifact glossary API (GET /players/:id/artifacts).
-- ============================================================

UPDATE quests SET artifacts_total = 1, artifact_resource_path = 'Artifacts/PassageOfTheTabo/PassageOfTheTabo_Artifact'                    WHERE main_quest = 1 AND sub_quest = 1;
UPDATE quests SET artifacts_total = 1, artifact_resource_path = 'Artifacts/The Decree of Arrest/TheDecreeOfLandSeizure_Artifact'          WHERE main_quest = 1 AND sub_quest = 2;
UPDATE quests SET artifacts_total = 1, artifact_resource_path = 'Artifacts/CapitanBasilioLamp/CapitanBasilioLamp_Artifact'                WHERE main_quest = 1 AND sub_quest = 3;
UPDATE quests SET artifacts_total = 1, artifact_resource_path = 'Artifacts/GlassesModel/SimounsGoggles_Artifact'                          WHERE main_quest = 1 AND sub_quest = 4;
UPDATE quests SET artifacts_total = 1, artifact_resource_path = 'Artifacts/TalesRevolver/TalesRevolver_Artifact'                          WHERE main_quest = 2 AND sub_quest = 1;
UPDATE quests SET artifacts_total = 1, artifact_resource_path = 'Artifacts/The Academy Petition/TheAcademyPetition_Artifact'              WHERE main_quest = 2 AND sub_quest = 2;
UPDATE quests SET artifacts_total = 1, artifact_resource_path = 'Artifacts/TheBrokenApparatus/TheBrokenApparatus_Artifact'                WHERE main_quest = 2 AND sub_quest = 3;
UPDATE quests SET artifacts_total = 1, artifact_resource_path = 'Artifacts/QuirogasCrate/QuirogasCrate_Artifact'                          WHERE main_quest = 2 AND sub_quest = 4;
UPDATE quests SET artifacts_total = 1, artifact_resource_path = 'Artifacts/MrLeedsHead/MrLeedsHead_Artifact'                              WHERE main_quest = 3 AND sub_quest = 1;
UPDATE quests SET artifacts_total = 1, artifact_resource_path = 'Artifacts/TheHiddenFuse/TheHiddenFuse_Artifact'                          WHERE main_quest = 3 AND sub_quest = 2;
UPDATE quests SET artifacts_total = 1, artifact_resource_path = 'Artifacts/SimounsJewelCase/SimounsJewelCase_Artifact'                    WHERE main_quest = 3 AND sub_quest = 3;
UPDATE quests SET artifacts_total = 1, artifact_resource_path = 'Artifacts/QuillofRevolution/QuillofRevolution_Artifact'                  WHERE main_quest = 3 AND sub_quest = 4;
UPDATE quests SET artifacts_total = 1, artifact_resource_path = 'Artifacts/ThePasquinade/ThePasquinade_Artifact'                          WHERE main_quest = 4 AND sub_quest = 1;
UPDATE quests SET artifacts_total = 1, artifact_resource_path = 'Artifacts/PadreFernandezsCross/PadreFernandezsCross_Artifact'            WHERE main_quest = 4 AND sub_quest = 2;
UPDATE quests SET artifacts_total = 1, artifact_resource_path = 'Artifacts/JulisEarrings/JulisEarrings_Artifact'                          WHERE main_quest = 4 AND sub_quest = 3;
UPDATE quests SET artifacts_total = 1, artifact_resource_path = 'Artifacts/Wedding Invitation/WeddingInvitation_Artifact'                 WHERE main_quest = 4 AND sub_quest = 4;
UPDATE quests SET artifacts_total = 1, artifact_resource_path = 'Artifacts/PomegranateLamp/PomegranateLamp_Artifact'                      WHERE main_quest = 5 AND sub_quest = 1;
UPDATE quests SET artifacts_total = 1, artifact_resource_path = 'Artifacts/PomegranateLamp/PomegranateLamp_WeddingGift_Artifact'          WHERE main_quest = 5 AND sub_quest = 2;
-- Same prefab as MQ2-SQ4 in the Unity scene; confirm with the Unity owner.
UPDATE quests SET artifacts_total = 1, artifact_resource_path = 'Artifacts/QuirogasCrate/QuirogasCrate_Artifact'                          WHERE main_quest = 6 AND sub_quest = 1;
UPDATE quests SET artifacts_total = 1, artifact_resource_path = 'Artifacts/TheSunkenTreasure/TheSunkenTreasure_Artifact'                  WHERE main_quest = 7 AND sub_quest = 1;

-- Verification (expect 20 rows, 0 empty paths, artifacts_total sum 20)
-- SELECT COUNT(*), SUM(artifact_resource_path IS NULL OR artifact_resource_path = ''), SUM(artifacts_total) FROM quests;
