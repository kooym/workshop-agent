-- Add design_step column to track 5-step wizard progress
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS design_step smallint NOT NULL DEFAULT 0;

-- design_step values: 0=not started, 1=TO-BE process, 2=agent specs, 3=tasks, 4=KPIs, 5=data requirements
ALTER TABLE workshops ADD CONSTRAINT workshops_design_step_range CHECK (design_step >= 0 AND design_step <= 5);
