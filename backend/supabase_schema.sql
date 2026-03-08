-- ===========================================
-- re-medy Supabase Schema
-- Run this in the Supabase SQL editor
-- ===========================================

-- Users table (needed for FK references and demo data)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY
);

-- Medications table
CREATE TABLE IF NOT EXISTS medications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    active_ingredients JSONB NOT NULL DEFAULT '[]',
    dosage_text TEXT,
    instructions TEXT,
    start_date DATE,
    source TEXT CHECK (source IN ('text', 'photo', 'manual')),
    schedule JSONB NOT NULL DEFAULT '{}',
    needs_review BOOLEAN NOT NULL DEFAULT FALSE,
    confidence REAL NOT NULL DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medications_user_id ON medications(user_id);

-- Medication logs (taken/skipped)
-- NOTE: table is named med_logs to match backend code
CREATE TABLE IF NOT EXISTS med_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL,
    medication_id TEXT NOT NULL REFERENCES medications(id),
    date DATE NOT NULL,
    scheduled_time TEXT NOT NULL,
    taken BOOLEAN NOT NULL DEFAULT FALSE,
    taken_at TIMESTAMPTZ,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, medication_id, date, scheduled_time)
);

CREATE INDEX IF NOT EXISTS idx_med_logs_user_date ON med_logs(user_id, date);

-- Side effect logs
CREATE TABLE IF NOT EXISTS side_effect_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL,
    effect TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('mild', 'moderate', 'severe')),
    date DATE NOT NULL,
    notes TEXT,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_side_effect_logs_user_date ON side_effect_logs(user_id, date);

-- Interaction rules (fallback when Gemini is unavailable)
CREATE TABLE IF NOT EXISTS interaction_rules (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ingredient_a TEXT NOT NULL,
    ingredient_b TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('major', 'moderate', 'minor')),
    reason TEXT,
    auto_reschedulable BOOLEAN NOT NULL DEFAULT FALSE,
    separation_hours INTEGER,
    guidance TEXT
);

-- Side effect rules (grounds Gemini ADR analysis)
CREATE TABLE IF NOT EXISTS side_effect_rules (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ingredient TEXT NOT NULL,
    effect TEXT NOT NULL,
    likelihood TEXT CHECK (likelihood IN ('high', 'possible', 'unlikely')),
    notes TEXT
);

-- Schedule adjustment events (audit trail for schedule changes)
CREATE TABLE IF NOT EXISTS schedule_adjustment_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id TEXT NOT NULL,
    target_medication_id TEXT NOT NULL,
    old_schedule JSONB NOT NULL,
    suggested_schedule JSONB NOT NULL,
    applied BOOLEAN NOT NULL DEFAULT FALSE,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_at TIMESTAMPTZ
);
