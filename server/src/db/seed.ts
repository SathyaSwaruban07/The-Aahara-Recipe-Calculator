import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "./pool.js";
import type { RecipesFile } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const recipesPath = path.resolve(__dirname, "../../../data/recipes.json");

async function main() {
  const pool = getPool();
  if (!pool) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const file = JSON.parse(fs.readFileSync(recipesPath, "utf8")) as RecipesFile;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const recipe of file.recipes) {
      await client.query(
        `INSERT INTO recipes (id, name, description, category, base_servings, notes)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           category = EXCLUDED.category,
           base_servings = EXCLUDED.base_servings,
           notes = EXCLUDED.notes,
           updated_at = NOW()`,
        [
          recipe.id,
          recipe.name,
          "",
          recipe.category,
          recipe.baseServings,
          recipe.notes ?? null,
        ]
      );

      await client.query("DELETE FROM ingredients WHERE recipe_id = $1", [recipe.id]);

      for (let i = 0; i < recipe.ingredients.length; i++) {
        const ing = recipe.ingredients[i];
        await client.query(
          `INSERT INTO ingredients (id, recipe_id, name, amount, unit, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [ing.id, recipe.id, ing.name, ing.amount, ing.unit, i]
        );
      }
    }
    await client.query("COMMIT");
    console.log(`Seeded ${file.recipes.length} recipes from data/recipes.json`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
