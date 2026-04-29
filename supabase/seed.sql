-- Local development seed.
--
-- Creates the admin user and demo data for local development.
-- Runs on `npx supabase db reset`.

-- ══════════════════════════════════════════════════════════════
-- 1. Admin user (email: admin@admin.com, password: 123123123)
-- ══════════════════════════════════════════════════════════════
-- Delete existing demo user if present, then re-insert
DELETE FROM auth.identities WHERE user_id = '00000000-0000-4000-a000-000000000001';
DELETE FROM auth.users WHERE id = '00000000-0000-4000-a000-000000000001';

INSERT INTO auth.users (
  instance_id, id, aud, role,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current,
  phone, phone_change, phone_change_token, reauthentication_token
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-a000-000000000001',
  'authenticated', 'authenticated',
  'admin@admin.com',
  crypt('123123123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Admin","role":"admin","approved":true}'::jsonb,
  now(), now(), '', '',
  '', '', '',
  '', '', '', ''
);

INSERT INTO auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
VALUES (
  '00000000-0000-4000-a000-000000000001',
  '00000000-0000-4000-a000-000000000001',
  '00000000-0000-4000-a000-000000000001',
  jsonb_build_object('sub', '00000000-0000-4000-a000-000000000001', 'email', 'admin@admin.com'),
  'email', now(), now(), now()
);

-- ══════════════════════════════════════════════════════════════
-- 2. Demo project and workshop (linked to admin user)
-- ══════════════════════════════════════════════════════════════
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
