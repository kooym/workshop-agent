-- Cluster scoring: 3 criteria × 1-5 scale for prioritization
-- Scored by facilitator after AI clustering

ALTER TABLE clusters
  ADD COLUMN score_impact smallint CHECK (score_impact IS NULL OR (score_impact >= 1 AND score_impact <= 5)),
  ADD COLUMN score_feasibility smallint CHECK (score_feasibility IS NULL OR (score_feasibility >= 1 AND score_feasibility <= 5)),
  ADD COLUMN score_urgency smallint CHECK (score_urgency IS NULL OR (score_urgency >= 1 AND score_urgency <= 5));
