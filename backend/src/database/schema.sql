-- ============================================================================
--  CLRMS — Computer Laboratory Room Management System
--  PostgreSQL Schema (Normalized to 3NF, UUID PKs, Soft Delete, Enums, Audit)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";            -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";              -- case-insensitive email

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_status        AS ENUM ('pending','active','suspended','locked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE booking_status     AS ENUM ('pending','approved','rejected','cancelled','completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attendance_status  AS ENUM ('present','absent','late','excused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lab_status         AS ENUM ('active','maintenance','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE computer_status    AS ENUM ('active','maintenance','broken','retired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE equipment_type AS ENUM ('printer','projector','ups','router','switch','scanner','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE equipment_status   AS ENUM ('active','in_repair','retired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE maintenance_status AS ENUM ('open','in_progress','resolved','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE incident_type      AS ENUM ('hardware','network','software','security','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE priority           AS ENUM ('low','medium','high','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE visitor_status     AS ENUM ('pending','checked_in','checked_out','denied');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_type  AS ENUM ('info','success','warning','error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_target      AS ENUM ('computer','equipment','lab','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE audit_category     AS ENUM ('auth','user','booking','maintenance','administrative','laboratory','computer','equipment','attendance','visitor','incident','report','setting');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE semester_season    AS ENUM ('spring','summer','fall','winter');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE session_kind       AS ENUM ('class','lab','exam','workshop','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE day_of_week        AS ENUM ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- ROLES (RBAC)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          citext UNIQUE NOT NULL,
  code          citext UNIQUE NOT NULL CHECK (code IN ('super_admin','lab_manager','technician','lecturer','student')),
  description   text,
  permissions   jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- DEPARTMENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          citext NOT NULL UNIQUE,
  code          citext NOT NULL UNIQUE,
  description   text,
  manager_id    uuid,
  color         varchar(7) DEFAULT '#6366f1',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

-- ----------------------------------------------------------------------------
-- USERS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id           uuid NOT NULL REFERENCES roles(id),
  email             citext NOT NULL UNIQUE,
  password_hash     text NOT NULL,
  first_name        varchar(120) NOT NULL,
  last_name         varchar(120) NOT NULL,
  phone             varchar(30),
  student_id        varchar(40),
  department_id     uuid REFERENCES departments(id) ON DELETE SET NULL,
  status            user_status NOT NULL DEFAULT 'pending',
  avatar_url        text,
  email_verified_at timestamptz,
  failed_attempts   int  NOT NULL DEFAULT 0,
  locked_until      timestamptz,
  last_login_at     timestamptz,
  last_login_ip     inet,
  is_mfa_enabled    boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

ALTER TABLE departments
  ADD CONSTRAINT fk_departments_manager FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- AUTH / SESSION TABLES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    text NOT NULL UNIQUE,
  family        uuid NOT NULL DEFAULT gen_random_uuid(),
  user_agent    text,
  ip_address    inet,
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz,
  replaced_by   uuid REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          varchar(30) NOT NULL CHECK (kind IN ('email_verification','password_reset')),
  token_hash    text NOT NULL UNIQUE,
  expires_at    timestamptz NOT NULL,
  used_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_activity_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action        varchar(120) NOT NULL,
  ip_address    inet,
  user_agent    text,
  metadata      jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- AUDIT LOGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_email   citext,
  category      audit_category NOT NULL,
  action        varchar(120) NOT NULL,
  entity_type   varchar(80),
  entity_id     uuid,
  before_data   jsonb,
  after_data    jsonb,
  ip_address    inet,
  metadata      jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- LABORATORIES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS laboratories (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          citext NOT NULL UNIQUE,
  code          citext NOT NULL UNIQUE,
  location      varchar(200),
  capacity      int NOT NULL DEFAULT 0 CHECK (capacity >= 0),
  status        lab_status NOT NULL DEFAULT 'active',
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  lab_manager_id uuid REFERENCES users(id) ON DELETE SET NULL,
  opens_at      time,
  closes_at     time,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

-- ----------------------------------------------------------------------------
-- COMPUTERS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS computers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  computer_number    varchar(40) NOT NULL UNIQUE,
  serial_number      varchar(120) UNIQUE,
  brand              varchar(80),
  model              varchar(80),
  processor          varchar(120),
  ram_gb             int,
  storage_gb         int,
  storage_type       varchar(30) DEFAULT 'HDD' CHECK (storage_type IN ('HDD','SSD','NVMe')),
  os                 varchar(80) DEFAULT 'Windows 11',
  status             computer_status NOT NULL DEFAULT 'active',
  laboratory_id      uuid REFERENCES laboratories(id) ON DELETE SET NULL,
  health_score       int DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
  public_ip          inet,
  mac_address        varchar(17),
  purchase_date      date,
  warranty_until     date,
  last_maintenance_at timestamptz,
  last_audit_at      timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);

-- ----------------------------------------------------------------------------
-- EQUIPMENT
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipment (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_type equipment_type NOT NULL,
  name           varchar(160) NOT NULL,
  brand          varchar(80),
  model          varchar(80),
  serial_number  varchar(120) UNIQUE,
  status         equipment_status NOT NULL DEFAULT 'active',
  laboratory_id  uuid REFERENCES laboratories(id) ON DELETE SET NULL,
  assigned_to    uuid REFERENCES users(id) ON DELETE SET NULL,
  purchase_date  date,
  warranty_until date,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);

CREATE TABLE IF NOT EXISTS equipment_transfers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id  uuid NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  from_lab_id   uuid REFERENCES laboratories(id) ON DELETE SET NULL,
  to_lab_id     uuid REFERENCES laboratories(id) ON DELETE SET NULL,
  transferred_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reason        text,
  transferred_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- BOOKINGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  laboratory_id uuid NOT NULL REFERENCES laboratories(id),
  requester_id  uuid NOT NULL REFERENCES users(id),
  title         varchar(200) NOT NULL,
  purpose       text,
  session_kind  session_kind NOT NULL DEFAULT 'class',
  date          date NOT NULL,
  start_time    time NOT NULL,
  end_time      time NOT NULL,
  attendee_count int DEFAULT 0,
  status        booking_status NOT NULL DEFAULT 'pending',
  approved_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  approval_note text,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  CHECK (start_time < end_time)
);

-- ----------------------------------------------------------------------------
-- TIMETABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS semesters (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         varchar(120) NOT NULL UNIQUE,
  season       semester_season NOT NULL,
  year         int NOT NULL,
  start_date   date NOT NULL,
  end_date     date NOT NULL,
  is_active    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (start_date < end_date)
);

CREATE TABLE IF NOT EXISTS timetable_slots (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id    uuid NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  laboratory_id  uuid NOT NULL REFERENCES laboratories(id),
  lecturer_id    uuid NOT NULL REFERENCES users(id),
  course_code    varchar(40) NOT NULL,
  course_name    varchar(160) NOT NULL,
  day            day_of_week NOT NULL,
  start_time     time NOT NULL,
  end_time       time NOT NULL,
  session_kind   session_kind NOT NULL DEFAULT 'class',
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz,
  CHECK (start_time < end_time)
);

-- ----------------------------------------------------------------------------
-- ATTENDANCE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     uuid REFERENCES bookings(id) ON DELETE CASCADE,
  laboratory_id  uuid NOT NULL REFERENCES laboratories(id),
  lecturer_id    uuid NOT NULL REFERENCES users(id),
  topic          varchar(200) NOT NULL,
  session_date   date NOT NULL DEFAULT CURRENT_DATE,
  qr_code        text,
  qr_expires_at  timestamptz,
  starts_at      time,
  ends_at        time,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_session_id uuid NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES users(id),
  status           attendance_status NOT NULL DEFAULT 'absent',
  check_in_time    timestamptz,
  method           varchar(20) NOT NULL DEFAULT 'manual' CHECK (method IN ('manual','qr','face','batch')),
  verified_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attendance_session_id, user_id)
);

-- ----------------------------------------------------------------------------
-- MAINTENANCE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS maintenance_tickets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_no      varchar(40) NOT NULL UNIQUE,
  title          varchar(200) NOT NULL,
  description    text NOT NULL,
  target_type    ticket_target NOT NULL DEFAULT 'computer',
  computer_id    uuid REFERENCES computers(id) ON DELETE SET NULL,
  equipment_id   uuid REFERENCES equipment(id) ON DELETE SET NULL,
  laboratory_id  uuid REFERENCES laboratories(id) ON DELETE SET NULL,
  reported_by    uuid NOT NULL REFERENCES users(id),
  assigned_to    uuid REFERENCES users(id) ON DELETE SET NULL,
  priority       priority NOT NULL DEFAULT 'medium',
  cost           numeric(12,2) DEFAULT 0,
  cost_approved  boolean NOT NULL DEFAULT false,
  status         maintenance_status NOT NULL DEFAULT 'open',
  started_at     timestamptz,
  resolved_at    timestamptz,
  closed_at      timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);

CREATE TABLE IF NOT EXISTS maintenance_updates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     uuid NOT NULL REFERENCES maintenance_tickets(id) ON DELETE CASCADE,
  author_id     uuid NOT NULL REFERENCES users(id),
  note          text NOT NULL,
  status_from   maintenance_status,
  status_to     maintenance_status,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_parts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  uuid NOT NULL REFERENCES maintenance_tickets(id) ON DELETE CASCADE,
  part_name  varchar(160) NOT NULL,
  quantity   int NOT NULL DEFAULT 1,
  unit_cost  numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- INCIDENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS incidents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_no   varchar(40) NOT NULL UNIQUE,
  type          incident_type NOT NULL,
  title         varchar(200) NOT NULL,
  description   text NOT NULL,
  priority      priority NOT NULL DEFAULT 'medium',
  status        varchar(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open','assigned','in_progress','resolved','closed')),
  laboratory_id uuid REFERENCES laboratories(id) ON DELETE SET NULL,
  computer_id   uuid REFERENCES computers(id) ON DELETE SET NULL,
  reported_by   uuid NOT NULL REFERENCES users(id),
  assigned_to   uuid REFERENCES users(id) ON DELETE SET NULL,
  resolution    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

-- ----------------------------------------------------------------------------
-- VISITORS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS visitors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     varchar(160) NOT NULL,
  email         citext,
  phone         varchar(30),
  id_number     varchar(60),
  organization  varchar(160),
  purpose       text NOT NULL,
  host_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  laboratory_id uuid REFERENCES laboratories(id) ON DELETE SET NULL,
  status        visitor_status NOT NULL DEFAULT 'pending',
  check_in_at   timestamptz,
  check_out_at  timestamptz,
  badge_number  varchar(40),
  registered_by uuid REFERENCES users(id) ON DELETE SET NULL,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       notification_type NOT NULL DEFAULT 'info',
  title      varchar(200) NOT NULL,
  message    text,
  link       text,
  read_at    timestamptz,
  data       jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- SYSTEM SETTINGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
  key        citext PRIMARY KEY,
  value      jsonb NOT NULL,
  description text,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- UPDATED_AT TRIGGER (shared function + per-table triggers)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'roles','departments','users','laboratories','computers','equipment',
    'bookings','timetable_slots','attendance_sessions','attendance_records',
    'maintenance_tickets','incidents','visitors','semesters'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated ON %1$s;', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated BEFORE UPDATE ON %1$s FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_email         ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role          ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_department    ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_status        ON users(status);

CREATE INDEX IF NOT EXISTS idx_rt_user             ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_rt_expires          ON refresh_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_audit_actor         ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_category      ON audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_audit_created       ON audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_computers_lab       ON computers(laboratory_id);
CREATE INDEX IF NOT EXISTS idx_computers_status    ON computers(status);

CREATE INDEX IF NOT EXISTS idx_equipment_lab       ON equipment(laboratory_id);
CREATE INDEX IF NOT EXISTS idx_equipment_type      ON equipment(equipment_type);

CREATE INDEX IF NOT EXISTS idx_bookings_lab_date   ON bookings(laboratory_id, date);
CREATE INDEX IF NOT EXISTS idx_bookings_status     ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_requester  ON bookings(requester_id);

CREATE INDEX IF NOT EXISTS idx_slots_lab_day       ON timetable_slots(laboratory_id, day);
CREATE INDEX IF NOT EXISTS idx_slots_semester      ON timetable_slots(semester_id);
CREATE INDEX IF NOT EXISTS idx_slots_lecturer      ON timetable_slots(lecturer_id);

CREATE INDEX IF NOT EXISTS idx_att_sess_lab        ON attendance_sessions(laboratory_id);
CREATE INDEX IF NOT EXISTS idx_att_rec_session     ON attendance_records(attendance_session_id);
CREATE INDEX IF NOT EXISTS idx_att_rec_user        ON attendance_records(user_id);

CREATE INDEX IF NOT EXISTS idx_maint_status        ON maintenance_tickets(status);
CREATE INDEX IF NOT EXISTS idx_maint_assigned      ON maintenance_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_maint_priority      ON maintenance_tickets(priority);

CREATE INDEX IF NOT EXISTS idx_incidents_status    ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_lab       ON incidents(laboratory_id);

CREATE INDEX IF NOT EXISTS idx_visitors_status     ON visitors(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user  ON notifications(user_id, read_at);

-- Fast lookup for time-range conflicts (bookings/timetable)
CREATE INDEX IF NOT EXISTS idx_bookings_times      ON bookings(date, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_slots_times         ON timetable_slots(day, start_time, end_time);