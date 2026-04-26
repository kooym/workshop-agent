-- Yjs document snapshots used by y-supabase for tldraw collaboration.

CREATE TABLE yjs_documents (
  id uuid PRIMARY KEY REFERENCES workshops(id) ON DELETE CASCADE,
  document integer[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_yjs_documents_updated_at
  BEFORE UPDATE ON yjs_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE yjs_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "realtime read yjs documents"
  ON yjs_documents FOR SELECT
  USING (TRUE);

CREATE POLICY "participants can initialize yjs documents"
  ON yjs_documents FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "participants can update yjs documents"
  ON yjs_documents FOR UPDATE
  USING (TRUE)
  WITH CHECK (TRUE);

ALTER PUBLICATION supabase_realtime ADD TABLE yjs_documents;
