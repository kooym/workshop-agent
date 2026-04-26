-- Priority is editable in the AX design step and used for downstream PRD ordering.

ALTER TABLE ax_tasks
  ADD COLUMN priority text CHECK (priority IS NULL OR priority IN ('high', 'medium', 'low'));
