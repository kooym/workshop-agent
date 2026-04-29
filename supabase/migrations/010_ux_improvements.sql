-- UX Improvements Migration
-- 1. Cluster per-participant scoring table
-- 2. Reaction exclusive toggle (1 person 1 reaction per target)
-- 3. Task voting unique index
-- 4. Reaction type ⚠️ → 🤔

-- 1. cluster_scores: per-participant scoring
CREATE TABLE cluster_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  workshop_id uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  score_impact smallint NOT NULL CHECK (score_impact >= 1 AND score_impact <= 5),
  score_feasibility smallint NOT NULL CHECK (score_feasibility >= 1 AND score_feasibility <= 5),
  score_urgency smallint NOT NULL CHECK (score_urgency >= 1 AND score_urgency <= 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cluster_id, participant_id)
);

CREATE INDEX idx_cluster_scores_cluster ON cluster_scores(cluster_id);
CREATE INDEX idx_cluster_scores_workshop ON cluster_scores(workshop_id);

-- 2. Reaction exclusive toggle: change unique constraint to (workshop_id, participant_id, task_id)
-- Drop old per-reaction-type unique indexes
DROP INDEX IF EXISTS idx_task_reactions_unique_task;
DROP INDEX IF EXISTS idx_task_reactions_unique_prd;

-- New: 1 person = 1 reaction per task (regardless of reaction_type)
CREATE UNIQUE INDEX idx_task_reactions_unique_task
  ON task_reactions(workshop_id, participant_id, task_id)
  WHERE task_id IS NOT NULL;

CREATE UNIQUE INDEX idx_task_reactions_unique_prd
  ON task_reactions(workshop_id, participant_id, prd_id)
  WHERE prd_id IS NOT NULL;

-- 3. Task voting unique index (was missing)
CREATE UNIQUE INDEX idx_votes_unique_task_target
  ON votes(workshop_id, participant_id, task_id)
  WHERE task_id IS NOT NULL;

-- Fix: votes CHECK constraint needs to allow task_id-only votes
ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_check;
ALTER TABLE votes ADD CONSTRAINT votes_check CHECK (
  (cluster_id IS NOT NULL AND note_id IS NULL AND task_id IS NULL)
  OR (cluster_id IS NULL AND note_id IS NOT NULL AND task_id IS NULL)
  OR (cluster_id IS NULL AND note_id IS NULL AND task_id IS NOT NULL)
);

-- 4. Migrate ⚠️ → 🤔
UPDATE task_reactions SET reaction_type = '🤔' WHERE reaction_type = '⚠️';

-- Update CHECK constraint for reaction_type
ALTER TABLE task_reactions DROP CONSTRAINT IF EXISTS task_reactions_reaction_type_check;
ALTER TABLE task_reactions ADD CONSTRAINT task_reactions_reaction_type_check
  CHECK (reaction_type IN ('👍', '🤔'));

-- Apply updated_at trigger for cluster_scores
CREATE TRIGGER set_updated_at_cluster_scores
  BEFORE UPDATE ON cluster_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
