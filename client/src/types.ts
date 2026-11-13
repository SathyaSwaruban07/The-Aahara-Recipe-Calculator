export type Unit = "mg" | "g" | "kg" | "ml" | "l" | "pieces";

export type SoakUnit = "minutes" | "hours";

export type MealCategory = "Breakfast" | "Lunch" | "Dinner";

export const MEAL_CATEGORIES: MealCategory[] = ["Breakfast", "Lunch", "Dinner"];

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
  /** ingredient id → translated name */
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

export interface HealthStatus {
  ok: boolean;
  dbConnected: boolean;
  storage: string;
  libreTranslate: string;
}
