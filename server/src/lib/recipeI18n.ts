import type { Recipe, RecipeLocaleFields } from "../types.js";
import { translateBatch } from "./translate.js";

const CATEGORY_I18N: Record<string, { ta: string; hi: string }> = {
  Breakfast: { ta: "காலை உணவு", hi: "नाश्ता" },
  Lunch: { ta: "மதிய உணவு", hi: "दोपहर का खाना" },
  Dinner: { ta: "இரவு உணவு", hi: "रात का खाना" },
};

function pickTranslated(original: string, translated: string | undefined): string {
  const out = (translated || "").trim();
  if (out && out !== original.trim()) return out;
  return original;
}

async function buildLocale(recipe: Recipe, target: "ta" | "hi"): Promise<RecipeLocaleFields> {
  const baseTexts = [
    recipe.name,
    recipe.category || "",
    recipe.notes || "",
    ...recipe.ingredients.map((i) => i.name),
  ];

  const translated = await translateBatch(baseTexts, target, "en");
  const [name, categoryRaw, notes, ...ingNames] = translated;

  const category =
    CATEGORY_I18N[recipe.category]?.[target] ||
    pickTranslated(recipe.category, categoryRaw) ||
    recipe.category;

  const ingredients: Record<string, string> = {};
  recipe.ingredients.forEach((ing, i) => {
    ingredients[ing.id] = pickTranslated(ing.name, ingNames[i]);
  });

  return {
    name: pickTranslated(recipe.name, name),
    category,
    notes: recipe.notes ? pickTranslated(recipe.notes, notes) : recipe.notes,
    ingredients,
  };
}

/** Attach Tamil + Hindi translations for recipe + ingredient names. */
export async function withTranslations(recipe: Recipe): Promise<Recipe> {
  try {
    const [ta, hi] = await Promise.all([buildLocale(recipe, "ta"), buildLocale(recipe, "hi")]);
    return {
      ...recipe,
      translations: { ta, hi },
    };
  } catch {
    return {
      ...recipe,
      translations: {
        ta: {
          name: recipe.name,
          category: CATEGORY_I18N[recipe.category]?.ta || recipe.category,
          notes: recipe.notes,
          ingredients: Object.fromEntries(recipe.ingredients.map((i) => [i.id, i.name])),
        },
        hi: {
          name: recipe.name,
          category: CATEGORY_I18N[recipe.category]?.hi || recipe.category,
          notes: recipe.notes,
          ingredients: Object.fromEntries(recipe.ingredients.map((i) => [i.id, i.name])),
        },
      },
    };
  }
}
