import { z } from "zod";
import { getPool, isDbAvailable } from "../db/pool.js";
import {
  applyLocalPrepLinks,
  applyLocalPrepLinksToRecipe,
  applyLocalPrerequisiteFlag,
  applyLocalPrerequisiteFlags,
  hasPrepRecipeColumn,
  saveLocalPrepLinks,
  saveLocalPrerequisiteFlag,
} from "../db/prepSchema.js";
import type { Ingredient, Recipe, Unit } from "../types.js";

const unitSchema = z.enum(["mg", "g", "kg", "ml", "l", "pieces", "portions"]);

const ingredientSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  amount: z.number().nonnegative(),
  unit: unitSchema,
  prepRecipeId: z.string().min(1).optional(),
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
  isPrerequisite: z.boolean().optional(),
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

function mapIngredientRow(row: Record<string, unknown>): Ingredient {
  return {
    id: String(row.id),
    name: String(row.name),
    amount: Number(row.amount),
    unit: row.unit as Unit,
    prepRecipeId: row.prep_recipe_id ? String(row.prep_recipe_id) : undefined,
    soak: row.soak ? true : undefined,
    soakDuration: row.soak_duration != null ? Number(row.soak_duration) : undefined,
    soakUnit: row.soak_unit === "hours" || row.soak_unit === "minutes" ? row.soak_unit : undefined,
  };
}

async function listFromDb(): Promise<Recipe[]> {
  const pool = await requirePool();
  const withPrep = await hasPrepRecipeColumn(pool);

  const recipesRes = await pool.query(
    `SELECT id, name, description, category, base_servings, notes
     FROM recipes ORDER BY id`
  );
  const ingredientsRes = await pool.query(
    withPrep
      ? `SELECT id, recipe_id, name, amount, unit, sort_order, soak, soak_duration, soak_unit, prep_recipe_id
         FROM ingredients ORDER BY recipe_id, sort_order`
      : `SELECT id, recipe_id, name, amount, unit, sort_order, soak, soak_duration, soak_unit
         FROM ingredients ORDER BY recipe_id, sort_order`
  );

  const byRecipe = new Map<string, Recipe["ingredients"]>();
  for (const row of ingredientsRes.rows) {
    const list = byRecipe.get(row.recipe_id) ?? [];
    list.push(mapIngredientRow(row));
    byRecipe.set(row.recipe_id, list);
  }

  const recipes = recipesRes.rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category ?? "",
    baseServings: Number(row.base_servings),
    notes: row.notes ?? undefined,
    ingredients: byRecipe.get(row.id) ?? [],
  }));

  const withLinks = withPrep ? recipes : applyLocalPrepLinks(recipes);
  return applyLocalPrerequisiteFlags(withLinks);
}

export async function listRecipes(): Promise<{ recipes: Recipe[]; source: "db" }> {
  const recipes = await listFromDb();
  return { recipes, source: "db" };
}

async function getFromDb(id: string): Promise<Recipe | null> {
  const pool = await requirePool();
  const withPrep = await hasPrepRecipeColumn(pool);
  const recipesRes = await pool.query(
    `SELECT id, name, description, category, base_servings, notes
     FROM recipes WHERE id = $1`,
    [id]
  );
  if (!recipesRes.rows[0]) return null;
  const row = recipesRes.rows[0];
  const ingredientsRes = await pool.query(
    withPrep
      ? `SELECT id, recipe_id, name, amount, unit, sort_order, soak, soak_duration, soak_unit, prep_recipe_id
         FROM ingredients WHERE recipe_id = $1 ORDER BY sort_order`
      : `SELECT id, recipe_id, name, amount, unit, sort_order, soak, soak_duration, soak_unit
         FROM ingredients WHERE recipe_id = $1 ORDER BY sort_order`,
    [id]
  );
  const recipe: Recipe = {
    id: row.id,
    name: row.name,
    category: row.category ?? "",
    baseServings: Number(row.base_servings),
    notes: row.notes ?? undefined,
    ingredients: ingredientsRes.rows.map((ing) => mapIngredientRow(ing)),
  };
  const withLinks = withPrep ? recipe : applyLocalPrepLinksToRecipe(recipe);
  return applyLocalPrerequisiteFlag(withLinks);
}

export async function getRecipe(id: string): Promise<Recipe | null> {
  return getFromDb(id);
}

export async function upsertRecipe(recipe: Recipe): Promise<Recipe> {
  const parsed = recipeSchema.parse(recipe);
  const pool = await requirePool();
  const withPrep = await hasPrepRecipeColumn(pool);
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
      const isPrep = !!ing.prepRecipeId;
      if (withPrep) {
        await client.query(
          `INSERT INTO ingredients (
             id, recipe_id, name, amount, unit, sort_order,
             soak, soak_duration, soak_unit, prep_recipe_id
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            ing.id,
            parsed.id,
            ing.name,
            ing.amount,
            isPrep ? "portions" : ing.unit,
            i,
            !isPrep && !!ing.soak,
            !isPrep && ing.soak ? ing.soakDuration ?? null : null,
            !isPrep && ing.soak ? ing.soakUnit || "minutes" : null,
            ing.prepRecipeId ?? null,
          ]
        );
      } else {
        // No prep_recipe_id / portions yet — keep a Neon-safe unit; overlay restores prep on read.
        await client.query(
          `INSERT INTO ingredients (
             id, recipe_id, name, amount, unit, sort_order,
             soak, soak_duration, soak_unit
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            ing.id,
            parsed.id,
            ing.name,
            ing.amount,
            isPrep ? "pieces" : ing.unit === "portions" ? "pieces" : ing.unit,
            i,
            !isPrep && !!ing.soak,
            !isPrep && ing.soak ? ing.soakDuration ?? null : null,
            !isPrep && ing.soak ? ing.soakUnit || "minutes" : null,
          ]
        );
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  if (!withPrep) saveLocalPrepLinks(parsed);
  saveLocalPrerequisiteFlag(parsed);
  return parsed;
}

export async function deleteRecipe(id: string): Promise<boolean> {
  const pool = await requirePool();
  const result = await pool.query("DELETE FROM recipes WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

export { recipeSchema };
