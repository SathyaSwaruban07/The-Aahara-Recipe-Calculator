import { z } from "zod";
import { getPool, isDbAvailable } from "../db/pool.js";
import type { Recipe, Unit } from "../types.js";

const unitSchema = z.enum(["mg", "g", "kg", "ml", "l", "pieces"]);

const ingredientSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  amount: z.number().nonnegative(),
  unit: unitSchema,
  soak: z.boolean().optional(),
  soakDuration: z.number().nonnegative().optional(),
  soakUnit: z.enum(["minutes", "hours"]).optional(),
});

const localeFieldsSchema = z
  .object({
    name: z.string().optional(),
    category: z.string().optional(),
    notes: z.string().optional(),
    ingredients: z.record(z.string()).optional(),
  })
  .optional();

const recipeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().default(""),
  baseServings: z.number().positive(),
  ingredients: z.array(ingredientSchema).min(1),
  notes: z.string().optional(),
  translations: z
    .object({
      ta: localeFieldsSchema,
      hi: localeFieldsSchema,
    })
    .optional(),
});

async function requirePool() {
  const pool = getPool();
  if (!pool) {
    throw new Error("DATABASE_URL is not set. Add it in .env locally or as a host secret (never commit it).");
  }
  if (!(await isDbAvailable())) {
    throw new Error("Cannot reach Neon. Check DATABASE_URL and network.");
  }
  return pool;
}

async function listFromDb(): Promise<Recipe[]> {
  const pool = await requirePool();

  const recipesRes = await pool.query(
    `SELECT id, name, description, category, base_servings, notes
     FROM recipes ORDER BY id`
  );
  const ingredientsRes = await pool.query(
    `SELECT id, recipe_id, name, amount, unit, sort_order, soak, soak_duration, soak_unit
     FROM ingredients ORDER BY recipe_id, sort_order`
  );

  const byRecipe = new Map<string, Recipe["ingredients"]>();
  for (const row of ingredientsRes.rows) {
    const list = byRecipe.get(row.recipe_id) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      amount: Number(row.amount),
      unit: row.unit as Unit,
      soak: !!row.soak || undefined,
      soakDuration: row.soak_duration != null ? Number(row.soak_duration) : undefined,
      soakUnit: row.soak_unit === "hours" || row.soak_unit === "minutes" ? row.soak_unit : undefined,
    });
    byRecipe.set(row.recipe_id, list);
  }

  return recipesRes.rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category ?? "",
    baseServings: Number(row.base_servings),
    notes: row.notes ?? undefined,
    ingredients: byRecipe.get(row.id) ?? [],
  }));
}

export async function listRecipes(): Promise<{ recipes: Recipe[]; source: "db" }> {
  const recipes = await listFromDb();
  return { recipes, source: "db" };
}

async function getFromDb(id: string): Promise<Recipe | null> {
  const pool = await requirePool();
  const recipesRes = await pool.query(
    `SELECT id, name, description, category, base_servings, notes
     FROM recipes WHERE id = $1`,
    [id]
  );
  if (!recipesRes.rows[0]) return null;
  const row = recipesRes.rows[0];
  const ingredientsRes = await pool.query(
    `SELECT id, recipe_id, name, amount, unit, sort_order, soak, soak_duration, soak_unit
     FROM ingredients WHERE recipe_id = $1 ORDER BY sort_order`,
    [id]
  );
  return {
    id: row.id,
    name: row.name,
    category: row.category ?? "",
    baseServings: Number(row.base_servings),
    notes: row.notes ?? undefined,
    ingredients: ingredientsRes.rows.map((ing) => ({
      id: ing.id,
      name: ing.name,
      amount: Number(ing.amount),
      unit: ing.unit as Unit,
      soak: !!ing.soak || undefined,
      soakDuration: ing.soak_duration != null ? Number(ing.soak_duration) : undefined,
      soakUnit: ing.soak_unit === "hours" || ing.soak_unit === "minutes" ? ing.soak_unit : undefined,
    })),
  };
}

export async function getRecipe(id: string): Promise<Recipe | null> {
  return getFromDb(id);
}

export async function upsertRecipe(recipe: Recipe): Promise<Recipe> {
  const parsed = recipeSchema.parse(recipe);
  const pool = await requirePool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
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
      [parsed.id, parsed.name, "", parsed.category, parsed.baseServings, parsed.notes ?? null]
    );
    await client.query("DELETE FROM ingredients WHERE recipe_id = $1", [parsed.id]);
    for (let i = 0; i < parsed.ingredients.length; i++) {
      const ing = parsed.ingredients[i];
      await client.query(
        `INSERT INTO ingredients (id, recipe_id, name, amount, unit, sort_order, soak, soak_duration, soak_unit)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          ing.id,
          parsed.id,
          ing.name,
          ing.amount,
          ing.unit,
          i,
          !!ing.soak,
          ing.soak ? ing.soakDuration ?? null : null,
          ing.soak ? ing.soakUnit || "minutes" : null,
        ]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  return parsed;
}

export async function deleteRecipe(id: string): Promise<boolean> {
  const pool = await requirePool();
  const result = await pool.query("DELETE FROM recipes WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

export { recipeSchema };
