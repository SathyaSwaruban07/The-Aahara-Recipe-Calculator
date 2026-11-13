import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  Skeleton,
  Slider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useContentTranslation } from "../i18n/ContentTranslation";
import {
  collectRecipeContentTexts,
  displayIngredientName,
  displayRecipeName,
  displayRecipeNotes,
} from "../i18n/recipeDisplay";
import { buildRecipeSpeechSegments, stopSpeaking } from "../lib/speakRecipe";
import {
  backButtonSx,
  colors,
  floatingCardShadow,
  frostSurfaceSx,
  primaryButtonSx,
} from "../theme";
import type { ScaledRecipe } from "../types";
import { SpeakRecipeButton } from "./SpeakRecipeButton";

interface Props {
  recipeId: string;
  onBack: () => void;
}

export function ScaleView({ recipeId, onBack }: Props) {
  const { t } = useTranslation();
  const { lang, tContent, tMany } = useContentTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [target, setTarget] = useState<number | "">("");
  const [data, setData] = useState<ScaledRecipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [scaling, setScaling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultsAnimKey, setResultsAnimKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Single request: server defaults to the recipe's saved servings
        const scaled = await api.scaleRecipe(recipeId);
        if (cancelled) return;
        setTarget(scaled.targetServings);
        setData(scaled);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  useEffect(() => {
    if (!data || lang === "en") return;
    tMany(collectRecipeContentTexts(data));
  }, [data, lang, tMany]);

  useEffect(() => () => stopSpeaking(), []);

  const speechSegments = useMemo(() => {
    if (!data) return [] as string[];
    const portions = data.targetServings || data.baseServings;
    return buildRecipeSpeechSegments({
      recipeName: displayRecipeName(data, lang, tContent),
      servingsLabel: t("list.speakPortions", { count: portions }),
      introIngredients: t("list.speakIngredients"),
      ingredients: data.ingredients.map((ing) => ({
        name: displayIngredientName(data, ing.id, ing.name, lang, tContent),
        amountLabel: `${ing.displayAmount} ${t(`units.${ing.displayUnit}`)}`,
        soakLabel:
          ing.soak && ing.soakDuration != null
            ? `${t("form.soak")} ${ing.soakDuration} ${t(`form.soakUnits.${ing.soakUnit || "minutes"}`)}`
            : undefined,
      })),
      notes: displayRecipeNotes(data, lang, tContent) || undefined,
    });
  }, [data, lang, tContent, t]);

  const recalculate = async () => {
    if (target === "" || target <= 0) return;
    setScaling(true);
    setError(null);
    try {
      const scaled = await api.scaleRecipe(recipeId, target);
      setData(scaled);
      setResultsAnimKey((k) => k + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setScaling(false);
    }
  };

  if (loading && !data) {
    return <ScaleViewSkeleton isMobile={isMobile} onBack={onBack} backLabel={t("scale.back")} />;
  }

  if (error && !data) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!data) return null;

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={onBack} className="no-print" sx={{ ...backButtonSx, mb: 2 }}>
        {t("scale.back")}
      </Button>

      <Box
        sx={{
          p: { xs: 2, sm: 3 },
          ...frostSurfaceSx,
          boxShadow: floatingCardShadow,
        }}
      >
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        spacing={1}
        sx={{ mb: 2 }}
        className="no-print"
      >
        <Typography
          variant={isMobile ? "h5" : "h4"}
          component="h2"
          sx={{ wordBreak: "break-word", minWidth: 0, flex: 1 }}
        >
          {displayRecipeName(data, lang, tContent)}
        </Typography>
        <SpeakRecipeButton speakerKey={`scale-${data.id}`} text={speechSegments} lang={lang} />
      </Stack>

      <Box className="no-print" sx={{ mb: 3 }}>
        <Typography
          component="label"
          htmlFor="scale-target-servings"
          variant="body2"
          sx={{ color: colors.slate, display: "block", mb: 1 }}
        >
          {t("scale.to")} ({t("scale.people")})
        </Typography>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <Slider
            value={typeof target === "number" && target > 0 ? target : data.baseServings}
            min={1}
            max={Math.max(100, data.baseServings * 5)}
            step={1}
            valueLabelDisplay="auto"
            onChange={(_, value) => setTarget(Array.isArray(value) ? value[0] : value)}
            sx={{
              flex: 1,
              color: colors.brand,
              mx: { sm: 0.5 },
            }}
            aria-label={t("scale.to")}
          />
          <TextField
            id="scale-target-servings"
            type="number"
            size="small"
            variant="outlined"
            value={target === "" ? "" : target}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                setTarget("");
                return;
              }
              const n = Number(raw);
              if (Number.isFinite(n)) setTarget(Math.max(0, Math.floor(n)));
            }}
            inputProps={{ min: 1, step: 1, inputMode: "numeric" }}
            sx={{
              width: { xs: "100%", sm: 110 },
              flexShrink: 0,
              "& .MuiOutlinedInput-root": {
                borderRadius: "10px",
                bgcolor: "#FFFFFF",
              },
            }}
          />
          <Button
            fullWidth={isMobile}
            variant="contained"
            onClick={() => void recalculate()}
            disabled={scaling || target === "" || target <= 0}
            sx={{
              ...primaryButtonSx,
              flexShrink: 0,
            }}
          >
            {scaling ? t("common.loading") : t("list.scale")}
          </Button>
        </Stack>
      </Box>

      <Box
        key={resultsAnimKey}
        className={resultsAnimKey > 0 ? "scale-refresh" : undefined}
        sx={{ position: "relative" }}
        aria-busy={scaling}
      >
        {scaling && (
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              zIndex: 1,
              borderRadius: 2,
              bgcolor: "rgba(255,255,255,0.55)",
              backdropFilter: "blur(1px)",
            }}
          />
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("scale.factor")}: ×{data.scaleFactor.toFixed(4)}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {isMobile ? (
          <Stack spacing={1.5}>
            {data.ingredients.map((ing) => (
              <Box
                key={ing.id}
                sx={{
                  p: 2,
                  borderRadius: "12px",
                  bgcolor: "rgba(255, 255, 255, 0.45)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255, 255, 255, 0.55)",
                  boxShadow: floatingCardShadow,
                }}
              >
                <Typography fontWeight={600} sx={{ color: colors.charcoal }}>
                  {displayIngredientName(data, ing.id, ing.name, lang, tContent)}
                </Typography>
                {ing.soak && ing.soakDuration != null && (
                  <Typography
                    variant="body1"
                    sx={{ color: colors.charcoal, display: "block", mt: 0.75, fontWeight: 600 }}
                  >
                    {t("form.soak")}: {ing.soakDuration} {t(`form.soakUnits.${ing.soakUnit || "minutes"}`)}
                  </Typography>
                )}
                <Divider sx={{ my: 1 }} />
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Typography variant="body2" color="text.secondary">
                    {t("scale.original")}
                  </Typography>
                  <Typography variant="body2">
                    {ing.amount} {t(`units.${ing.unit}`)}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mt: 0.75 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t("scale.scaled")}
                  </Typography>
                  <Typography fontWeight={700} color="primary.dark">
                    {ing.displayAmount} {t(`units.${ing.displayUnit}`)}
                  </Typography>
                </Stack>
              </Box>
            ))}
          </Stack>
        ) : (
          <Box
            sx={{
              overflow: "auto",
              borderRadius: "12px",
              bgcolor: "rgba(255, 255, 255, 0.45)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255, 255, 255, 0.55)",
              boxShadow: floatingCardShadow,
            }}
          >
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t("scale.ingredient")}</TableCell>
                  <TableCell sx={{ fontSize: "1.05rem", fontWeight: 700 }}>{t("form.soak")}</TableCell>
                  <TableCell align="right">{t("scale.original")}</TableCell>
                  <TableCell align="right">{t("scale.scaled")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.ingredients.map((ing) => (
                  <TableRow key={ing.id} hover>
                    <TableCell>{displayIngredientName(data, ing.id, ing.name, lang, tContent)}</TableCell>
                    <TableCell sx={{ fontSize: "1.05rem", fontWeight: 600 }}>
                      {ing.soak && ing.soakDuration != null
                        ? `${ing.soakDuration} ${t(`form.soakUnits.${ing.soakUnit || "minutes"}`)}`
                        : "—"}
                    </TableCell>
                    <TableCell align="right">
                      {ing.amount} {t(`units.${ing.unit}`)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: "primary.dark" }}>
                      {ing.displayAmount} {t(`units.${ing.displayUnit}`)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {!!data.notes && (
          <Box
            sx={{
              mt: 2,
              p: 2,
              borderRadius: "12px",
              bgcolor: "rgba(254, 226, 226, 0.55)",
              border: "1px solid rgba(190, 18, 60, 0.45)",
              boxShadow: floatingCardShadow,
            }}
          >
            <Typography
              variant="overline"
              sx={{ color: colors.deleteText, letterSpacing: "0.08em", display: "block", mb: 0.75, fontWeight: 700 }}
            >
              {t("form.notes")}
            </Typography>
            <Typography sx={{ color: colors.charcoal, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {displayRecipeNotes(data, lang, tContent)}
            </Typography>
          </Box>
        )}
      </Box>
      </Box>
    </Box>
  );
}

function ScaleViewSkeleton({
  isMobile,
  onBack,
  backLabel,
}: {
  isMobile: boolean;
  onBack: () => void;
  backLabel: string;
}) {
  return (
    <Box aria-busy aria-live="polite">
      <Button startIcon={<ArrowBackIcon />} onClick={onBack} className="no-print" sx={{ ...backButtonSx, mb: 2 }}>
        {backLabel}
      </Button>

      <Box
        sx={{
          p: { xs: 2, sm: 3 },
          ...frostSurfaceSx,
          boxShadow: floatingCardShadow,
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
          <Skeleton variant="text" width={isMobile ? "70%" : 280} height={isMobile ? 36 : 44} />
          <Skeleton variant="rounded" width={40} height={36} sx={{ borderRadius: "10px", flexShrink: 0 }} />
        </Stack>

        <Box className="no-print" sx={{ mb: 3 }}>
          <Skeleton variant="text" width={140} height={20} sx={{ mb: 1 }} />
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", sm: "center" }}
          >
            <Skeleton variant="rounded" height={8} sx={{ flex: 1, borderRadius: 999 }} />
            <Skeleton variant="rounded" width={isMobile ? "100%" : 110} height={40} sx={{ borderRadius: "10px" }} />
            <Skeleton variant="rounded" width={isMobile ? "100%" : 96} height={40} sx={{ borderRadius: "10px" }} />
          </Stack>
        </Box>

        <Skeleton variant="text" width={120} height={20} sx={{ mb: 2 }} />

        {isMobile ? (
          <Stack spacing={1.5}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Box
                key={i}
                sx={{
                  p: 2,
                  borderRadius: "12px",
                  bgcolor: "rgba(255, 255, 255, 0.45)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255, 255, 255, 0.55)",
                  boxShadow: floatingCardShadow,
                }}
              >
                <Skeleton variant="text" width="55%" height={24} />
                <Divider sx={{ my: 1 }} />
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                  <Skeleton variant="text" width={72} height={18} />
                  <Skeleton variant="text" width={64} height={18} />
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Skeleton variant="text" width={64} height={18} />
                  <Skeleton variant="text" width={80} height={22} />
                </Stack>
              </Box>
            ))}
          </Stack>
        ) : (
          <Box
            sx={{
              overflow: "hidden",
              borderRadius: "12px",
              bgcolor: "rgba(255, 255, 255, 0.45)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255, 255, 255, 0.55)",
              boxShadow: floatingCardShadow,
              p: 2,
            }}
          >
            <Stack direction="row" spacing={2} sx={{ mb: 1.5, px: 1 }}>
              <Skeleton variant="text" width="28%" height={22} />
              <Skeleton variant="text" width="18%" height={22} />
              <Skeleton variant="text" width="18%" height={22} sx={{ ml: "auto" }} />
              <Skeleton variant="text" width="18%" height={22} />
            </Stack>
            {Array.from({ length: 5 }).map((_, i) => (
              <Stack key={i} direction="row" spacing={2} alignItems="center" sx={{ py: 1.25, px: 1 }}>
                <Skeleton variant="text" width="30%" height={20} />
                <Skeleton variant="text" width="16%" height={20} />
                <Skeleton variant="text" width="14%" height={20} sx={{ ml: "auto" }} />
                <Skeleton variant="text" width="16%" height={20} />
              </Stack>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
