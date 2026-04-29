-- Add final_task_detail and solution_canvas columns to design_artifacts
ALTER TABLE design_artifacts
  ADD COLUMN IF NOT EXISTS final_task_detail JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS solution_canvas JSONB DEFAULT NULL;
