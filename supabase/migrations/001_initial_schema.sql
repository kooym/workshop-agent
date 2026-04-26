-- Workshop Agent initial schema

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workshop_stage') THEN
    CREATE TYPE workshop_stage AS ENUM (
      'context',
      'gather',
      'cluster',
      'vote',
      'design',
      'generate',
      'report',
      'completed'
    );
  END IF;
END $$;

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  description text CHECK (description IS NULL OR char_length(description) <= 500),
  facilitator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workshops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  description text CHECK (description IS NULL OR char_length(description) <= 500),
  invite_code varchar(6) NOT NULL CHECK (invite_code ~ '^[A-Z2-9]{6}$'),
  current_stage workshop_stage NOT NULL DEFAULT 'context',
  facilitator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  settings jsonb NOT NULL DEFAULT '{
    "anonymous": false,
    "votes_per_person": 3,
    "max_participants": 20,
    "results_visible": false,
    "vote_mode": "cluster",
    "timer_minutes": null
  }'::jsonb,
  is_processing boolean NOT NULL DEFAULT false,
  is_processing_since timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((settings->>'vote_mode') IS NULL OR settings->>'vote_mode' IN ('cluster', 'note')),
  CHECK ((settings->>'votes_per_person') IS NULL OR ((settings->>'votes_per_person')::int BETWEEN 1 AND 10)),
  CHECK ((settings->>'max_participants') IS NULL OR ((settings->>'max_participants')::int BETWEEN 2 AND 20)),
  CHECK (
    (settings->>'timer_minutes') IS NULL
    OR jsonb_typeof(settings->'timer_minutes') = 'null'
    OR ((settings->>'timer_minutes')::int BETWEEN 1 AND 60)
  )
);

CREATE TABLE participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 30),
  role text CHECK (role IS NULL OR char_length(role) <= 50),
  is_facilitator boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE process_lanes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  order_index integer NOT NULL,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workshop_id, order_index)
);

CREATE TABLE process_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  description text CHECK (description IS NULL OR char_length(description) <= 500),
  node_type text NOT NULL DEFAULT 'task' CHECK (
    node_type IN (
      'task',
      'exclusive_gateway',
      'parallel_gateway',
      'start_event',
      'end_event',
      'intermediate_event',
      'sub_process'
    )
  ),
  order_index integer NOT NULL DEFAULT 0,
  position_x double precision,
  position_y double precision,
  width double precision,
  height double precision,
  lane_id uuid REFERENCES process_lanes(id) ON DELETE SET NULL,
  duration_info text,
  tools_systems text,
  volume_info text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE process_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  source_node_id uuid NOT NULL REFERENCES process_steps(id) ON DELETE CASCADE,
  target_node_id uuid NOT NULL REFERENCES process_steps(id) ON DELETE CASCADE,
  label text CHECK (label IS NULL OR char_length(label) <= 50),
  edge_type text NOT NULL DEFAULT 'sequence' CHECK (edge_type IN ('sequence', 'message', 'association')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_node_id, target_node_id),
  CHECK (source_node_id <> target_node_id)
);

CREATE TABLE editing_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  resource_type text NOT NULL CHECK (resource_type IN ('process_graph', 'design_artifacts')),
  editor_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workshop_id, resource_type)
);

CREATE TABLE clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  summary text CHECK (summary IS NULL OR char_length(summary) <= 300),
  order_index integer NOT NULL DEFAULT 0,
  is_stale boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  cluster_id uuid REFERENCES clusters(id) ON DELETE SET NULL,
  process_step_id uuid REFERENCES process_steps(id) ON DELETE SET NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 200),
  color text NOT NULL DEFAULT 'yellow' CHECK (color IN ('red', 'blue', 'green', 'yellow')),
  position_x double precision NOT NULL DEFAULT 0,
  position_y double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  cluster_id uuid REFERENCES clusters(id) ON DELETE CASCADE,
  note_id uuid REFERENCES notes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (cluster_id IS NOT NULL AND note_id IS NULL)
    OR (cluster_id IS NULL AND note_id IS NOT NULL)
  )
);

CREATE TABLE design_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  tobe_process jsonb NOT NULL,
  agent_specs jsonb NOT NULL,
  kpis jsonb NOT NULL,
  data_requirements jsonb NOT NULL,
  org_requirements jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_stale boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workshop_id, version)
);

CREATE TABLE ax_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  design_artifact_id uuid REFERENCES design_artifacts(id) ON DELETE SET NULL,
  cluster_id uuid REFERENCES clusters(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  description text CHECK (description IS NULL OR char_length(description) <= 500),
  difficulty text CHECK (difficulty IS NULL OR char_length(difficulty) <= 50),
  expected_effect text CHECK (expected_effect IS NULL OR char_length(expected_effect) <= 500),
  pain_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  core_features jsonb NOT NULL DEFAULT '[]'::jsonb,
  sub_features jsonb NOT NULL DEFAULT '[]'::jsonb,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE prds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 50000),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_stale boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workshop_id, version)
);

CREATE TABLE ax_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 80000),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_stale boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workshop_id, version)
);

CREATE TABLE task_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  task_id uuid REFERENCES ax_tasks(id) ON DELETE CASCADE,
  prd_id uuid REFERENCES prds(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  reaction_type text NOT NULL CHECK (reaction_type IN ('👍', '⚠️')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (task_id IS NOT NULL AND prd_id IS NULL)
    OR (task_id IS NULL AND prd_id IS NOT NULL)
  )
);

-- FK and frequent lookup indexes
CREATE INDEX idx_notes_workshop ON notes(workshop_id);
CREATE INDEX idx_notes_cluster ON notes(cluster_id);
CREATE INDEX idx_notes_process_step ON notes(process_step_id);
CREATE INDEX idx_votes_workshop ON votes(workshop_id);
CREATE INDEX idx_votes_cluster ON votes(cluster_id);
CREATE INDEX idx_votes_note ON votes(note_id);
CREATE INDEX idx_participants_workshop ON participants(workshop_id);
CREATE INDEX idx_workshops_project ON workshops(project_id);
CREATE INDEX idx_projects_facilitator ON projects(facilitator_id);
CREATE UNIQUE INDEX idx_workshops_invite_code ON workshops(invite_code);
CREATE INDEX idx_process_steps_workshop ON process_steps(workshop_id);
CREATE INDEX idx_process_steps_lane ON process_steps(lane_id);
CREATE INDEX idx_process_edges_workshop ON process_edges(workshop_id);
CREATE INDEX idx_process_edges_source ON process_edges(source_node_id);
CREATE INDEX idx_process_edges_target ON process_edges(target_node_id);
CREATE INDEX idx_process_lanes_workshop ON process_lanes(workshop_id);
CREATE INDEX idx_editing_locks_workshop ON editing_locks(workshop_id);
CREATE INDEX idx_design_artifacts_workshop ON design_artifacts(workshop_id);
CREATE INDEX idx_ax_reports_workshop ON ax_reports(workshop_id);
CREATE INDEX idx_ax_tasks_workshop ON ax_tasks(workshop_id);
CREATE INDEX idx_prds_workshop ON prds(workshop_id);
CREATE INDEX idx_task_reactions_workshop ON task_reactions(workshop_id);
CREATE INDEX idx_task_reactions_task ON task_reactions(task_id);
CREATE INDEX idx_task_reactions_prd ON task_reactions(prd_id);

-- Composite performance indexes
CREATE INDEX idx_workshops_stage ON workshops(current_stage);
CREATE INDEX idx_prds_latest ON prds(workshop_id, version DESC);
CREATE INDEX idx_ax_reports_latest ON ax_reports(workshop_id, version DESC);
CREATE INDEX idx_design_artifacts_latest ON design_artifacts(workshop_id, version DESC);
CREATE INDEX idx_participants_facilitator ON participants(workshop_id, is_facilitator);
CREATE INDEX idx_notes_timeline ON notes(workshop_id, created_at DESC);
CREATE INDEX idx_process_steps_order ON process_steps(workshop_id, lane_id, order_index);
CREATE INDEX idx_process_lanes_order ON process_lanes(workshop_id, order_index);
CREATE INDEX idx_clusters_order ON clusters(workshop_id, order_index);
CREATE INDEX idx_ax_tasks_order ON ax_tasks(workshop_id, order_index);

-- Unique constraints requiring nullable targets are partial indexes.
CREATE UNIQUE INDEX idx_votes_unique_cluster_target
  ON votes(workshop_id, participant_id, cluster_id)
  WHERE cluster_id IS NOT NULL;

CREATE UNIQUE INDEX idx_votes_unique_note_target
  ON votes(workshop_id, participant_id, note_id)
  WHERE note_id IS NOT NULL;

CREATE UNIQUE INDEX idx_task_reactions_unique_task
  ON task_reactions(workshop_id, participant_id, task_id, reaction_type)
  WHERE task_id IS NOT NULL;

CREATE UNIQUE INDEX idx_task_reactions_unique_prd
  ON task_reactions(workshop_id, participant_id, prd_id, reaction_type)
  WHERE prd_id IS NOT NULL;

CREATE UNIQUE INDEX idx_one_active_workshop_per_project
  ON workshops(project_id)
  WHERE current_stage <> 'completed';

-- Updated timestamp automation
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_workshops_updated_at
  BEFORE UPDATE ON workshops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_process_steps_updated_at
  BEFORE UPDATE ON process_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_clusters_updated_at
  BEFORE UPDATE ON clusters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_ax_tasks_updated_at
  BEFORE UPDATE ON ax_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_prds_updated_at
  BEFORE UPDATE ON prds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_design_artifacts_updated_at
  BEFORE UPDATE ON design_artifacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_ax_reports_updated_at
  BEFORE UPDATE ON ax_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_lanes ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE editing_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ax_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE prds ENABLE ROW LEVEL SECURITY;
ALTER TABLE ax_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facilitators can select own projects"
  ON projects FOR SELECT
  USING (auth.uid() = facilitator_id);

CREATE POLICY "realtime read workshops"
  ON workshops FOR SELECT
  USING (TRUE);

CREATE POLICY "realtime read participants"
  ON participants FOR SELECT
  USING (TRUE);

CREATE POLICY "realtime read process lanes"
  ON process_lanes FOR SELECT
  USING (TRUE);

CREATE POLICY "realtime read process steps"
  ON process_steps FOR SELECT
  USING (TRUE);

CREATE POLICY "realtime read process edges"
  ON process_edges FOR SELECT
  USING (TRUE);

CREATE POLICY "realtime read editing locks"
  ON editing_locks FOR SELECT
  USING (TRUE);

CREATE POLICY "realtime read clusters"
  ON clusters FOR SELECT
  USING (TRUE);

CREATE POLICY "realtime read notes"
  ON notes FOR SELECT
  USING (TRUE);

CREATE POLICY "realtime read votes"
  ON votes FOR SELECT
  USING (TRUE);

CREATE POLICY "realtime read design artifacts"
  ON design_artifacts FOR SELECT
  USING (TRUE);

CREATE POLICY "realtime read ax tasks"
  ON ax_tasks FOR SELECT
  USING (TRUE);

CREATE POLICY "realtime read prds"
  ON prds FOR SELECT
  USING (TRUE);

CREATE POLICY "realtime read ax reports"
  ON ax_reports FOR SELECT
  USING (TRUE);

CREATE POLICY "realtime read task reactions"
  ON task_reactions FOR SELECT
  USING (TRUE);

-- Supabase Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE workshops;
ALTER PUBLICATION supabase_realtime ADD TABLE process_steps;
ALTER PUBLICATION supabase_realtime ADD TABLE process_edges;
ALTER PUBLICATION supabase_realtime ADD TABLE process_lanes;
ALTER PUBLICATION supabase_realtime ADD TABLE editing_locks;
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
ALTER PUBLICATION supabase_realtime ADD TABLE clusters;
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
ALTER PUBLICATION supabase_realtime ADD TABLE task_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE design_artifacts;
ALTER PUBLICATION supabase_realtime ADD TABLE ax_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE prds;
ALTER PUBLICATION supabase_realtime ADD TABLE ax_reports;
