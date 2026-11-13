import { useEffect, useMemo } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { useContentTranslation } from "../i18n/ContentTranslation";
import {
  collectRecipeContentTexts,
  displayIngredientName,
  displayRecipeName,
  displayRecipeNotes,
} from "../i18n/recipeDisplay";
import { buildRecipeSpeechSegments, stopSpeaking } from "../lib/speakRecipe";
import { colors } from "../theme";
import type { Recipe } from "../types";
import { SpeakRecipeButton } from "./SpeakRecipeButton";

interface Props {
  recipe: Recipe | null;
  open: boolean;
  onClose: () => void;
}

export function QuickGlanceDialog({ recipe, open, onClose }: Props) {
  const { t } = useTranslation();
  const { lang, tContent, tMany } = useContentTranslation();

  useEffect(() => {
    if (!open || !recipe || lang === "en") return;
    tMany(collectRecipeContentTexts(recipe));
  }, [open, recipe, lang, tMany]);

  useEffect(() => {
    if (!open) stopSpeaking();
  }, [open]);

  const speechSegments = useMemo(() => {
    if (!recipe) return [] as string[];
    return buildRecipeSpeechSegments({
      recipeName: displayRecipeName(recipe, lang, tContent),
      servingsLabel: t("list.speakPortions", { count: recipe.baseServings }),
      introIngredients: t("list.speakIngredients"),
      ingredients: recipe.ingredients.map((ing) => ({
        name: displayIngredientName(recipe, ing.id, ing.name, lang, tContent),
        amountLabel: `${ing.amount} ${t(`units.${ing.unit}`)}`,
        soakLabel:
          ing.soak && ing.soakDuration != null
            ? `${t("form.soak")} ${ing.soakDuration} ${t(`form.soakUnits.${ing.soakUnit || "minutes"}`)}`
            : undefined,
      })),
      notes: displayRecipeNotes(recipe, lang, tContent) || undefined,
    });
  }, [recipe, lang, tContent, t]);

  const handleClose = () => {
    stopSpeaking();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      disableRestoreFocus
      PaperProps={{
        sx: {
          borderRadius: "16px",
          bgcolor: "rgba(255,255,255,0.98)",
        },
      }}
    >
      <DialogTitle sx={{ pb: 1.5, pt: 2.5, px: 3 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1.5}>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="h6"
              component="div"
              sx={{ wordBreak: "break-word", color: colors.charcoal, lineHeight: 1.3 }}
            >
              {recipe ? displayRecipeName(recipe, lang, tContent) : ""}
            </Typography>
            {recipe && (
              <Typography variant="body2" sx={{ mt: 0.75, color: colors.slate }}>
                {t("list.glancePortions", { count: recipe.baseServings })}
              </Typography>
            )}
          </Box>
          <SpeakRecipeButton
            speakerKey={recipe ? `glance-${recipe.id}` : "glance"}
            text={speechSegments}
            lang={lang}
          />
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pt: 0, pb: 1 }}>
        <Stack spacing={1.25}>
          {recipe?.ingredients.map((ing) => (
            <Stack
              key={ing.id}
              direction="row"
              alignItems="baseline"
              justifyContent="space-between"
              spacing={2}
              sx={{ py: 0.25 }}
            >
              <Typography sx={{ color: colors.charcoal, wordBreak: "break-word", minWidth: 0 }}>
                {displayIngredientName(recipe, ing.id, ing.name, lang, tContent)}
                {ing.soak && ing.soakDuration != null && (
                  <Box component="span" sx={{ color: colors.slate, fontSize: "0.9em" }}>
                    {" · "}
                    {t("form.soak")} {ing.soakDuration}{" "}
                    {t(`form.soakUnits.${ing.soakUnit || "minutes"}`)}
                  </Box>
                )}
              </Typography>
              <Typography fontWeight={700} sx={{ color: colors.charcoal, whiteSpace: "nowrap", flexShrink: 0 }}>
                {ing.amount} {t(`units.${ing.unit}`)}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} variant="contained" sx={{ borderRadius: "12px" }}>
          {t("common.close")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
