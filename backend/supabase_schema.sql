-- ===========================================
-- MedSafe Supabase Schema
-- Run this in the Supabase SQL editor
-- ===========================================

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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_medications_user_id ON medications(user_id);

-- Medication logs (taken/skipped)
CREATE TABLE IF NOT EXISTS medication_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    medication_id TEXT NOT NULL REFERENCES medications(id),
    date DATE NOT NULL,
    scheduled_time TEXT NOT NULL,
    taken BOOLEAN NOT NULL DEFAULT FALSE,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_medication_logs_user_date ON medication_logs(user_id, date);

-- Side effect logs
CREATE TABLE IF NOT EXISTS side_effect_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    effect TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('mild', 'moderate', 'severe')),
    date DATE NOT NULL,
    notes TEXT,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_side_effect_logs_user_date ON side_effect_logs(user_id, date);
