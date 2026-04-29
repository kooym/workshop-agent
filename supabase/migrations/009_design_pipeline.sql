-- Design pipeline restructure: task voting + bundling support

-- Allow voting on tasks (2nd round voting in design stage)
ALTER TABLE votes
  ADD COLUMN task_id uuid REFERENCES ax_tasks(id) ON DELETE CASCADE;

-- Task bundling: selected tasks can be merged into a unified bundle task
ALTER TABLE ax_tasks
  ADD COLUMN is_bundle boolean NOT NULL DEFAULT false,
  ADD COLUMN bundle_id uuid REFERENCES ax_tasks(id) ON DELETE SET NULL;

-- Solution canvas: store structured canvas data in design_artifacts
-- (reuses existing kpis, data_requirements, tobe_process columns)
