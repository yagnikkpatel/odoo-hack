-- Phase 2 (tables only; the API is Phase 4) · BR-SAL-1, BR-SAL-2, BR-SAL-4
-- Created here because contracts.salary_structure_id is NOT NULL and migrations run in
-- filename order — 009 must precede 010.

CREATE TABLE IF NOT EXISTS salary_structures (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  code        TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z][A-Z0-9_]*$'),
  description TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS salary_rules (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  -- Codes are identifiers inside formulas, so the shape is enforced here too (BR-SAL-1).
  code                 TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z][A-Z0-9_]*$'),
  category             TEXT NOT NULL CHECK (category IN
                         ('basic','allowance','gross','deduction','contribution','net')),
  amount_type          TEXT NOT NULL CHECK (amount_type IN ('fixed','percentage','formula')),
  amount_fixed         NUMERIC(14,2),
  amount_percentage    NUMERIC(7,4),
  percentage_base_code TEXT,
  formula              TEXT,
  condition_type       TEXT NOT NULL DEFAULT 'always'
                         CHECK (condition_type IN ('always','range','expression')),
  condition_expression TEXT,
  condition_range_min  NUMERIC(14,2),
  condition_range_max  NUMERIC(14,2),
  appears_on_payslip   BOOLEAN NOT NULL DEFAULT TRUE,
  active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- BR-SAL-4: the amount fields must match amount_type, with the unused ones null.
  CONSTRAINT salary_rules_amount_shape CHECK (
    CASE amount_type
      WHEN 'fixed'      THEN amount_fixed IS NOT NULL
                             AND amount_percentage IS NULL AND formula IS NULL
      WHEN 'percentage' THEN amount_percentage IS NOT NULL AND percentage_base_code IS NOT NULL
                             AND amount_fixed IS NULL AND formula IS NULL
      WHEN 'formula'    THEN formula IS NOT NULL
                             AND amount_fixed IS NULL AND amount_percentage IS NULL
    END
  ),
  CONSTRAINT salary_rules_range_order CHECK (
    condition_range_min IS NULL OR condition_range_max IS NULL
      OR condition_range_max >= condition_range_min
  )
);

CREATE INDEX IF NOT EXISTS salary_rules_category_idx ON salary_rules (category);

-- A rule is reusable across structures, with its own order in each (BR-SAL-2).
CREATE TABLE IF NOT EXISTS salary_structure_rules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salary_structure_id UUID NOT NULL REFERENCES salary_structures (id) ON DELETE CASCADE,
  salary_rule_id      UUID NOT NULL REFERENCES salary_rules (id)      ON DELETE RESTRICT,
  sequence            INTEGER NOT NULL CHECK (sequence > 0),
  UNIQUE (salary_structure_id, salary_rule_id),
  UNIQUE (salary_structure_id, sequence)
);

CREATE INDEX IF NOT EXISTS salary_structure_rules_rule_idx
  ON salary_structure_rules (salary_rule_id);
