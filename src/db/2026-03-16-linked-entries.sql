ALTER TYPE ledger_entry_type ADD VALUE IF NOT EXISTS 'purchase_credit';

ALTER TABLE ledger_entries
  ADD COLUMN IF NOT EXISTS linked_entry_id INTEGER REFERENCES ledger_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_linked_entry_id
  ON ledger_entries(linked_entry_id);
