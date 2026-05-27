ALTER TABLE quest_dialogues
  ADD COLUMN option_a_delta INT NOT NULL DEFAULT 0,
  ADD COLUMN option_b_delta INT NOT NULL DEFAULT 10,
  ADD COLUMN option_c_delta INT NOT NULL DEFAULT 10;
