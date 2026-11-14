export type Unit = "mg" | "g" | "kg" | "ml" | "l" | "pieces" | "portions";

export type SoakUnit = "minutes" | "hours";

export interface Ingredient {
  id: string;
  name: string;
  amount: number;
  unit: Unit;
  /** When set, this line is a child/prep recipe (amount in portions of that recipe). */
  prepRecipeId?: string;
  soak?: boolean;
  soakDuration?: number;
  soakUnit?: SoakUnit;
}

export interface RecipeLocaleFields {
  name?: string;
  category?: string;
  notes?: string;
  ingredients?: Record<string, string>;
}

export interface Recipe {
  id: string;
  name: string;
  category: string;
  baseServings: number;
  ingredients: Ingredient[];
  notes?: string;
  /** When true, listed under Prerequisite Recipes and available as a prep tag target. */
  isPrerequisite?: boolean;
  translations?: {
    ta?: RecipeLocaleFields;
    hi?: RecipeLocaleFields;
  };
}

export interface RecipesFile {
  version: number;
  localeHints: {
    supported: string[];
    default: string;
    note: string;
  };
  recipes: Recipe[];
}

export interface ScaledIngredient extends Ingredient {
  scaledAmount: number;
  displayAmount: number;
  displayUnit: Unit;
  prepName?: string;
  prepScaled?: ScaledRecipe;
}

export interface ScaledRecipe extends Omit<Recipe, "ingredients"> {
  targetServings: number;
  scaleFactor: number;
  ingredients: ScaledIngredient[];
}
