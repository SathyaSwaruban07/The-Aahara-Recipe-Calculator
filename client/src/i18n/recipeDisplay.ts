import type { Recipe, RecipeLocaleFields } from "../types";

export type ContentLang = "en" | "ta" | "hi";

/** Live translator: static dict → cache → API enqueue */
export type ContentTranslateFn = (text: string) => string;

function localeFields(recipe: Recipe, lang: ContentLang): RecipeLocaleFields | undefined {
  if (lang === "ta" || lang === "hi") return recipe.translations?.[lang];
  return undefined;
}

/** Prefer a stored locale string only when it actually differs from English. */
function resolveLocalized(
  english: string,
  stored: string | undefined,
  lang: ContentLang,
  tContent?: ContentTranslateFn
): string {
  if (!english?.trim()) return english || "";
  if (lang === "en") return english;

  const saved = stored?.trim();
  if (saved && saved !== english.trim()) return saved;

  if (tContent) return tContent(english);
  return saved || english;
}

export function displayRecipeName(
  recipe: Recipe,
  lang: ContentLang,
  tContent?: ContentTranslateFn
): string {
  return resolveLocalized(recipe.name, localeFields(recipe, lang)?.name, lang, tContent);
}

export function displayRecipeCategory(
  recipe: Recipe,
  lang: ContentLang,
  tContent?: ContentTranslateFn
): string {
  return resolveLocalized(
    recipe.category,
    localeFields(recipe, lang)?.category,
    lang,
    tContent
  );
}

export function displayRecipeNotes(
  recipe: Recipe,
  lang: ContentLang,
  tContent?: ContentTranslateFn
): string {
  const notes = recipe.notes || "";
  return resolveLocalized(notes, localeFields(recipe, lang)?.notes, lang, tContent);
}

export function displayIngredientName(
  recipe: Pick<Recipe, "translations">,
  ingredientId: string,
  fallbackName: string,
  lang: ContentLang,
  tContent?: ContentTranslateFn
): string {
  const stored =
    lang === "ta" || lang === "hi"
      ? recipe.translations?.[lang]?.ingredients?.[ingredientId]
      : undefined;
  return resolveLocalized(fallbackName, stored, lang, tContent);
}

/** All language variants of a recipe for multilingual search. */
export function recipeSearchBlob(recipe: Recipe): string {
  const parts: string[] = [
    recipe.name,
    recipe.category,
    recipe.notes || "",
    ...recipe.ingredients.map((i) => i.name),
  ];

  for (const lang of ["ta", "hi"] as const) {
    const loc = recipe.translations?.[lang];
    if (!loc) continue;
    parts.push(loc.name || "", loc.category || "", loc.notes || "");
    if (loc.ingredients) parts.push(...Object.values(loc.ingredients));
  }

  return parts.join(" ").toLowerCase();
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .trim();
}

function searchTokens(value: string): string[] {
  return normalizeSearchText(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const rows = b.length + 1;
  let prev = Array.from({ length: rows }, (_, i) => i);
  let curr = new Array<number>(rows);

  for (let i = 0; i < a.length; i++) {
    curr[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      curr[j + 1] = Math.min(prev[j + 1] + 1, curr[j] + 1, prev[j] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length] ?? 0;
}

/** 0–1 similarity for nearest / typo-tolerant token matching. */
function tokenSimilarity(queryToken: string, candidate: string): number {
  if (!queryToken || !candidate) return 0;
  if (queryToken === candidate) return 1;

  if (candidate.includes(queryToken) || queryToken.includes(candidate)) {
    const shorter = Math.min(queryToken.length, candidate.length);
    const longer = Math.max(queryToken.length, candidate.length);
    return 0.78 + (0.2 * shorter) / longer;
  }

  if (candidate.startsWith(queryToken) || queryToken.startsWith(candidate)) {
    return 0.82;
  }

  const maxLen = Math.max(queryToken.length, candidate.length);
  if (maxLen <= 2) return 0;

  // Allow at most ~35% character edits for a near match
  const dist = levenshtein(queryToken, candidate);
  const ratio = 1 - dist / maxLen;
  return ratio >= 0.62 ? ratio : 0;
}

function bestTokenSimilarity(queryToken: string, haystack: string[]): number {
  let best = 0;
  for (const token of haystack) {
    best = Math.max(best, tokenSimilarity(queryToken, token));
    if (best >= 1) return 1;
  }
  return best;
}

/**
 * Higher = closer match. Returns 0 when nothing is near enough.
 * Empty query scores 1 so all recipes remain visible.
 */
export function scoreRecipeSearch(recipe: Recipe, query: string): number {
  const raw = query.trim();
  if (!raw) return 1;

  const qNorm = normalizeSearchText(raw);
  const qTokens = searchTokens(raw);
  if (!qTokens.length) return 1;

  const nameTokens = [
    ...searchTokens(recipe.name),
    ...searchTokens(recipe.translations?.ta?.name || ""),
    ...searchTokens(recipe.translations?.hi?.name || ""),
  ];
  const ingredientTokens = [
    ...recipe.ingredients.flatMap((i) => searchTokens(i.name)),
    ...Object.values(recipe.translations?.ta?.ingredients || {}).flatMap((n) => searchTokens(n)),
    ...Object.values(recipe.translations?.hi?.ingredients || {}).flatMap((n) => searchTokens(n)),
  ];
  const otherTokens = [
    ...searchTokens(recipe.category),
    ...searchTokens(recipe.notes || ""),
    ...searchTokens(recipe.translations?.ta?.category || ""),
    ...searchTokens(recipe.translations?.hi?.category || ""),
    ...searchTokens(recipe.translations?.ta?.notes || ""),
    ...searchTokens(recipe.translations?.hi?.notes || ""),
  ];

  const blob = recipeSearchBlob(recipe);
  let score = 0;

  // Exact / contiguous phrase boost
  if (blob.includes(qNorm)) score += 40;

  for (const qt of qTokens) {
    const nameHit = bestTokenSimilarity(qt, nameTokens);
    const ingHit = bestTokenSimilarity(qt, ingredientTokens);
    const otherHit = bestTokenSimilarity(qt, otherTokens);
    const best = Math.max(nameHit * 1.35, ingHit * 1.1, otherHit * 0.75);

    // Each query word needs a near match somewhere
    if (best < 0.62) return 0;
    score += best * 10;
  }

  return score;
}

export function matchesRecipeSearch(recipe: Recipe, query: string): boolean {
  return scoreRecipeSearch(recipe, query) > 0;
}

/** Queue every English content string on a recipe for live translation. */
export function collectRecipeContentTexts(recipe: Recipe): string[] {
  return [
    recipe.name,
    recipe.category,
    recipe.notes || "",
    ...recipe.ingredients.map((i) => i.name),
  ].filter((t) => t.trim());
}
