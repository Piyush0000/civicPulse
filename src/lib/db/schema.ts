// Idempotent schema, applied on every boot. Plain Postgres (no PostGIS / pgvector needed) so it
// runs identically on PGlite and on Supabase. Geography lives on the H3 grid.

export const SCHEMA_SQL = /* sql */ `
CREATE TABLE IF NOT EXISTS app_state (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS regions (
  code text PRIMARY KEY,
  name text NOT NULL,
  country text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','analyst','policymaker')),
  region_codes text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reporters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_code text NOT NULL,
  pseudonym_hash text UNIQUE NOT NULL,
  preferred_language text,
  consent_given_at timestamptz,
  opted_out_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reporter_contacts (
  reporter_id uuid PRIMARY KEY REFERENCES reporters(id) ON DELETE CASCADE,
  channel text NOT NULL,
  external_id_encrypted text NOT NULL,
  pending_state jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS raw_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_code text NOT NULL,
  reporter_id uuid,
  channel text NOT NULL,
  external_message_id text NOT NULL,
  content_type text NOT NULL,
  text_original text,
  transcript_hint text,
  audio_path text,
  audio_mime text,
  lat double precision,
  lng double precision,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel, external_message_id)
);

CREATE TABLE IF NOT EXISTS requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_code text NOT NULL,
  raw_message_id uuid UNIQUE,
  reporter_id uuid,
  tracking_code text UNIQUE NOT NULL,
  channel text NOT NULL,
  language_detected text,
  text_original_redacted text,
  text_english_redacted text,
  category text,
  subcategory text,
  urgency text,
  urgency_reason text,
  summary text,
  affected_group text,
  estimated_people_affected int,
  location_text text,
  location_precision text NOT NULL DEFAULT 'unknown',
  admin_name text,
  lat double precision,
  lng double precision,
  h3_cell text,
  embedding real[],
  cluster_id uuid,
  is_actionable boolean,
  is_spam boolean,
  pipeline_status text NOT NULL DEFAULT 'received',
  pipeline_error text,
  pipeline_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  extraction_confidence double precision,
  extraction_provider text,
  status text NOT NULL DEFAULT 'new',
  analyst_overrides jsonb,
  is_synthetic boolean NOT NULL DEFAULT false,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
ALTER TABLE requests ADD COLUMN IF NOT EXISTS input_mode text NOT NULL DEFAULT 'text';
CREATE INDEX IF NOT EXISTS requests_region_time ON requests (region_code, submitted_at);
CREATE INDEX IF NOT EXISTS requests_region_cell ON requests (region_code, h3_cell);
CREATE INDEX IF NOT EXISTS requests_region_cat ON requests (region_code, category);
CREATE INDEX IF NOT EXISTS requests_cluster ON requests (cluster_id);

CREATE TABLE IF NOT EXISTS clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_code text NOT NULL,
  category text NOT NULL,
  centroid real[] NOT NULL,
  representative_request_id uuid,
  label text,
  request_count int NOT NULL DEFAULT 0,
  unique_reporter_count int NOT NULL DEFAULT 0,
  h3_cells text[] NOT NULL DEFAULT '{}',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clusters_region_cat ON clusters (region_code, category);

CREATE TABLE IF NOT EXISTS h3_cells (
  region_code text NOT NULL,
  h3_cell text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  population double precision NOT NULL DEFAULT 0,
  admin_name text,
  vulnerability_index double precision NOT NULL DEFAULT 0.5,
  connectivity_index double precision NOT NULL DEFAULT 0.5,
  PRIMARY KEY (region_code, h3_cell)
);

CREATE TABLE IF NOT EXISTS cell_indicators (
  region_code text NOT NULL,
  h3_cell text NOT NULL,
  category text NOT NULL,
  key text NOT NULL,
  value double precision NOT NULL,
  gap double precision NOT NULL,
  source text NOT NULL,
  is_proxy boolean NOT NULL DEFAULT false,
  as_of date NOT NULL,
  PRIMARY KEY (region_code, h3_cell, category, key)
);

CREATE TABLE IF NOT EXISTS facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_code text NOT NULL,
  category text NOT NULL,
  type text NOT NULL,
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  h3_cell text NOT NULL,
  source text NOT NULL
);
CREATE INDEX IF NOT EXISTS facilities_region ON facilities (region_code, category);

CREATE TABLE IF NOT EXISTS planned_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_code text NOT NULL,
  external_ref text NOT NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL,
  status text NOT NULL,
  budget_amount double precision NOT NULL,
  currency text NOT NULL,
  start_date date,
  end_date date,
  completed_date date,
  admin_name text,
  h3_cells text[] NOT NULL DEFAULT '{}',
  source_document_id uuid,
  UNIQUE (region_code, external_ref)
);

CREATE TABLE IF NOT EXISTS cell_scores (
  region_code text NOT NULL,
  h3_cell text NOT NULL,
  category text NOT NULL,
  computed_at timestamptz NOT NULL,
  demand_raw double precision NOT NULL,
  demand_adj double precision NOT NULL,
  d_norm double precision NOT NULL,
  g_norm double precision NOT NULL,
  p_norm double precision NOT NULL,
  v_norm double precision NOT NULL,
  f_coverage double precision NOT NULL,
  priority_score double precision NOT NULL,
  gi_z double precision,
  gi_p double precision,
  is_hotspot boolean NOT NULL DEFAULT false,
  request_count_90d int NOT NULL DEFAULT 0,
  unique_reporters_90d int NOT NULL DEFAULT 0,
  no_signal boolean NOT NULL DEFAULT true,
  trend_ratio double precision,
  is_emerging boolean NOT NULL DEFAULT false,
  PRIMARY KEY (region_code, h3_cell, category)
);
CREATE INDEX IF NOT EXISTS cell_scores_rc ON cell_scores (region_code, category);

CREATE TABLE IF NOT EXISTS recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_code text NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  h3_cells text[] NOT NULL,
  admin_names text[] NOT NULL DEFAULT '{}',
  center_lat double precision,
  center_lng double precision,
  priority_score double precision NOT NULL,
  rank int NOT NULL DEFAULT 0,
  people_affected_est int NOT NULL DEFAULT 0,
  request_count int NOT NULL DEFAULT 0,
  unique_reporters int NOT NULL DEFAULT 0,
  hotspot_cells int NOT NULL DEFAULT 0,
  gap_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  funded_overlap double precision NOT NULL DEFAULT 0,
  overlapping_projects jsonb NOT NULL DEFAULT '[]'::jsonb,
  quotes jsonb NOT NULL DEFAULT '[]'::jsonb,
  est_cost_usd double precision NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'proposed',
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  fingerprint text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recs_region ON recommendations (region_code, rank);

CREATE TABLE IF NOT EXISTS policy_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  version int NOT NULL,
  content_md text NOT NULL,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  model_name text NOT NULL,
  prompt_version text NOT NULL,
  validation_warning boolean NOT NULL DEFAULT false,
  unverified_numbers text[] NOT NULL DEFAULT '{}',
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recommendation_id, version)
);

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_code text NOT NULL,
  title text NOT NULL,
  doc_type text NOT NULL,
  source_url text,
  published_date date,
  language text NOT NULL DEFAULT 'en',
  content text NOT NULL,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS doc_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  region_code text NOT NULL,
  chunk_index int NOT NULL,
  text text NOT NULL,
  embedding real[] NOT NULL,
  page int NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS doc_chunks_region ON doc_chunks (region_code);

CREATE TABLE IF NOT EXISTS audit_log (
  seq bigserial PRIMARY KEY,
  user_id uuid,
  user_email text,
  region_code text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  diff jsonb NOT NULL DEFAULT '{}'::jsonb,
  at timestamptz NOT NULL DEFAULT now(),
  prev_hash text NOT NULL,
  hash text NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  region_code text NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL,
  PRIMARY KEY (region_code, key)
);

CREATE TABLE IF NOT EXISTS geocode_cache (
  query text PRIMARY KEY,
  lat double precision,
  lng double precision,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- v2: citizen + government portals, photos, execution lifecycle, citizen verification, fund allocations
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','analyst','policymaker','cm','citizen'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS designation text;
ALTER TABLE raw_messages ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS recommendation_id uuid;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS work_stage text NOT NULL DEFAULT 'none';
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS endorsed_by text;
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS endorsed_at timestamptz;
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS work_started_at timestamptz;
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS work_done_at timestamptz;
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS work_note text;
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS contractor text;
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS scheme text;
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS sanctioned_inr double precision;
ALTER TABLE planned_projects ADD COLUMN IF NOT EXISTS scheme text;

CREATE TABLE IF NOT EXISTS citizen_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  request_id uuid UNIQUE,
  region_code text NOT NULL,
  solved text NOT NULL CHECK (solved IN ('yes','partly','no')),
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feedback_rec ON citizen_feedback (recommendation_id);

CREATE TABLE IF NOT EXISTS fund_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_code text NOT NULL,
  scheme text NOT NULL,
  category text,
  project_ref text NOT NULL,
  project_title text,
  fy text NOT NULL,
  sanctioned double precision NOT NULL DEFAULT 0,
  released double precision NOT NULL DEFAULT 0,
  utilised double precision NOT NULL DEFAULT 0,
  source text NOT NULL,
  as_of date NOT NULL,
  UNIQUE (region_code, scheme, project_ref, fy)
);

CREATE TABLE IF NOT EXISTS scheme_envelopes (
  region_code text NOT NULL,
  scheme text NOT NULL,
  fy text NOT NULL,
  envelope double precision NOT NULL,
  source text NOT NULL,
  PRIMARY KEY (region_code, scheme, fy)
);

CREATE TABLE IF NOT EXISTS job_runs (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  region_code text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  detail jsonb NOT NULL DEFAULT '{}'::jsonb
);
`;
