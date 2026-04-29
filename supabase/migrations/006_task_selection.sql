-- Add is_selected column to ax_tasks for cherry-picking tasks into PRD
ALTER TABLE ax_tasks ADD COLUMN is_selected boolean NOT NULL DEFAULT true;
