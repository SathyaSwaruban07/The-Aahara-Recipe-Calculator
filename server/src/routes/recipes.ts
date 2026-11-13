import { Router } from "express";
import { z } from "zod";
import { deleteRecipe, getRecipe, listRecipes, recipeSchema, upsertRecipe } from "../store/recipes.js";
import { scaleRecipe } from "../lib/scale.js";
import { withTranslations } from "../lib/recipeI18n.js";
import { translateBatch, translateText } from "../lib/translate.js";
import { chunkForTts, fetchTtsMp3 } from "../lib/tts.js";

export const recipesRouter = Router();

recipesRouter.post("/translate", async (req, res) => {
  try {
    const body = z
      .object({
        text: z.string().min(1),
        target: z.enum(["en", "ta", "hi"]),
        source: z.enum(["en", "ta", "hi"]).default("en"),
      })
      .parse(req.body);

    const translatedText = await translateText(body.text, body.target, body.source);
    res.json({ translatedText, target: body.target, source: body.source });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.flatten() });
      return;
    }
    res.status(502).json({ error: (err as Error).message });
  }
});

recipesRouter.post("/translate-batch", async (req, res) => {
  try {
    const body = z
      .object({
        texts: z.array(z.string()).max(100),
        target: z.enum(["en", "ta", "hi"]),
        source: z.enum(["en", "ta", "hi"]).default("en"),
      })
      .parse(req.body);

    const translations = await translateBatch(body.texts, body.target, body.source);
    res.json({ translations, target: body.target, source: body.source });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.flatten() });
      return;
    }
    res.status(502).json({ error: (err as Error).message });
  }
});

recipesRouter.get("/", async (_req, res) => {
  try {
    const result = await listRecipes();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** Stream TTS audio (used when the browser has no Tamil/Hindi voice). */
recipesRouter.get("/tts", async (req, res) => {
  try {
    const text = String(req.query.text || "").trim();
    const lang = String(req.query.lang || "en");
    if (!text) {
      res.status(400).json({ error: "Query param 'text' is required" });
      return;
    }
    if (!["en", "ta", "hi"].includes(lang)) {
      res.status(400).json({ error: "Query param 'lang' must be en, ta, or hi" });
      return;
    }
    if (text.length > 400) {
      res.status(400).json({ error: "Text too long for a single TTS chunk" });
      return;
    }

    const audio = await fetchTtsMp3(text, lang as "en" | "ta" | "hi");
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(audio);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

recipesRouter.get("/tts-plan", async (req, res) => {
  try {
    const text = String(req.query.text || "").trim();
    if (!text) {
      res.status(400).json({ error: "Query param 'text' is required" });
      return;
    }
    res.json({ chunks: chunkForTts(text) });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

recipesRouter.get("/:id", async (req, res) => {
  try {
    const recipe = await getRecipe(req.params.id);
    if (!recipe) {
      res.status(404).json({ error: "Recipe not found" });
      return;
    }
    res.json(recipe);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

recipesRouter.get("/:id/scale", async (req, res) => {
  try {
    const recipe = await getRecipe(req.params.id);
    if (!recipe) {
      res.status(404).json({ error: "Recipe not found" });
      return;
    }
    // Omit servings (or invalid) → use the recipe's saved base servings (fast default load)
    const raw = req.query.servings;
    const parsed = raw == null || raw === "" ? NaN : Number(raw);
    const servings =
      Number.isFinite(parsed) && parsed > 0 ? parsed : recipe.baseServings;
    res.json(scaleRecipe(recipe, servings));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

recipesRouter.post("/", async (req, res) => {
  try {
    const parsed = recipeSchema.parse(req.body);
    const withI18n = await withTranslations(parsed);
    const saved = await upsertRecipe(withI18n);
    res.status(201).json(saved);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.flatten() });
      return;
    }
    res.status(500).json({ error: (err as Error).message });
  }
});

recipesRouter.put("/:id", async (req, res) => {
  try {
    const parsed = recipeSchema.parse({ ...req.body, id: req.params.id });
    const withI18n = await withTranslations(parsed);
    const saved = await upsertRecipe(withI18n);
    res.json(saved);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.flatten() });
      return;
    }
    res.status(500).json({ error: (err as Error).message });
  }
});

recipesRouter.delete("/:id", async (req, res) => {
  try {
    const ok = await deleteRecipe(req.params.id);
    if (!ok) {
      res.status(404).json({ error: "Recipe not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
