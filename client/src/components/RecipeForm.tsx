import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { numberInputValue, parseNumberInput, type NumberDraft } from "../lib/numberInput";
import {
  backButtonSx,
  colors,
  deleteButtonSx,
  floatingCardShadow,
  frostSurfaceSx,
  notesCalloutLabelSx,
  notesCalloutSx,
  primaryButtonSx,
  softControlShadow,
} from "../theme";
import {
  MEAL_CATEGORIES,
  type Ingredient,
  type MealCategory,
  type Recipe,
  type SoakUnit,
  type Unit,
} from "../types";

const formCardSx = {
  p: { xs: 1.5, sm: 2 },
  borderRadius: "12px",
  bgcolor: "rgba(255, 255, 255, 0.45)",
  backdropFilter: "blur(8px)",
  border: "1px solid rgba(255, 255, 255, 0.55)",
  boxShadow: softControlShadow,
} as const;

const UNITS: Unit[] = ["mg", "g", "kg", "ml", "l", "pieces"];
const SOAK_UNITS: SoakUnit[] = ["minutes", "hours"];

interface Props {
  initial?: Recipe;
  onCancel: () => void;
  onSaved: () => void;
}

type FormIngredient = Omit<Ingredient, "amount" | "soakDuration"> & {
  amount: NumberDraft;
  soakDuration?: NumberDraft;
};

type FormRecipe = Omit<Recipe, "baseServings" | "ingredients"> & {
  baseServings: NumberDraft;
  ingredients: FormIngredient[];
};

function emptyIngredient(): FormIngredient {
  return {
    id: `ing-${crypto.randomUUID().slice(0, 8)}`,
    name: "",
    amount: "",
    unit: "g",
    soak: false,
  };
}

function toFormRecipe(recipe: Recipe): FormRecipe {
  return {
    ...recipe,
    baseServings: recipe.baseServings,
    ingredients: recipe.ingredients.map((ing) => ({
      ...ing,
      amount: ing.amount,
      soakDuration: ing.soakDuration,
      unit: ing.prepRecipeId ? "portions" : ing.unit,
    })),
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function RecipeForm({ initial, onCancel, onSaved }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isEdit = !!initial;

  const [form, setForm] = useState<FormRecipe>(
    initial
      ? toFormRecipe(initial)
      : {
          id: "",
          name: "",
          category: "Lunch",
          baseServings: 20,
          ingredients: [emptyIngredient()],
          notes: "",
          isPrerequisite: false,
        }
  );
  const [idTouched, setIdTouched] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Recipe[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { recipes } = await api.listRecipes();
        if (!cancelled) setCatalog(recipes);
      } catch {
        /* picker stays empty; raw ingredients still work */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selfId = form.id.trim() || (initial?.id ?? "");
  const prepOptions = catalog
    .filter((r) => r.id !== selfId)
    .sort((a, b) => Number(!!b.isPrerequisite) - Number(!!a.isPrerequisite));

  const summaryCategory = (
    MEAL_CATEGORIES.includes(form.category as MealCategory) ? form.category : "Lunch"
  ) as MealCategory;
  const namedIngredients = form.ingredients.filter((ing) => ing.name.trim());

  const updateIngredient = (index: number, patch: Partial<FormIngredient>) => {
    setForm((prev) => {
      const ingredients = [...prev.ingredients];
      ingredients[index] = { ...ingredients[index], ...patch };
      return { ...prev, ingredients };
    });
  };

  const setLineKind = (index: number, kind: "raw" | "prep") => {
    if (kind === "prep") {
      updateIngredient(index, {
        name: "",
        amount: "",
        unit: "portions",
        // Empty string = prep mode until a child recipe is chosen
        prepRecipeId: "",
        soak: false,
        soakDuration: undefined,
        soakUnit: undefined,
      });
      return;
    }
    updateIngredient(index, {
      name: "",
      amount: "",
      unit: "g",
      prepRecipeId: undefined,
      soak: false,
      soakDuration: undefined,
      soakUnit: undefined,
    });
  };

  const pickPrepRecipe = (index: number, prepId: string) => {
    const child = catalog.find((r) => r.id === prepId);
    updateIngredient(index, {
      prepRecipeId: prepId,
      name: child?.name || form.ingredients[index].name,
      unit: "portions",
      soak: false,
      soakDuration: undefined,
      soakUnit: undefined,
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const id = form.id.trim() || slugify(form.name);
      if (!id) throw new Error("Recipe name is required");
      if (!form.name.trim()) throw new Error("Recipe name is required");
      if (form.baseServings === "" || form.baseServings <= 0) {
        throw new Error("Base servings must be > 0");
      }
      if (
        form.ingredients.some(
          (ing) => ing.prepRecipeId === undefined && !ing.name.trim()
        )
      ) {
        throw new Error("Every ingredient needs a name");
      }
      if (form.ingredients.some((ing) => ing.amount === "" || Number(ing.amount) < 0)) {
        throw new Error("Every ingredient needs a valid amount");
      }
      for (const ing of form.ingredients) {
        const isPrepLine = ing.prepRecipeId !== undefined;
        if (isPrepLine) {
          if (!ing.prepRecipeId) throw new Error("Choose a prep recipe for each prep line");
          if (ing.prepRecipeId === id) throw new Error("A recipe cannot link to itself");
          if (!catalog.some((r) => r.id === ing.prepRecipeId)) {
            throw new Error(`Prep recipe not found for ${ing.name || "prep line"}`);
          }
        }
        if (ing.soak && (ing.soakDuration === "" || ing.soakDuration == null || ing.soakDuration <= 0)) {
          throw new Error(`Soak duration required for ${ing.name || "ingredient"}`);
        }
      }
      const payload: Recipe = {
        ...form,
        id,
        name: form.name.trim(),
        category: form.category || "Lunch",
        baseServings: form.baseServings,
        isPrerequisite: !!form.isPrerequisite,
        ingredients: form.ingredients.map((ing) => {
          const isPrep = !!ing.prepRecipeId;
          return {
            id: ing.id,
            name: ing.name.trim(),
            amount: Number(ing.amount),
            unit: isPrep ? "portions" : ing.unit,
            prepRecipeId: isPrep ? ing.prepRecipeId : undefined,
            soak: isPrep ? false : !!ing.soak,
            soakDuration: !isPrep && ing.soak ? Number(ing.soakDuration) : undefined,
            soakUnit: !isPrep && ing.soak ? ing.soakUnit || "minutes" : undefined,
          };
        }),
      };
      if (isEdit) await api.saveRecipe(payload);
      else await api.createRecipe(payload);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={onCancel} className="no-print" sx={{ ...backButtonSx, mb: 2 }}>
        {t("nav.back")}
      </Button>

      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        sx={{
          p: { xs: 2, sm: 3 },
          ...frostSurfaceSx,
          boxShadow: floatingCardShadow,
        }}
      >
      <Typography variant={isMobile ? "h5" : "h4"} component="h2" gutterBottom>
        {isEdit ? t("form.titleEdit") : t("form.titleCreate")}
      </Typography>

      <Box sx={{ ...formCardSx, mb: 2.5 }}>
        <Typography
          variant="overline"
          sx={{ color: colors.slate, letterSpacing: "0.08em", display: "block", mb: 0.75 }}
        >
          {t("form.summary")}
        </Typography>
        <Typography
          variant="h6"
          sx={{ color: colors.charcoal, wordBreak: "break-word", lineHeight: 1.3 }}
        >
          {form.name.trim() || t("form.summaryUntitled")}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.75, color: colors.slate }}>
          {form.isPrerequisite ? t("list.prerequisites") : t(`categories.${summaryCategory}`)}
          {" · "}
          {form.baseServings === "" ? "—" : form.baseServings} {t("scale.people")}
          {" · "}
          {namedIngredients.length} {t("list.ingredients")}
        </Typography>
        <Stack spacing={0.75} sx={{ mt: 1.5 }}>
          {namedIngredients.length > 0 ? (
            namedIngredients.map((ing) => (
              <Box key={ing.id}>
                <Stack direction="row" justifyContent="space-between" spacing={1.5} alignItems="baseline">
                  <Typography variant="body2" sx={{ color: colors.charcoal, fontWeight: 600, minWidth: 0 }}>
                    {ing.name.trim()}
                    {ing.prepRecipeId !== undefined ? (
                      <Typography component="span" variant="caption" sx={{ ml: 0.75, color: colors.slate }}>
                        ({t("scale.prepLine")})
                      </Typography>
                    ) : null}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: colors.charcoal, fontWeight: 700, whiteSpace: "nowrap" }}
                  >
                    {ing.amount === "" ? "—" : ing.amount}{" "}
                    {t(`units.${ing.prepRecipeId !== undefined ? "portions" : ing.unit}`)}
                  </Typography>
                </Stack>
                {ing.soak && ing.soakDuration !== "" && ing.soakDuration != null ? (
                  <Typography variant="body2" sx={{ mt: 0.25, color: colors.slate, fontWeight: 600 }}>
                    {t("form.soak")}: {ing.soakDuration} {t(`form.soakUnits.${ing.soakUnit || "minutes"}`)}
                  </Typography>
                ) : null}
              </Box>
            ))
          ) : (
            <Typography variant="body2" sx={{ color: colors.slate }}>
              {t("form.summaryEmpty")}
            </Typography>
          )}
        </Stack>
        {!!form.notes?.trim() && (
          <Box sx={{ ...notesCalloutSx, mt: 1.5, p: 1.25 }}>
            <Typography variant="caption" sx={{ ...notesCalloutLabelSx, mb: 0.35 }}>
              {t("form.notes")}
            </Typography>
            <Typography variant="body2" sx={{ color: colors.charcoal, whiteSpace: "pre-wrap" }}>
              {form.notes.trim()}
            </Typography>
          </Box>
        )}
      </Box>

      <Stack spacing={2}>
        <Box sx={formCardSx}>
          <Stack spacing={2}>
            <TextField
              label={t("form.name")}
              placeholder={t("form.namePlaceholder")}
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((p) => ({
                  ...p,
                  name,
                  id: !idTouched ? slugify(name) : p.id,
                }));
              }}
              required
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              label={t("form.id")}
              placeholder={t("form.idPlaceholder")}
              value={form.id}
              disabled={isEdit}
              onChange={(e) => {
                setIdTouched(true);
                setForm((p) => ({
                  ...p,
                  id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                }));
              }}
              helperText={isEdit ? undefined : t("form.idPlaceholder")}
              InputLabelProps={{ shrink: true }}
            />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                select
                label={t("form.category")}
                value={(MEAL_CATEGORIES.includes(form.category as MealCategory)
                  ? form.category
                  : "Lunch") as MealCategory}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                disabled={!!form.isPrerequisite}
              >
                {MEAL_CATEGORIES.map((c) => (
                  <MenuItem key={c} value={c}>
                    {t(`categories.${c}`)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label={t("form.baseServings")}
                placeholder={t("form.baseServingsPlaceholder")}
                type="number"
                value={numberInputValue(form.baseServings)}
                onChange={(e) => setForm((p) => ({ ...p, baseServings: parseNumberInput(e.target.value) }))}
                inputProps={{ min: 1, inputMode: "numeric" }}
                sx={{ maxWidth: { sm: 240 } }}
                required
                InputLabelProps={{ shrink: true }}
              />
            </Stack>

            <FormControlLabel
              control={
                <Switch
                  checked={!!form.isPrerequisite}
                  onChange={(_, checked) => setForm((p) => ({ ...p, isPrerequisite: checked }))}
                />
              }
              label={
                <Box>
                  <Typography variant="body1" sx={{ color: colors.charcoal, fontWeight: 600 }}>
                    {t("form.isPrerequisite")}
                  </Typography>
                  <Typography variant="caption" sx={{ color: colors.slate, display: "block" }}>
                    {t("form.isPrerequisiteHint")}
                  </Typography>
                </Box>
              }
              sx={{ alignItems: "flex-start", ml: 0, mr: 0 }}
            />

            <TextField
              label={t("form.notes")}
              placeholder={t("form.notesPlaceholder")}
              value={form.notes || ""}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              multiline
              minRows={2}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </Box>

        <Typography variant="h6">{t("form.ingredients")}</Typography>
        {form.ingredients.map((ing, index) => {
          const isPrep = ing.prepRecipeId !== undefined;
          return (
            <Box key={ing.id} sx={formCardSx}>
              <Stack spacing={1.5}>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={isPrep ? "prep" : "raw"}
                  onChange={(_, value) => {
                    if (value === "raw" || value === "prep") setLineKind(index, value);
                  }}
                  sx={{ alignSelf: "flex-start" }}
                >
                  <ToggleButton value="raw">{t("form.lineRaw")}</ToggleButton>
                  <ToggleButton value="prep">{t("form.linePrep")}</ToggleButton>
                </ToggleButtonGroup>

                {isPrep ? (
                  <>
                    <TextField
                      select
                      label={t("form.prepRecipe")}
                      value={ing.prepRecipeId || ""}
                      onChange={(e) => pickPrepRecipe(index, e.target.value)}
                      required
                      helperText={t("form.prepHint")}
                      InputLabelProps={{ shrink: true }}
                    >
                      {prepOptions.map((r) => (
                        <MenuItem key={r.id} value={r.id}>
                          {r.name}
                          {r.isPrerequisite ? ` · ${t("form.isPrerequisite")}` : ""}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                      <TextField
                        label={t("form.prepAmount")}
                        placeholder={t("form.amountPlaceholder")}
                        type="number"
                        value={numberInputValue(ing.amount)}
                        onChange={(e) => updateIngredient(index, { amount: parseNumberInput(e.target.value) })}
                        sx={{ minWidth: { sm: 160 } }}
                        inputProps={{ min: 0, step: "any", inputMode: "decimal" }}
                        InputLabelProps={{ shrink: true }}
                      />
                      <IconButton
                        aria-label={t("list.delete")}
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            ingredients: p.ingredients.filter((_, i) => i !== index),
                          }))
                        }
                        disabled={form.ingredients.length <= 1}
                        sx={{
                          ...deleteButtonSx,
                          alignSelf: { xs: "flex-end", sm: "center" },
                          border: "1px solid",
                          borderRadius: "12px",
                          width: 44,
                          height: 44,
                          ml: { sm: "auto" },
                          "&.Mui-disabled": {
                            bgcolor: `${colors.deleteBg} !important`,
                            color: `${colors.deleteText} !important`,
                            borderColor: `${colors.deleteBorder} !important`,
                            opacity: 0.45,
                          },
                        }}
                      >
                        <DeleteOutlineIcon />
                      </IconButton>
                    </Stack>
                  </>
                ) : (
                  <>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                      <TextField
                        label={t("form.ingredientName")}
                        placeholder={t("form.ingredientPlaceholder")}
                        value={ing.name}
                        onChange={(e) => updateIngredient(index, { name: e.target.value })}
                        required
                        InputLabelProps={{ shrink: true }}
                      />
                      <TextField
                        label={t("form.amount")}
                        placeholder={t("form.amountPlaceholder")}
                        type="number"
                        value={numberInputValue(ing.amount)}
                        onChange={(e) => updateIngredient(index, { amount: parseNumberInput(e.target.value) })}
                        sx={{ minWidth: { sm: 120 } }}
                        inputProps={{ min: 0, step: "any", inputMode: "decimal" }}
                        InputLabelProps={{ shrink: true }}
                      />
                      <TextField
                        select
                        label={t("form.unit")}
                        value={ing.unit === "portions" ? "g" : ing.unit}
                        onChange={(e) => updateIngredient(index, { unit: e.target.value as Unit })}
                        sx={{ minWidth: { sm: 120 } }}
                        InputLabelProps={{ shrink: true }}
                      >
                        {UNITS.map((u) => (
                          <MenuItem key={u} value={u}>
                            {t(`units.${u}`)}
                          </MenuItem>
                        ))}
                      </TextField>
                      <IconButton
                        aria-label={t("list.delete")}
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            ingredients: p.ingredients.filter((_, i) => i !== index),
                          }))
                        }
                        disabled={form.ingredients.length <= 1}
                        sx={{
                          ...deleteButtonSx,
                          alignSelf: { xs: "flex-end", sm: "center" },
                          border: "1px solid",
                          borderRadius: "12px",
                          width: 44,
                          height: 44,
                          "&.Mui-disabled": {
                            bgcolor: `${colors.deleteBg} !important`,
                            color: `${colors.deleteText} !important`,
                            borderColor: `${colors.deleteBorder} !important`,
                            opacity: 0.45,
                          },
                        }}
                      >
                        <DeleteOutlineIcon />
                      </IconButton>
                    </Stack>

                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={!!ing.soak}
                          onChange={(_, checked) =>
                            updateIngredient(index, {
                              soak: checked,
                              soakDuration:
                                ing.soakDuration && ing.soakDuration > 0 ? ing.soakDuration : 30,
                              soakUnit: ing.soakUnit || "minutes",
                            })
                          }
                        />
                      }
                      label={t("form.soak")}
                    />

                    {!!ing.soak && (
                      <Stack direction="row" spacing={2}>
                        <TextField
                          label={t("form.soakDuration")}
                          type="number"
                          size="small"
                          value={numberInputValue(ing.soakDuration)}
                          onChange={(e) =>
                            updateIngredient(index, { soakDuration: parseNumberInput(e.target.value) })
                          }
                          onKeyDown={(e) => {
                            if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
                          }}
                          inputProps={{ min: 0, step: 1, inputMode: "decimal" }}
                          required
                          InputLabelProps={{ shrink: true }}
                          sx={{ flex: 1 }}
                        />
                        <TextField
                          select
                          label={t("form.soakUnit")}
                          size="small"
                          value={ing.soakUnit || "minutes"}
                          onChange={(e) =>
                            updateIngredient(index, { soakUnit: e.target.value as SoakUnit })
                          }
                          InputLabelProps={{ shrink: true }}
                          sx={{ flex: 1 }}
                        >
                          {SOAK_UNITS.map((u) => (
                            <MenuItem key={u} value={u}>
                              {t(`form.soakUnits.${u}`)}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Stack>
                    )}
                  </>
                )}
              </Stack>
            </Box>
          );
        })}

        <Button
          fullWidth={isMobile}
          startIcon={<AddIcon />}
          onClick={() => setForm((p) => ({ ...p, ingredients: [...p.ingredients, emptyIngredient()] }))}
        >
          {t("form.addIngredient")}
        </Button>

        {saving && <Alert severity="info">{t("form.translating")}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button
            fullWidth={isMobile}
            type="submit"
            variant="contained"
            disabled={saving}
            sx={primaryButtonSx}
          >
            {saving ? t("common.loading") : t("form.save")}
          </Button>
          <Button fullWidth={isMobile} onClick={onCancel} disabled={saving}>
            {t("form.cancel")}
          </Button>
        </Stack>
      </Stack>
      </Box>
    </Box>
  );
}
