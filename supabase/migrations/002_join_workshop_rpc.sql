-- Atomic participant join helper.
-- Called from the server-only API with the service role key.

CREATE OR REPLACE FUNCTION public.join_workshop_by_code(
  p_invite_code text,
  p_display_name text,
  p_role text DEFAULT NULL
)
RETURNS TABLE (
  workshop_id uuid,
  participant_id uuid,
  workshop jsonb,
  participant jsonb,
  read_only boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workshop workshops%ROWTYPE;
  v_participant participants%ROWTYPE;
  v_participant_count integer;
  v_max_participants integer;
BEGIN
  SELECT *
  INTO v_workshop
  FROM workshops
  WHERE invite_code = upper(p_invite_code)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKSHOP_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  v_max_participants := COALESCE((v_workshop.settings->>'max_participants')::integer, 20);

  SELECT count(*)
  INTO v_participant_count
  FROM participants
  WHERE participants.workshop_id = v_workshop.id;

  IF v_participant_count >= v_max_participants THEN
    RAISE EXCEPTION 'PARTICIPANT_LIMIT' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO participants (
    workshop_id,
    display_name,
    role,
    is_facilitator
  )
  VALUES (
    v_workshop.id,
    p_display_name,
    NULLIF(p_role, ''),
    false
  )
  RETURNING * INTO v_participant;

  RETURN QUERY
  SELECT
    v_workshop.id,
    v_participant.id,
    to_jsonb(v_workshop),
    to_jsonb(v_participant),
    v_workshop.current_stage = 'completed';
END;
$$;

REVOKE ALL ON FUNCTION public.join_workshop_by_code(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_workshop_by_code(text, text, text) TO service_role;
