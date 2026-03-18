ALTER TABLE casinos
  ADD COLUMN IF NOT EXISTS normalized_name VARCHAR(200);

UPDATE casinos
SET normalized_name = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      COALESCE(name, ''),
      '(\\.com|\\.net|casino|sweeps|sweepstakes)',
      '',
      'gi'
    ),
    '\\s+|[^a-z0-9]',
    '',
    'gi'
  )
)
WHERE normalized_name IS NULL;

CREATE INDEX IF NOT EXISTS idx_casinos_normalized_name
  ON casinos(normalized_name);
