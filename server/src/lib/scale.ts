import type { Recipe, ScaledIngredient, ScaledRecipe } from "../types.js";
import { normalizeDisplay, scaleAmount } from "./units.js";

/**
 * Scale a recipe. Prep lines (prepRecipeId) cascade into nested scaled child recipes.
 * `amount` on a prep line = servings of that child (same meaning as child's baseServings).
 */
export function scaleRecipe(
  recipe: Recipe,
  targetServings: number,
  catalog: Map<string, Recipe> = new Map(),
  stack: string[] = []
): ScaledRecipe {
  if (!Number.isFinite(targetServings) || targetServings <= 0) {
    throw new Error("Target servings must be a positive number");
  }
  if (!Number.isFinite(recipe.baseServings) || recipe.baseServings <= 0) {
    throw new Error("Recipe baseServings must be a positive number");
  }
  if (stack.includes(recipe.id)) {
    throw new Error(`Circular prep reference involving "${recipe.id}"`);
  }

  const scaleFactor = targetServings / recipe.baseServings;
  const nextStack = [...stack, recipe.id];

  const ingredients: ScaledIngredient[] = recipe.ingredients.map((ing) => {
    const scaledAmount = scaleAmount(ing.amount, scaleFactor);
    const display = normalizeDisplay(scaledAmount, ing.unit);
    const base: ScaledIngredient = {
      ...ing,
      scaledAmount,
      displayAmount: display.amount,
      displayUnit: display.unit,
    };

    if (!ing.prepRecipeId) return base;

    const child = catalog.get(ing.prepRecipeId);
    if (!child) {
      return { ...base, prepName: ing.name };
    }

    // Prep line amount is "child servings" at parent base; scale that count with the parent.
    const childTargetServings = scaledAmount;
    return {
      ...base,
      unit: "portions",
      displayUnit: "portions",
      prepName: child.name,
      prepScaled: scaleRecipe(child, childTargetServings, catalog, nextStack),
    };
  });

  return {
    id: recipe.id,
    name: recipe.name,
    category: recipe.category,
    notes: recipe.notes,
    translations: recipe.translations,
    baseServings: recipe.baseServings,
    targetServings,
    scaleFactor,
    ingredients,
  };
}
