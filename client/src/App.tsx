import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Container,
  FormControl,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Switch,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { api } from "./api";
import type { Recipe } from "./types";
import { RecipeList } from "./components/RecipeList";
import { ScaleView } from "./components/ScaleView";
import { RecipeForm } from "./components/RecipeForm";
import { DeleteConfirmDialog } from "./components/DeleteConfirmDialog";
import { displayRecipeName } from "./i18n/recipeDisplay";
import { useContentTranslation } from "./i18n/ContentTranslation";
import { useAdminMode } from "./admin/AdminMode";
import { FontScaleControl, TOP_CONTROL_HEIGHT } from "./components/FontScaleControl";
import { colors } from "./theme";
import aaharaLogo from "./assets/the-aahara-logo.png";

type View =
  | { kind: "list" }
  | { kind: "scale"; recipeId: string }
  | { kind: "form"; recipe?: Recipe };

export default function App() {
  const { t, i18n } = useTranslation();
  const { lang, tContent } = useContentTranslation();
  const { isAdmin, requestAdmin, exitAdmin } = useAdminMode();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [view, setView] = useState<View>({ kind: "list" });
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Recipe | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listRecipes();
      setRecipes(list.recipes);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [view]);

  const onLangChange = (lng: string) => {
    void i18n.changeLanguage(lng);
  };

  const langValue = i18n.language.startsWith("ta")
    ? "ta"
    : i18n.language.startsWith("hi")
      ? "hi"
      : "en";

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.deleteRecipe(pendingDelete.id);
      setToast("Deleted");
      setPendingDelete(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", pb: { xs: 10, sm: 6 }, pt: "var(--safe-top)" }}>
      <Container
        maxWidth="lg"
        sx={{
          pt: { xs: 2, sm: 3 },
          px: { xs: 1.75, sm: 3 },
          pb: "var(--safe-bottom)",
        }}
      >
        <Stack spacing={{ xs: 2.5, sm: 3 }} className="rise-in">
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={{ xs: 0.5, sm: 1.25 }}
            flexWrap="nowrap"
            className="no-print"
            sx={{ width: "100%", minWidth: 0, gap: { xs: 0.5, sm: 1.25 } }}
          >
            <Box
              component="img"
              src={aaharaLogo}
              alt="The Aahara"
              sx={{
                height: { xs: 52, sm: 56 },
                width: { xs: 168, sm: "auto" },
                maxWidth: { xs: "58vw", sm: 220 },
                minWidth: { xs: 148, sm: 0 },
                objectFit: "contain",
                objectPosition: "left center",
                flex: "0 0 auto",
                display: "block",
                backgroundColor: "transparent",
              }}
            />
            <Stack
              direction="row"
              alignItems="center"
              spacing={{ xs: 0.5, sm: 1.25 }}
              flexWrap="nowrap"
              sx={{ minWidth: 0, flex: "1 1 auto", justifyContent: "flex-end" }}
            >
            <FontScaleControl />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={isAdmin}
                  onChange={(_, checked) => {
                    if (checked) requestAdmin();
                    else {
                      exitAdmin();
                      if (view.kind === "form") setView({ kind: "list" });
                    }
                  }}
                  color="primary"
                />
              }
              label={
                <Typography
                  variant="body2"
                  sx={{
                    color: colors.darkStone,
                    fontWeight: 600,
                    fontSize: { xs: "0.75rem", sm: "0.875rem" },
                    whiteSpace: "nowrap",
                    lineHeight: 1.2,
                  }}
                >
                  {isMobile ? t("admin.labelShort") : t("admin.label")}
                </Typography>
              }
              sx={{
                m: 0,
                mr: 0,
                height: TOP_CONTROL_HEIGHT,
                pl: { xs: 0.35, sm: 1 },
                pr: { xs: 0.35, sm: 1 },
                borderRadius: "12px",
                bgcolor: "rgba(255,255,255,0.96)",
                border: "1px solid #E7E5E4",
                flexShrink: 0,
                boxSizing: "border-box",
                "& .MuiFormControlLabel-label": { ml: { xs: 0, sm: 0.25 } },
              }}
            />
            <FormControl
              size="small"
              sx={{
                minWidth: { xs: 64, sm: 120 },
                flexShrink: 0,
                height: TOP_CONTROL_HEIGHT,
              }}
            >
              <Select
                value={langValue}
                onChange={(e) => onLangChange(e.target.value)}
                aria-label={t("nav.language")}
                sx={{
                  height: TOP_CONTROL_HEIGHT,
                  bgcolor: "rgba(255,255,255,0.96)",
                  borderRadius: "12px",
                  fontSize: { xs: "0.8rem", sm: "0.875rem" },
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#E7E5E4" },
                  "& .MuiSelect-select": {
                    py: 0,
                    display: "flex",
                    alignItems: "center",
                    height: TOP_CONTROL_HEIGHT,
                    boxSizing: "border-box",
                  },
                }}
              >
                <MenuItem value="en">{isMobile ? "EN" : "English"}</MenuItem>
                <MenuItem value="ta">தமிழ்</MenuItem>
                <MenuItem value="hi">हिन्दी</MenuItem>
              </Select>
            </FormControl>
            </Stack>
          </Stack>

          {error && (
            <Alert
              severity="error"
              action={
                <IconButton color="inherit" size="small" onClick={() => void load()}>
                  {t("common.retry")}
                </IconButton>
              }
            >
              {error}
            </Alert>
          )}

          {view.kind === "list" && (
            <RecipeList
              recipes={recipes}
              loading={loading}
              onAdd={() => setView({ kind: "form" })}
              onScale={(id) => setView({ kind: "scale", recipeId: id })}
              onEdit={(recipe) => setView({ kind: "form", recipe })}
              onDelete={(recipe) => setPendingDelete(recipe)}
            />
          )}

          {view.kind === "scale" && (
            <ScaleView recipeId={view.recipeId} onBack={() => setView({ kind: "list" })} />
          )}

          {view.kind === "form" && isAdmin && (
            <RecipeForm
              initial={view.recipe}
              onCancel={() => setView({ kind: "list" })}
              onSaved={async () => {
                setToast("Saved");
                setView({ kind: "list" });
                await load();
              }}
            />
          )}
        </Stack>
      </Container>

      <DeleteConfirmDialog
        open={!!pendingDelete}
        recipeName={pendingDelete ? displayRecipeName(pendingDelete, lang, tContent) : ""}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
        busy={deleting}
      />

      <Snackbar open={!!toast} autoHideDuration={2500} onClose={() => setToast(null)} message={toast} />
    </Box>
  );
}
