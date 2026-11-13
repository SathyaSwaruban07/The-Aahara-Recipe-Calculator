import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  FormGroup,
  IconButton,
  InputAdornment,
  Menu,
  Skeleton,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import MicIcon from "@mui/icons-material/Mic";
import MicNoneIcon from "@mui/icons-material/MicNone";
import FilterListIcon from "@mui/icons-material/FilterList";
import ScaleIcon from "@mui/icons-material/Scale";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useTranslation } from "react-i18next";
import { useAdminMode } from "../admin/AdminMode";
import { useContentTranslation } from "../i18n/ContentTranslation";
import {
  collectRecipeContentTexts,
  displayIngredientName,
  displayRecipeName,
  displayRecipeNotes,
  scoreRecipeSearch,
  type ContentLang,
  type ContentTranslateFn,
} from "../i18n/recipeDisplay";
import { buildRecipeSpeechSegments } from "../lib/speakRecipe";
import {
  colors,
  deleteButtonSx,
  editButtonSx,
  floatingCardShadow,
  floatingCardShadowHover,
  primaryButtonSx,
  surfaceSx,
} from "../theme";
import { MEAL_CATEGORIES, type MealCategory, type Recipe } from "../types";
import { QuickGlanceDialog } from "./QuickGlanceDialog";
import { SpeakRecipeButton } from "./SpeakRecipeButton";

interface Props {
  recipes: Recipe[];
  loading: boolean;
  onAdd: () => void;
  onScale: (id: string) => void;
  onEdit: (recipe: Recipe) => void;
  onDelete: (recipe: Recipe) => void;
}

function normalizeCategory(category: string): MealCategory {
  const c = category.trim().toLowerCase();
  if (c === "breakfast" || c.includes("breakfast") || c.includes("காலை") || c.includes("नाश्ता")) {
    return "Breakfast";
  }
  if (c === "dinner" || c.includes("dinner") || c.includes("இரவு") || c.includes("रात")) {
    return "Dinner";
  }
  return "Lunch";
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function speechLangFor(lang: string): string {
  if (lang === "ta") return "ta-IN";
  if (lang === "hi") return "hi-IN";
  return "en-IN";
}

function recipeSpeechSegments(
  recipe: Recipe,
  lang: ContentLang,
  tContent: ContentTranslateFn,
  t: (key: string, opts?: Record<string, unknown>) => string
): string[] {
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
}

export function RecipeList({ recipes, loading, onAdd, onScale, onEdit, onDelete }: Props) {
  const { t } = useTranslation();
  const { lang, tContent, tMany } = useContentTranslation();
  const { isAdmin } = useAdminMode();
  const theme = useTheme();
  const [glanceRecipe, setGlanceRecipe] = useState<Recipe | null>(null);

  useEffect(() => {
    if (lang === "en" || !recipes.length) return;
    tMany(recipes.flatMap(collectRecipeContentTexts));
  }, [lang, recipes, tMany]);
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const ditheredSx = {
    opacity: 0.4,
    filter: "grayscale(0.5)",
    WebkitFilter: "grayscale(0.5)",
  };

  const ditheredDisabledSx = {
    "&.Mui-disabled": {
      opacity: "0.4 !important",
      filter: "grayscale(0.5) !important",
      WebkitFilter: "grayscale(0.5) !important",
      cursor: "not-allowed",
    },
  };
  const [query, setQuery] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceSupported] = useState(() => !!getSpeechRecognitionCtor());
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<MealCategory[]>([...MEAL_CATEGORIES]);
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
  }, []);

  const stopVoiceSearch = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  };

  const clearSearch = () => {
    stopVoiceSearch();
    setQuery("");
  };

  const toggleVoiceSearch = () => {
    if (!voiceSupported) return;
    if (listening) {
      stopVoiceSearch();
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    try {
      recognitionRef.current?.abort();
    } catch {
      /* ignore */
    }

    const recognition = new Ctor();
    recognition.lang = speechLangFor(lang);
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) setQuery(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;

    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const filtered = useMemo(() => {
    return recipes
      .map((r) => ({ recipe: r, score: scoreRecipeSearch(r, query) }))
      .filter(({ recipe, score }) => {
        if (score <= 0) return false;
        return selectedCategories.includes(normalizeCategory(recipe.category));
      })
      .sort((a, b) => b.score - a.score)
      .map(({ recipe }) => recipe);
  }, [recipes, query, selectedCategories]);

  const byCategory = useMemo(() => {
    const map: Record<MealCategory, Recipe[]> = {
      Breakfast: [],
      Lunch: [],
      Dinner: [],
    };
    for (const recipe of filtered) {
      map[normalizeCategory(recipe.category)].push(recipe);
    }
    return map;
  }, [filtered]);

  const visibleCategories = MEAL_CATEGORIES.filter((c) => byCategory[c].length > 0);
  const filterActive = selectedCategories.length !== MEAL_CATEGORIES.length;

  const toggleCategory = (category: MealCategory) => {
    setSelectedCategories((prev) => {
      if (prev.includes(category)) {
        const next = prev.filter((c) => c !== category);
        return next.length ? next : prev;
      }
      return [...prev, category];
    });
  };

  if (loading) {
    return (
      <Box aria-busy aria-live="polite" aria-label={t("common.loading")}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
          spacing={{ xs: 1.5, sm: 2 }}
          sx={{ mb: 2.5 }}
        >
          <Skeleton variant="text" width={isMobile ? "55%" : 220} height={isMobile ? 36 : 44} />
          <Skeleton variant="rounded" width={isMobile ? "100%" : 120} height={40} sx={{ borderRadius: "10px" }} />
        </Stack>
        <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
          <Skeleton variant="rounded" height={40} sx={{ flex: 1, borderRadius: "10px" }} />
          <Skeleton variant="rounded" width={44} height={40} sx={{ borderRadius: "10px" }} />
        </Stack>
        <Skeleton variant="text" width={140} height={28} sx={{ mb: 1.5 }} />
        <Stack spacing={2.5}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Box
              key={i}
              sx={{
                p: { xs: 2, sm: 2.5 },
                ...surfaceSx,
                boxShadow: floatingCardShadow,
              }}
            >
              <Skeleton variant="text" width="45%" height={28} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="70%" height={18} sx={{ mb: 2 }} />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Skeleton variant="rounded" height={36} sx={{ flex: 1, borderRadius: "10px" }} />
                <Skeleton variant="rounded" height={36} sx={{ flex: 1, borderRadius: "10px" }} />
              </Stack>
            </Box>
          ))}
        </Stack>
      </Box>
    );
  }

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        spacing={{ xs: 1.5, sm: 2 }}
        sx={{ mb: 2.5 }}
      >
        <Typography
          variant={isMobile ? "h5" : "h4"}
          component="h1"
          sx={{
            wordBreak: "break-word",
            minWidth: 0,
            flex: { sm: "1 1 auto" },
            fontSize: { sm: "1.65rem", md: "1.85rem" },
            lineHeight: 1.25,
          }}
        >
          {t("app.brand")}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onAdd}
          disabled={!isAdmin}
          fullWidth={isMobile}
          title={!isAdmin ? t("admin.lockedHint") : undefined}
          sx={{
            flexShrink: 0,
            alignSelf: { xs: "stretch", sm: "center" },
            maxWidth: { sm: "fit-content" },
            ...primaryButtonSx,
            ...(!isAdmin ? ditheredSx : {}),
            ...ditheredDisabledSx,
            "&.Mui-disabled": {
              ...ditheredDisabledSx["&.Mui-disabled"],
              bgcolor: `${colors.brand} !important`,
              color: "#FFFFFF !important",
            },
          }}
        >
          {t("nav.add")}
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 3 }} alignItems="stretch">
        <TextField
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={listening ? t("list.voiceSearchListening") : t("list.searchPlaceholder")}
          aria-label={t("list.search")}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: colors.slate }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end" sx={{ gap: 0.25 }}>
                {!!query && (
                  <IconButton
                    size="small"
                    aria-label={t("list.searchClear")}
                    onClick={clearSearch}
                    edge="end"
                    sx={{ color: colors.slate }}
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                )}
                <IconButton
                  size="small"
                  aria-label={
                    !voiceSupported
                      ? t("list.voiceSearchUnsupported")
                      : listening
                        ? t("list.voiceSearchListening")
                        : t("list.voiceSearch")
                  }
                  title={
                    !voiceSupported
                      ? t("list.voiceSearchUnsupported")
                      : listening
                        ? t("list.voiceSearchListening")
                        : t("list.voiceSearch")
                  }
                  onClick={toggleVoiceSearch}
                  disabled={!voiceSupported}
                  edge="end"
                  sx={{
                    color: listening ? "#BE123C" : colors.darkStone,
                    bgcolor: listening ? "rgba(190, 18, 60, 0.08)" : "transparent",
                    borderRadius: "10px",
                    "&:hover": {
                      bgcolor: listening ? "rgba(190, 18, 60, 0.14)" : colors.editBg,
                    },
                    "&.Mui-disabled": {
                      color: colors.slate,
                      opacity: 0.45,
                    },
                  }}
                >
                  {listening ? <MicIcon fontSize="small" /> : <MicNoneIcon fontSize="small" />}
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{
            flex: 1,
            borderRadius: "12px",
            boxShadow: floatingCardShadow,
            "& .MuiOutlinedInput-root": {
              borderRadius: "12px",
              bgcolor: colors.surfaceSolid,
              "& fieldset": {
                borderColor: listening ? "rgba(190, 18, 60, 0.45)" : colors.borderWarm,
              },
              "&.Mui-focused fieldset": {
                borderColor: listening ? "#BE123C" : undefined,
              },
            },
          }}
        />
        <Badge
          color="primary"
          variant="dot"
          invisible={!filterActive}
          sx={{
            alignSelf: "stretch",
            display: "flex",
            "& .MuiBadge-badge": { top: 10, right: 10 },
          }}
        >
          <Button
            variant="outlined"
            startIcon={!isMobile ? <FilterListIcon /> : undefined}
            onClick={(e) => setFilterAnchor(e.currentTarget)}
            aria-label={t("list.filter")}
            sx={{
              minWidth: { xs: 48, sm: 120 },
              width: { xs: 48, sm: "auto" },
              height: "100%",
              minHeight: 56,
              px: { xs: 0, sm: 2 },
              bgcolor: colors.surfaceSolid,
              color: colors.darkStone,
              borderColor: colors.borderWarm,
              borderRadius: "12px",
              boxShadow: floatingCardShadow,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              "&:hover": {
                bgcolor: colors.editBg,
                borderColor: colors.borderWarm,
              },
            }}
          >
            {isMobile ? <FilterListIcon /> : t("list.filter")}
          </Button>
        </Badge>
      </Stack>

      <Menu
        anchorEl={filterAnchor}
        open={!!filterAnchor}
        onClose={() => setFilterAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              minWidth: 220,
              borderRadius: "16px",
              boxShadow: floatingCardShadow,
              p: 1,
            },
          },
        }}
      >
        <Typography variant="subtitle2" sx={{ px: 1.5, py: 1 }}>
          {t("list.filterByCategory")}
        </Typography>
        <Divider sx={{ mb: 0.5 }} />
        <FormGroup sx={{ px: 1.5, py: 0.5 }}>
          {MEAL_CATEGORIES.map((category) => (
            <FormControlLabel
              key={category}
              control={
                <Checkbox
                  checked={selectedCategories.includes(category)}
                  onChange={() => toggleCategory(category)}
                  size="small"
                />
              }
              label={t(`categories.${category}`)}
            />
          ))}
        </FormGroup>
        <Divider sx={{ my: 0.5 }} />
        <Button
          fullWidth
          size="small"
          onClick={() => setSelectedCategories([...MEAL_CATEGORIES])}
          sx={{ justifyContent: "flex-start", px: 1.5 }}
        >
          {t("list.filterReset")}
        </Button>
      </Menu>

      {!recipes.length && (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          {t("list.empty")}
        </Typography>
      )}

      {!!recipes.length && !filtered.length && (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          {t("list.emptySearch")}
        </Typography>
      )}

      <Stack spacing={4}>
        {visibleCategories.map((category) => {
          const items = byCategory[category];
          return (
            <Box key={category} component="section" sx={{ minWidth: 0, width: "100%" }}>
              <Typography
                variant="h6"
                sx={{
                  mb: 1.5,
                  pb: 0.75,
                  width: "100%",
                  maxWidth: "100%",
                  display: "block",
                  fontSize: { xs: "1.05rem", sm: "1.25rem" },
                  lineHeight: 1.35,
                  whiteSpace: "normal",
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                  backgroundImage:
                    "linear-gradient(90deg, #2563EB 0%, #7C3AED 55%, #A855F7 100%)",
                  backgroundSize: "100% 2.5px",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "bottom",
                }}
              >
                {t(`categories.${category}`)}
              </Typography>

              <Stack spacing={2.5} sx={{ mt: 1.5 }}>
                {items.map((recipe, index) => (
                  <Box
                    key={recipe.id}
                    className="fade-slide"
                    sx={{
                      animationDelay: `${index * 50}ms`,
                      p: { xs: 2, sm: 2.5 },
                      ...surfaceSx,
                      boxShadow: floatingCardShadow,
                      display: "grid",
                      gap: 2,
                      gridTemplateColumns: { xs: "1fr", md: "1fr auto" },
                      alignItems: "center",
                      transition: "transform 0.25s ease, box-shadow 0.25s ease",
                      "&:hover": {
                        transform: { md: "translateY(-4px)" },
                        boxShadow: { md: floatingCardShadowHover },
                      },
                    }}
                  >
                    <Box sx={{ minWidth: 0, overflow: "hidden" }}>
                      <Stack direction="row" alignItems="flex-start" spacing={1}>
                        <Typography
                          variant={isMobile ? "h6" : "h5"}
                          component="h3"
                          sx={{
                            wordBreak: "break-word",
                            color: colors.charcoal,
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          {displayRecipeName(recipe, lang, tContent)}
                        </Typography>
                        {isMobile && (
                          <Stack direction="row" spacing={1} className="no-print" sx={{ flexShrink: 0, mt: 0.15 }}>
                            <SpeakRecipeButton
                              speakerKey={`list-mobile-${recipe.id}`}
                              text={recipeSpeechSegments(recipe, lang, tContent, t)}
                              lang={lang}
                            />
                            <IconButton
                              aria-label={t("list.edit")}
                              onClick={() => onEdit(recipe)}
                              disabled={!isAdmin}
                              title={!isAdmin ? t("admin.lockedHint") : undefined}
                              sx={{
                                ...editButtonSx,
                                borderRadius: "12px",
                                width: 44,
                                height: 44,
                                flexShrink: 0,
                                ...(!isAdmin ? ditheredSx : {}),
                                ...ditheredDisabledSx,
                                "&.Mui-disabled": {
                                  ...ditheredDisabledSx["&.Mui-disabled"],
                                  bgcolor: "#F4F4F5 !important",
                                  color: `${colors.darkStone} !important`,
                                  borderColor: "rgba(28, 25, 23, 0.08) !important",
                                  boxShadow: "none",
                                },
                              }}
                            >
                              <EditOutlinedIcon />
                            </IconButton>
                          </Stack>
                        )}
                      </Stack>
                      <Typography variant="body2" sx={{ mt: 1.25, color: colors.slate }}>
                        {t("list.servings")}: <strong style={{ color: colors.charcoal }}>{recipe.baseServings}</strong>
                        {" · "}
                        {recipe.ingredients.length} {t("list.ingredients")}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.75, color: colors.slate }}>
                        {recipe.ingredients
                          .map((ing) => {
                            const name = displayIngredientName(recipe, ing.id, ing.name, lang, tContent);
                            if (ing.soak && ing.soakDuration != null) {
                              return `${name} (${t("form.soak")} ${ing.soakDuration} ${t(`form.soakUnits.${ing.soakUnit || "minutes"}`)})`;
                            }
                            return name;
                          })
                          .join(" · ")}
                      </Typography>
                    </Box>

                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      className="no-print"
                      sx={{ width: { xs: "100%", md: "auto" } }}
                    >
                      {isMobile ? (
                        <>
                          <IconButton
                            aria-label={t("list.glance")}
                            onClick={() => setGlanceRecipe(recipe)}
                            title={t("list.glance")}
                            sx={{
                              ...editButtonSx,
                              borderRadius: "12px",
                              width: 44,
                              height: 44,
                              flexShrink: 0,
                            }}
                          >
                            <VisibilityOutlinedIcon />
                          </IconButton>
                          <Button
                            fullWidth
                            variant="contained"
                            startIcon={<ScaleIcon />}
                            onClick={() => onScale(recipe.id)}
                            sx={{ ...primaryButtonSx, flex: 1 }}
                          >
                            {t("list.scale")}
                          </Button>
                          <IconButton
                            aria-label={t("list.delete")}
                            onClick={() => onDelete(recipe)}
                            disabled={!isAdmin}
                            title={!isAdmin ? t("admin.lockedHint") : undefined}
                            sx={{
                              ...deleteButtonSx,
                              borderRadius: "12px",
                              width: 44,
                              height: 44,
                              flexShrink: 0,
                              ...(!isAdmin ? ditheredSx : {}),
                              ...ditheredDisabledSx,
                              "&.Mui-disabled": {
                                ...ditheredDisabledSx["&.Mui-disabled"],
                                bgcolor: "#F7F2F3 !important",
                                color: `${colors.deleteText} !important`,
                                borderColor: "rgba(190, 18, 60, 0.12) !important",
                                boxShadow: "none",
                              },
                            }}
                          >
                            <DeleteOutlineIcon />
                          </IconButton>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="contained"
                            startIcon={<ScaleIcon />}
                            onClick={() => onScale(recipe.id)}
                            sx={primaryButtonSx}
                          >
                            {t("list.scale")}
                          </Button>
                          <Button
                            variant="outlined"
                            startIcon={<VisibilityOutlinedIcon />}
                            onClick={() => setGlanceRecipe(recipe)}
                            sx={{
                              ...editButtonSx,
                              borderRadius: "12px",
                            }}
                          >
                            {t("list.glance")}
                          </Button>
                          <SpeakRecipeButton
                            variant="button"
                            speakerKey={`list-desktop-${recipe.id}`}
                            text={recipeSpeechSegments(recipe, lang, tContent, t)}
                            lang={lang}
                          />
                          <Button
                            variant="outlined"
                            startIcon={<EditOutlinedIcon />}
                            onClick={() => onEdit(recipe)}
                            disabled={!isAdmin}
                            title={!isAdmin ? t("admin.lockedHint") : undefined}
                            sx={{
                              ...editButtonSx,
                              borderRadius: "12px",
                              ...(!isAdmin ? ditheredSx : {}),
                              ...ditheredDisabledSx,
                              "&.Mui-disabled": {
                                ...ditheredDisabledSx["&.Mui-disabled"],
                                bgcolor: "#F4F4F5 !important",
                                color: `${colors.darkStone} !important`,
                                borderColor: "rgba(28, 25, 23, 0.08) !important",
                                boxShadow: "none",
                              },
                            }}
                          >
                            {t("list.edit")}
                          </Button>
                          <Button
                            variant="outlined"
                            startIcon={<DeleteOutlineIcon />}
                            onClick={() => onDelete(recipe)}
                            disabled={!isAdmin}
                            title={!isAdmin ? t("admin.lockedHint") : undefined}
                            sx={{
                              ...deleteButtonSx,
                              borderRadius: "12px",
                              ...(!isAdmin ? ditheredSx : {}),
                              ...ditheredDisabledSx,
                              "&.Mui-disabled": {
                                ...ditheredDisabledSx["&.Mui-disabled"],
                                bgcolor: "#F7F2F3 !important",
                                color: `${colors.deleteText} !important`,
                                borderColor: "rgba(190, 18, 60, 0.12) !important",
                                boxShadow: "none",
                              },
                            }}
                          >
                            {t("list.delete")}
                          </Button>
                        </>
                      )}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Box>
          );
        })}
      </Stack>

      <QuickGlanceDialog
        recipe={glanceRecipe}
        open={!!glanceRecipe}
        onClose={() => setGlanceRecipe(null)}
      />
    </Box>
  );
}
