-- ===========================================
-- re-medy Seed Data
-- Run this in the Supabase SQL editor AFTER
-- running supabase_schema.sql
-- ===========================================

-- 1. Create the Demo User
INSERT INTO users (id) VALUES ('demo-user')
ON CONFLICT (id) DO NOTHING;

-- 2. Populate Interaction Rules
INSERT INTO interaction_rules (ingredient_a, ingredient_b, severity, reason, auto_reschedulable, separation_hours, guidance) VALUES
('ibuprofen', 'aspirin', 'major', 'Both may increase bleeding risk', false, null, 'Confirm with a pharmacist or doctor before taking together'),
('ibuprofen', 'naproxen', 'major', 'Both are NSAIDs — increased risk of GI bleeding', false, null, 'Do not take two NSAIDs together without medical advice'),
('warfarin', 'aspirin', 'major', 'Significantly increased bleeding risk', false, null, 'Only combine under strict medical supervision'),
('warfarin', 'ibuprofen', 'major', 'NSAIDs may increase anticoagulant effect and bleeding risk', false, null, 'Avoid combining without doctor approval'),
('levothyroxine', 'calcium carbonate', 'moderate', 'Calcium can reduce thyroid medication absorption', true, 4, 'Take levothyroxine at least 4 hours apart from calcium'),
('levothyroxine', 'iron', 'moderate', 'Iron can reduce levothyroxine absorption', true, 4, 'Take at least 4 hours apart'),
('ciprofloxacin', 'calcium carbonate', 'moderate', 'Calcium reduces ciprofloxacin absorption', true, 2, 'Take ciprofloxacin at least 2 hours before or 6 hours after calcium'),
('metformin', 'alcohol', 'major', 'Increased risk of lactic acidosis', false, null, 'Avoid alcohol while taking metformin'),
('lisinopril', 'potassium', 'moderate', 'ACE inhibitors can raise potassium levels', false, null, 'Monitor potassium levels regularly'),
('omeprazole', 'clopidogrel', 'major', 'Omeprazole may reduce the effectiveness of clopidogrel', false, null, 'Consider an alternative PPI — consult your doctor');

-- 3. Populate Side Effect Rules
INSERT INTO side_effect_rules (ingredient, effect, likelihood, notes) VALUES
('ibuprofen', 'stomach pain', 'high', 'Common NSAID side effect'),
('ibuprofen', 'nausea', 'high', 'Take with food to reduce'),
('ibuprofen', 'dizziness', 'possible', 'Less common but reported'),
('ibuprofen', 'headache', 'possible', 'Paradoxical headache possible'),
('acetaminophen', 'liver damage', 'high', 'Dose-dependent, risk increases with alcohol'),
('diphenhydramine', 'drowsiness', 'high', 'Primary known side effect'),
('lisinopril', 'dry cough', 'high', 'ACE inhibitor class effect'),
('metformin', 'diarrhea', 'high', 'Very common, usually improves'),
('amoxicillin', 'diarrhea', 'high', 'Common antibiotic side effect'),
('omeprazole', 'headache', 'possible', 'Common PPI side effect'),
('atorvastatin', 'muscle pain', 'high', 'Myalgia is a class effect of statins'),
('amlodipine', 'ankle swelling', 'high', 'Very common with calcium channel blockers'),
('sertraline', 'nausea', 'high', 'Common when starting, usually improves'),
('levothyroxine', 'palpitations', 'possible', 'May indicate dose too high'),
('prednisone', 'insomnia', 'high', 'Take in the morning'),
('warfarin', 'bleeding', 'high', 'Primary risk, monitor INR'),
('aspirin', 'stomach pain', 'high', 'GI irritation is common');
