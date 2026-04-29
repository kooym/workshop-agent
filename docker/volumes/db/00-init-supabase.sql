-- ══════════════════════════════════════════════════════════
-- Supabase roles, schemas, and JWT settings for self-hosted
-- Run BEFORE app migrations (00- prefix ensures ordering)
-- Based on: https://github.com/supabase/supabase/tree/master/docker/volumes/db
-- ══════════════════════════════════════════════════════════

\set pgpass `echo "$POSTGRES_PASSWORD"`
\set jwt_secret `echo "$JWT_SECRET"`
\set jwt_exp `echo "$JWT_EXP"`

-- ── 1. Roles ─────────────────────────────────────────────

-- supabase_admin: superuser-like admin
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin LOGIN CREATEROLE CREATEDB REPLICATION BYPASSRLS NOINHERIT;
  END IF;
END $$;
ALTER ROLE supabase_admin WITH PASSWORD :'pgpass';
GRANT ALL PRIVILEGES ON DATABASE postgres TO supabase_admin;

-- anon: anonymous / unauthenticated
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
END $$;

-- authenticated: logged-in users
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
END $$;

-- service_role: bypasses RLS
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END $$;

-- authenticator: login role used by PostgREST, can become anon/authenticated/service_role
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator LOGIN NOINHERIT;
  END IF;
END $$;
ALTER ROLE authenticator WITH PASSWORD :'pgpass';
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;
GRANT supabase_admin TO authenticator;

-- supabase_auth_admin: GoTrue auth service
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin LOGIN NOINHERIT CREATEROLE;
  END IF;
END $$;
ALTER ROLE supabase_auth_admin WITH PASSWORD :'pgpass';

-- supabase_storage_admin: storage service
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin LOGIN NOINHERIT;
  END IF;
END $$;
ALTER ROLE supabase_storage_admin WITH PASSWORD :'pgpass';

-- supabase_functions_admin: edge functions
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_functions_admin') THEN
    CREATE ROLE supabase_functions_admin LOGIN NOINHERIT CREATEROLE;
  END IF;
END $$;
ALTER ROLE supabase_functions_admin WITH PASSWORD :'pgpass';

-- supabase_replication_admin: replication
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_replication_admin') THEN
    CREATE ROLE supabase_replication_admin LOGIN REPLICATION;
  END IF;
END $$;
ALTER ROLE supabase_replication_admin WITH PASSWORD :'pgpass';

-- supabase_read_only_user: read-only access
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_read_only_user') THEN
    CREATE ROLE supabase_read_only_user NOLOGIN;
  END IF;
END $$;

-- pgbouncer: connection pooler
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pgbouncer') THEN
    CREATE ROLE pgbouncer LOGIN;
  END IF;
END $$;
ALTER ROLE pgbouncer WITH PASSWORD :'pgpass';

-- ── 2. Schemas ───────────────────────────────────────────

-- extensions schema (for pgcrypto, uuid-ossp, etc.)
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER SCHEMA extensions OWNER TO supabase_admin;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA extensions TO supabase_admin;

-- auth schema (for GoTrue)
CREATE SCHEMA IF NOT EXISTS auth;
ALTER SCHEMA auth OWNER TO supabase_auth_admin;
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;

-- _realtime schema
CREATE SCHEMA IF NOT EXISTS _realtime;
ALTER SCHEMA _realtime OWNER TO postgres;

-- storage schema
CREATE SCHEMA IF NOT EXISTS storage;
ALTER SCHEMA storage OWNER TO supabase_storage_admin;
GRANT USAGE ON SCHEMA storage TO postgres, anon, authenticated, service_role;

-- supabase_migrations schema (for tracking migration state)
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
ALTER SCHEMA supabase_migrations OWNER TO postgres;

CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  statements text[],
  name text
);
ALTER TABLE supabase_migrations.schema_migrations OWNER TO postgres;

-- graphql_public schema (for PostgREST schemas config)
CREATE SCHEMA IF NOT EXISTS graphql_public;

-- ── 3. Extensions (in extensions schema) ─────────────────

-- pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
-- uuid-ossp
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
-- pgjwt
CREATE EXTENSION IF NOT EXISTS pgjwt WITH SCHEMA extensions;

-- ── 4. JWT settings ──────────────────────────────────────

ALTER DATABASE postgres SET "app.settings.jwt_secret" TO :'jwt_secret';
ALTER DATABASE postgres SET "app.settings.jwt_exp" TO :'jwt_exp';

-- ── 5. Grants ────────────────────────────────────────────

-- Grant usage on extensions schema objects
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA extensions TO supabase_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA extensions TO supabase_admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA extensions TO supabase_admin;

-- Allow all roles to use extensions
ALTER DEFAULT PRIVILEGES IN SCHEMA extensions GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA extensions GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA extensions GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

-- Public schema grants
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO supabase_admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

-- supabase_admin gets admin grant on auth and storage
GRANT supabase_auth_admin TO supabase_admin;
GRANT supabase_storage_admin TO supabase_admin;
GRANT supabase_functions_admin TO supabase_admin;

-- auth admin search path
ALTER ROLE supabase_auth_admin SET search_path = 'auth';

-- Set search_path for public usage
ALTER ROLE postgres SET search_path = 'public', 'extensions';
ALTER ROLE anon SET search_path = 'public', 'extensions';
ALTER ROLE authenticated SET search_path = 'public', 'extensions';
ALTER ROLE service_role SET search_path = 'public', 'extensions';
