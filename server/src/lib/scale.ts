import type { Recipe, ScaledRecipe } from "../types.js";
import { normalizeDisplay, scaleAmount } from "./units.js";

export function scaleRecipe(recipe: Recipe, targetServings: number): ScaledRecipe {
  if (!Number.isFinite(targetServings) || targetServings <= 0) {
    throw new Error("Target servings must be a positive number");
  }
  if (!Number.isFinite(recipe.baseServings) || recipe.baseServings <= 0) {
    throw new Error("Recipe baseServings must be a positive number");
  }

  const scaleFactor = targetServings / recipe.baseServings;

  const ingredients = recipe.ingredients.map((ing) => {
    const scaledAmount = scaleAmount(ing.amount, scaleFactor);
    const display = normalizeDisplay(scaledAmount, ing.unit);
    return {
      ...ing,
      scaledAmount,
      displayAmount: display.amount,
      displayUnit: display.unit,
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
