-- Local development seed.
--
-- This seed is intentionally guarded. It inserts demo rows only when a local
-- Supabase Auth user with the configured demo UUID already exists.
-- Create that user through Supabase Studio/Auth before relying on the seed.

DO $$
DECLARE
  demo_user_id uuid := '00000000-0000-4000-a000-000000000001';
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = demo_user_id) THEN
    INSERT INTO projects (id, facilitator_id, name, description)
    VALUES (
      '00000000-0000-4000-a000-000000000010',
      demo_user_id,
      'Demo Project',
      'Local development demo project'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO workshops (
      id,
      project_id,
      facilitator_id,
      title,
      description,
      invite_code,
      current_stage
    )
    VALUES (
      '00000000-0000-4000-a000-000000000020',
      '00000000-0000-4000-a000-000000000010',
      demo_user_id,
      'Demo Workshop',
      'Local development workshop',
      'DEMO42',
      'gather'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO participants (id, workshop_id, user_id, display_name, is_facilitator)
    VALUES (
      '00000000-0000-4000-a000-000000000030',
      '00000000-0000-4000-a000-000000000020',
      demo_user_id,
      'Demo Facilitator',
      true
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO participants (id, workshop_id, display_name, role, is_facilitator)
    VALUES
      (
        '00000000-0000-4000-a000-000000000031',
        '00000000-0000-4000-a000-000000000020',
        'Demo Participant 1',
        'Sales',
        false
      ),
      (
        '00000000-0000-4000-a000-000000000032',
        '00000000-0000-4000-a000-000000000020',
        'Demo Participant 2',
        'Operations',
        false
      )
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
