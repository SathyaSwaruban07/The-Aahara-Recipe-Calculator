import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool, PoolClient } from "pg";
import type { Recipe, RecipesFile } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const recipesJsonPath = path.resolve(__dirname, "../../../data/recipes.json");
const localOverlayPath = path.resolve(__dirname, "../../../data/prep-links.local.json");
const prerequisiteFlagsPath = path.resolve(
  __dirname,
  "../../../data/prerequisite-flags.local.json"
);

/** ingredient id → prep recipe id (local-only until Neon has prep_recipe_id) */
type PrepOverlay = Record<string, string>;
/** recipe id → marked as prerequisite (local-only until Neon has a column) */
type PrerequisiteFlags = Record<string, boolean>;

let prepColumnCached: boolean | null = null;

export async function hasPrepRecipeColumn(pool: Pool | PoolClient): Promise<boolean> {
  if (prepColumnCached != null) return prepColumnCached;
  const res = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'ingredients'
       AND column_name = 'prep_recipe_id'
     LIMIT 1`
  );
  prepColumnCached = res.rowCount != null && res.rowCount > 0;
  return prepColumnCached;
}

/** Clear cache after migrate so the next request picks up the new column. */
export function clearPrepColumnCache(): void {
  prepColumnCached = null;
}

function readOverlayFile(): PrepOverlay {
  try {
    if (!fs.existsSync(localOverlayPath)) return {};
    return JSON.parse(fs.readFileSync(localOverlayPath, "utf8")) as PrepOverlay;
  } catch {
    return {};
  }
}

function writeOverlayFile(overlay: PrepOverlay): void {
  fs.mkdirSync(path.dirname(localOverlayPath), { recursive: true });
  fs.writeFileSync(localOverlayPath, `${JSON.stringify(overlay, null, 2)}\n`, "utf8");
}

/** Seed overlay from recipes.json so batter/aloo under masala dosa work without migrating Neon. */
function overlayFromRecipesJson(): PrepOverlay {
  try {
    const file = JSON.parse(fs.readFileSync(recipesJsonPath, "utf8")) as RecipesFile;
    const map: PrepOverlay = {};
    for (const recipe of file.recipes) {
      for (const ing of recipe.ingredients) {
        if (ing.prepRecipeId) map[ing.id] = ing.prepRecipeId;
      }
    }
    return map;
  } catch {
    return {};
  }
}

function mergedOverlay(): PrepOverlay {
  return { ...overlayFromRecipesJson(), ...readOverlayFile() };
}

export function applyLocalPrepLinks(recipes: Recipe[]): Recipe[] {
  const overlay = mergedOverlay();
  if (Object.keys(overlay).length === 0) return recipes;
  return recipes.map((recipe) => ({
    ...recipe,
    ingredients: recipe.ingredients.map((ing) => {
      const prepRecipeId = overlay[ing.id] ?? ing.prepRecipeId;
      if (!prepRecipeId) return ing;
      return {
        ...ing,
        prepRecipeId,
        unit: "portions" as const,
      };
    }),
  }));
}

export function applyLocalPrepLinksToRecipe(recipe: Recipe): Recipe {
  return applyLocalPrepLinks([recipe])[0];
}

/** Persist prep links locally when the Neon column is not migrated yet. */
export function saveLocalPrepLinks(recipe: Recipe): void {
  const overlay = readOverlayFile();
  let changed = false;
  for (const ing of recipe.ingredients) {
    if (ing.prepRecipeId) {
      if (overlay[ing.id] !== ing.prepRecipeId) {
        overlay[ing.id] = ing.prepRecipeId;
        changed = true;
      }
    } else if (overlay[ing.id]) {
      delete overlay[ing.id];
      changed = true;
    }
  }
  if (changed) writeOverlayFile(overlay);
}

function readPrerequisiteFlagsFile(): PrerequisiteFlags {
  try {
    if (!fs.existsSync(prerequisiteFlagsPath)) return {};
    return JSON.parse(fs.readFileSync(prerequisiteFlagsPath, "utf8")) as PrerequisiteFlags;
  } catch {
    return {};
  }
}

function writePrerequisiteFlagsFile(flags: PrerequisiteFlags): void {
  fs.mkdirSync(path.dirname(prerequisiteFlagsPath), { recursive: true });
  fs.writeFileSync(prerequisiteFlagsPath, `${JSON.stringify(flags, null, 2)}\n`, "utf8");
}

function prerequisiteFlagsFromRecipesJson(): PrerequisiteFlags {
  try {
    const file = JSON.parse(fs.readFileSync(recipesJsonPath, "utf8")) as RecipesFile;
    const map: PrerequisiteFlags = {};
    for (const recipe of file.recipes) {
      if (recipe.isPrerequisite) map[recipe.id] = true;
    }
    return map;
  } catch {
    return {};
  }
}

function mergedPrerequisiteFlags(): PrerequisiteFlags {
  return { ...prerequisiteFlagsFromRecipesJson(), ...readPrerequisiteFlagsFile() };
}

export function applyLocalPrerequisiteFlags(recipes: Recipe[]): Recipe[] {
  const flags = mergedPrerequisiteFlags();
  return recipes.map((recipe) => {
    const fromFile = flags[recipe.id];
    if (fromFile == null && !recipe.isPrerequisite) return recipe;
    return {
      ...recipe,
      isPrerequisite: fromFile != null ? !!fromFile : !!recipe.isPrerequisite,
    };
  });
}

export function applyLocalPrerequisiteFlag(recipe: Recipe): Recipe {
  return applyLocalPrerequisiteFlags([recipe])[0];
}

export function saveLocalPrerequisiteFlag(recipe: Recipe): void {
  const flags = readPrerequisiteFlagsFile();
  const next = !!recipe.isPrerequisite;
  if (next) {
    if (flags[recipe.id] !== true) {
      flags[recipe.id] = true;
      writePrerequisiteFlagsFile(flags);
    }
  } else if (flags[recipe.id]) {
    delete flags[recipe.id];
    writePrerequisiteFlagsFile(flags);
  }
}
