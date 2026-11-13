export type Unit = "mg" | "g" | "kg" | "ml" | "l" | "pieces";

export type SoakUnit = "minutes" | "hours";

export interface Ingredient {
  id: string;
  name: string;
  amount: number;
  unit: Unit;
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
}

export interface ScaledRecipe extends Omit<Recipe, "ingredients"> {
  targetServings: number;
  scaleFactor: number;
  ingredients: ScaledIngredient[];
}
