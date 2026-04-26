import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '001_initial_schema.sql',
)
const joinRpcMigrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '002_join_workshop_rpc.sql',
)

const sql = readFileSync(migrationPath, 'utf8')
const joinRpcSql = readFileSync(joinRpcMigrationPath, 'utf8')
const compactSql = sql.replace(/\s+/g, ' ')
const compactJoinRpcSql = joinRpcSql.replace(/\s+/g, ' ')

const tables = [
  'projects',
  'workshops',
  'participants',
  'notes',
  'clusters',
  'votes',
  'ax_tasks',
  'prds',
  'process_steps',
  'process_edges',
  'process_lanes',
  'editing_locks',
  'design_artifacts',
  'ax_reports',
  'task_reactions',
]

const realtimeTables = [
  'workshops',
  'process_steps',
  'process_edges',
  'process_lanes',
  'editing_locks',
  'notes',
  'clusters',
  'votes',
  'task_reactions',
  'design_artifacts',
  'ax_reports',
]

describe('initial Supabase schema', () => {
  it('creates every documented table', () => {
    for (const table of tables) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE ${table} \\(`))
    }
  })

  it('defines the eight workshop stages as a PostgreSQL enum', () => {
    for (const stage of [
      'context',
      'gather',
      'cluster',
      'vote',
      'design',
      'generate',
      'report',
      'completed',
    ]) {
      expect(sql).toContain(`'${stage}'`)
    }

    expect(sql).toContain('CREATE TYPE workshop_stage AS ENUM')
    expect(sql).toContain("current_stage workshop_stage NOT NULL DEFAULT 'context'")
  })

  it('keeps settings defaults and SQL range checks aligned with the spec', () => {
    expect(compactSql).toContain('"anonymous": false')
    expect(compactSql).toContain('"votes_per_person": 3')
    expect(compactSql).toContain('"max_participants": 20')
    expect(compactSql).toContain('"results_visible": false')
    expect(compactSql).toContain('"vote_mode": "cluster"')
    expect(compactSql).toContain('"timer_minutes": null')
    expect(compactSql).toContain("settings->>'vote_mode' IN ('cluster', 'note')")
    expect(compactSql).toContain("(settings->>'votes_per_person')::int BETWEEN 1 AND 10")
    expect(compactSql).toContain("(settings->>'max_participants')::int BETWEEN 2 AND 20")
    expect(compactSql).toContain("(settings->>'timer_minutes')::int BETWEEN 1 AND 60")
  })

  it('enforces the project, invite code, and vote uniqueness constraints in SQL', () => {
    expect(sql).toContain('CREATE UNIQUE INDEX idx_workshops_invite_code ON workshops(invite_code)')
    expect(sql).toContain('CREATE UNIQUE INDEX idx_one_active_workshop_per_project')
    expect(compactSql).toContain("WHERE current_stage <> 'completed'")
    expect(sql).toContain('CREATE UNIQUE INDEX idx_votes_unique_cluster_target')
    expect(sql).toContain('CREATE UNIQUE INDEX idx_votes_unique_note_target')
    expect(compactSql).toContain(
      'CHECK ( (cluster_id IS NOT NULL AND note_id IS NULL) OR (cluster_id IS NULL AND note_id IS NOT NULL) )',
    )
  })

  it('keeps reaction constraints and stale-artifact defaults in the migration', () => {
    expect(sql).toContain('CREATE UNIQUE INDEX idx_task_reactions_unique_task')
    expect(sql).toContain('CREATE UNIQUE INDEX idx_task_reactions_unique_prd')
    expect(sql).toContain("reaction_type text NOT NULL CHECK (reaction_type IN ('👍', '⚠️'))")
    expect(compactSql).toContain('clusters ( id uuid PRIMARY KEY')
    expect(compactSql).toContain('is_stale boolean NOT NULL DEFAULT false')
  })

  it('enables RLS on every table and only creates read policies for client traffic', () => {
    for (const table of tables) {
      expect(sql).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`)
    }

    expect(sql).toContain('USING (auth.uid() = facilitator_id)')
    expect(sql).not.toMatch(/FOR\s+(INSERT|UPDATE|DELETE)/i)
  })

  it('adds realtime publication entries for collaboration tables', () => {
    for (const table of realtimeTables) {
      expect(sql).toContain(`ALTER PUBLICATION supabase_realtime ADD TABLE ${table}`)
    }
  })

  it('keeps notes positions as floating point values', () => {
    expect(sql).toContain('position_x double precision NOT NULL DEFAULT 0')
    expect(sql).toContain('position_y double precision NOT NULL DEFAULT 0')
  })

  it('adds an atomic server-only RPC for invite-code joins', () => {
    expect(joinRpcSql).toContain('CREATE OR REPLACE FUNCTION public.join_workshop_by_code')
    expect(compactJoinRpcSql).toContain('WHERE invite_code = upper(p_invite_code) FOR UPDATE')
    expect(compactJoinRpcSql).toContain('v_participant_count >= v_max_participants')
    expect(joinRpcSql).toContain('GRANT EXECUTE ON FUNCTION public.join_workshop_by_code')
  })
})
