-- 011: UX 2차 개선 — ax_tasks에 kpi_name, estimated_value 컬럼 추가
ALTER TABLE ax_tasks
  ADD COLUMN IF NOT EXISTS kpi_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS estimated_value VARCHAR(200);
