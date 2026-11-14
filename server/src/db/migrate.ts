import { getPool } from "./pool.js";

const SQL = `
CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  base_servings NUMERIC NOT NULL CHECK (base_servings > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ingredients (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  unit TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  soak BOOLEAN NOT NULL DEFAULT FALSE,
  soak_duration NUMERIC,
  soak_unit TEXT CHECK (soak_unit IS NULL OR soak_unit IN ('minutes','hours')),
  prep_recipe_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_ingredients_recipe ON ingredients(recipe_id);

ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS soak BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS soak_duration NUMERIC;
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS soak_unit TEXT;
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS prep_recipe_id TEXT;

-- Allow portions unit (prep recipe links)
DO $$ BEGIN
  ALTER TABLE ingredients DROP CONSTRAINT IF EXISTS ingredients_unit_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ingredients
    ADD CONSTRAINT ingredients_unit_check
    CHECK (unit IN ('mg','g','kg','ml','l','pieces','portions'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Upgrade path from v1 key-based columns (safe if columns already renamed/absent)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recipes' AND column_name = 'name_key'
  ) THEN
    ALTER TABLE recipes RENAME COLUMN name_key TO name;
    ALTER TABLE recipes RENAME COLUMN description_key TO description;
    ALTER TABLE recipes RENAME COLUMN category_key TO category;
    ALTER TABLE recipes RENAME COLUMN notes_key TO notes;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ingredients' AND column_name = 'name_key'
  ) THEN
    ALTER TABLE ingredients RENAME COLUMN name_key TO name;
  END IF;
END $$;
`;

async function main() {
  const pool = getPool();
  if (!pool) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env and add your Neon connection string.");
    process.exit(1);
  }

  await pool.query(SQL);
  console.log("Migration complete.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
