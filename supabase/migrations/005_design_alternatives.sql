-- Add alternative_index and alternative_name to design_artifacts
-- Remove org_requirements column

-- Drop the unique constraint on (workshop_id, version) to allow 3 alternatives per version
ALTER TABLE design_artifacts DROP CONSTRAINT IF EXISTS design_artifacts_workshop_id_version_key;

-- Add new columns
ALTER TABLE design_artifacts ADD COLUMN alternative_index integer NOT NULL DEFAULT 0 CHECK (alternative_index >= 0 AND alternative_index <= 2);
ALTER TABLE design_artifacts ADD COLUMN alternative_name text NOT NULL DEFAULT '';

-- Drop org_requirements column
ALTER TABLE design_artifacts DROP COLUMN IF EXISTS org_requirements;

-- New unique constraint: (workshop_id, version, alternative_index)
ALTER TABLE design_artifacts ADD CONSTRAINT design_artifacts_workshop_version_alt UNIQUE (workshop_id, version, alternative_index);

-- Update index for latest lookup
DROP INDEX IF EXISTS idx_design_artifacts_latest;
CREATE INDEX idx_design_artifacts_latest ON design_artifacts(workshop_id, version DESC, alternative_index);
