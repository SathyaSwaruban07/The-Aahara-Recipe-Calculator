import type { HealthStatus, Recipe, ScaledRecipe } from "./types";

/** Set VITE_API_URL when the UI is on GitHub Pages and the API is hosted elsewhere. */
const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.toString?.() || body.error || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<HealthStatus>("/health"),
  listRecipes: () => request<{ recipes: Recipe[]; source: string }>("/recipes"),
  getRecipe: (id: string) => request<Recipe>(`/recipes/${id}`),
  scaleRecipe: (id: string, servings?: number) =>
    request<ScaledRecipe>(
      servings != null && servings > 0
        ? `/recipes/${id}/scale?servings=${encodeURIComponent(servings)}`
        : `/recipes/${id}/scale`
    ),
  saveRecipe: (recipe: Recipe) =>
    request<Recipe>(`/recipes/${recipe.id}`, {
      method: "PUT",
      body: JSON.stringify(recipe),
    }),
  createRecipe: (recipe: Recipe) =>
    request<Recipe>("/recipes", {
      method: "POST",
      body: JSON.stringify(recipe),
    }),
  deleteRecipe: (id: string) => request<void>(`/recipes/${id}`, { method: "DELETE" }),
  translate: (text: string, target: "en" | "ta" | "hi", source: "en" | "ta" | "hi" = "en") =>
    request<{ translatedText: string }>("/recipes/translate", {
      method: "POST",
      body: JSON.stringify({ text, target, source }),
    }),
  translateBatch: (texts: string[], target: "en" | "ta" | "hi", source: "en" | "ta" | "hi" = "en") =>
    request<{ translations: string[] }>("/recipes/translate-batch", {
      method: "POST",
      body: JSON.stringify({ texts, target, source }),
    }),
};
