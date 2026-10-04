-- Booth Management System — PostgreSQL schema
-- Run via: npm run migrate  (backend/src/migrate.js executes this file)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Wards / constituencies. Every MLA user is scoped to exactly one ward,
-- which is how ward-specific data isolation is enforced at the API layer.
CREATE TABLE IF NOT EXISTS wards (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MLA / staff accounts. Phone number is the OTP login identifier.
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(15) NOT NULL UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'mla' CHECK (role IN ('mla', 'admin')),
  ward_id INTEGER REFERENCES wards(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- OTP codes. Codes are stored hashed (bcrypt) — never in plaintext —
-- so a DB read alone can't be used to log in.
CREATE TABLE IF NOT EXISTS otp_codes (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(15) NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone);

-- Booths belong to a ward.
CREATE TABLE IF NOT EXISTS booths (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  ward_id INTEGER NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  address VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scheme categories + sub-schemes (govt welfare schemes voters are enrolled in)
CREATE TABLE IF NOT EXISTS schemes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(100) NOT NULL,
  ward_id INTEGER REFERENCES wards(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Voters. ward_id drives per-MLA data isolation: every voter query from
-- the API is filtered WHERE ward_id = <requesting user's ward_id>.
--
-- `voter_card_id` is the CANDIDATE KEY: the one field guaranteed unique per
-- person (like an EPIC/voter-ID-card number). Everything else — especially
-- `phone` — is deliberately NOT treated as an identifier, because in
-- practice one phone number is shared across an entire family. To still
-- let staff land on "that particular guy" inside a shared-phone household,
-- every voter also carries `relation_name` (e.g. "S/O Ram Singh") and a
-- `family_id` that groups household members together (auto-derived from
-- phone number on import/create when not given explicitly).
CREATE TABLE IF NOT EXISTS voters (
  id SERIAL PRIMARY KEY,
  voter_card_id VARCHAR(30) NOT NULL,
  name VARCHAR(150) NOT NULL,
  relation_name VARCHAR(150),
  age INTEGER NOT NULL CHECK (age >= 18),
  gender VARCHAR(10) NOT NULL DEFAULT 'Male',
  phone VARCHAR(15),
  address VARCHAR(255),
  religion VARCHAR(60),
  caste VARCHAR(80),
  sub_caste VARCHAR(80),
  family_id VARCHAR(60),
  ward_id INTEGER NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  booth_id INTEGER REFERENCES booths(id) ON DELETE SET NULL,
  scheme_id INTEGER REFERENCES schemes(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- duplicate detection: same voter card ID cannot repeat within a ward
  UNIQUE (ward_id, voter_card_id)
);

-- Additive migrations for databases created before this schema revision.
-- Safe to re-run: every statement is a no-op once already applied.
ALTER TABLE voters ADD COLUMN IF NOT EXISTS relation_name VARCHAR(150);
ALTER TABLE voters ADD COLUMN IF NOT EXISTS religion VARCHAR(60);
ALTER TABLE voters ADD COLUMN IF NOT EXISTS caste VARCHAR(80);
ALTER TABLE voters ADD COLUMN IF NOT EXISTS sub_caste VARCHAR(80);
ALTER TABLE voters ADD COLUMN IF NOT EXISTS family_id VARCHAR(60);
-- This app tracks voter/scheme/demographic data for pre-poll analysis,
-- not booth-day turnout — so the old has_voted column is retired.
ALTER TABLE voters DROP COLUMN IF EXISTS has_voted;

-- Voter <-> Scheme enrollment, created here (after both voters and schemes
-- exist) because the foreign keys below need both tables in place first. A
-- voter can be enrolled in many schemes at once (e.g. PM-KISAN + Ayushman
-- Bharat + Ujjwala Yojana for the same person), so this is a plain
-- many-to-many join table rather than a single scheme_id column. The old
-- voters.scheme_id column above is kept only for backward compatibility
-- with older data and is migrated into this table below.
CREATE TABLE IF NOT EXISTS voter_schemes (
  voter_id INTEGER NOT NULL REFERENCES voters(id) ON DELETE CASCADE,
  scheme_id INTEGER NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (voter_id, scheme_id)
);
CREATE INDEX IF NOT EXISTS idx_voter_schemes_scheme ON voter_schemes(scheme_id);
CREATE INDEX IF NOT EXISTS idx_voter_schemes_voter ON voter_schemes(voter_id);

-- One-time backfill: carry any legacy single-scheme assignment into the new
-- many-to-many voter_schemes table. Safe to re-run (ON CONFLICT DO NOTHING).
INSERT INTO voter_schemes (voter_id, scheme_id)
SELECT id, scheme_id FROM voters WHERE scheme_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_voters_ward ON voters(ward_id);
CREATE INDEX IF NOT EXISTS idx_voters_booth ON voters(booth_id);
CREATE INDEX IF NOT EXISTS idx_voters_family ON voters(family_id);
CREATE INDEX IF NOT EXISTS idx_voters_caste ON voters(caste);
CREATE INDEX IF NOT EXISTS idx_voters_religion ON voters(religion);
CREATE INDEX IF NOT EXISTS idx_voters_name ON voters USING gin (to_tsvector('simple', name));

-- Simple audit trail — useful for showing "real-time sync" / activity feed
CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  entity VARCHAR(50) NOT NULL,
  entity_id INTEGER,
  ward_id INTEGER,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_voters_updated_at ON voters;
CREATE TRIGGER trg_voters_updated_at
  BEFORE UPDATE ON voters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Voter outreach tracking (pre-poll field contact status)
-- ---------------------------------------------------------------------------
-- Lets field staff record whether a voter has been reached, what the
-- outcome was, and any freeform note — without needing a separate call log.
-- last_contacted_at is set automatically by the API whenever contact_status
-- moves away from 'Not Contacted' (see PUT /api/voters/:id).
ALTER TABLE voters ADD COLUMN IF NOT EXISTS contact_status VARCHAR(20) NOT NULL DEFAULT 'Not Contacted';
ALTER TABLE voters ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;
ALTER TABLE voters ADD COLUMN IF NOT EXISTS notes TEXT;

-- Constrain to a known set of statuses. Dropped and recreated so this file
-- stays safe to re-run if the allowed list ever changes.
ALTER TABLE voters DROP CONSTRAINT IF EXISTS voters_contact_status_check;
ALTER TABLE voters ADD CONSTRAINT voters_contact_status_check
  CHECK (contact_status IN ('Not Contacted', 'Contacted', 'Promised Support', 'Needs Follow-up', 'Not Interested'));

CREATE INDEX IF NOT EXISTS idx_voters_contact_status ON voters(contact_status);
