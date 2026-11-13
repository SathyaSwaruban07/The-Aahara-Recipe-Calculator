import { useEffect, useState } from "react";
import { Box, IconButton, Popover, Slider, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { readZoomPercent, writeZoomPercent } from "../lib/prefs";
import { colors } from "../theme";

/** Previous 113% (18px) is the default 100% */
const BASE_PX = 18;
const STEPS = [0.875, 1, 1.125, 1.25, 1.375] as const;
const DEFAULT_INDEX = 1;

/** Shared top-bar control height */
export const TOP_CONTROL_HEIGHT = 40;

function percentFor(index: number): number {
  return Math.round((STEPS[index] ?? 1) * 100);
}

function indexFromPercent(percent: number): number {
  let best = DEFAULT_INDEX;
  let bestDist = Infinity;
  STEPS.forEach((step, i) => {
    const dist = Math.abs(Math.round(step * 100) - percent);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  });
  return best;
}

function readIndex(): number {
  return indexFromPercent(readZoomPercent(percentFor(DEFAULT_INDEX)));
}

function applyScale(index: number) {
  const scale = STEPS[index] ?? 1;
  document.documentElement.style.fontSize = `${BASE_PX * scale}px`;
}

applyScale(readIndex());

export function FontScaleControl() {
  const { t } = useTranslation();
  const [index, setIndex] = useState(readIndex);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  useEffect(() => {
    applyScale(index);
    writeZoomPercent(percentFor(index));
  }, [index]);

  return (
    <>
      <IconButton
        size="small"
        aria-label={t("nav.fontSize")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? "font-scale-popover" : undefined}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          height: TOP_CONTROL_HEIGHT,
          width: TOP_CONTROL_HEIGHT,
          minWidth: TOP_CONTROL_HEIGHT,
          minHeight: TOP_CONTROL_HEIGHT,
          p: 0,
          borderRadius: "12px",
          bgcolor: "rgba(255,255,255,0.96)",
          border: "1px solid #E7E5E4",
          color: colors.darkStone,
          flexShrink: 0,
          boxSizing: "border-box",
          "&:hover": {
            bgcolor: "rgba(255,255,255,1)",
          },
        }}
      >
        <Typography component="span" sx={{ fontSize: "1rem", fontWeight: 700, lineHeight: 1 }}>
          A+
        </Typography>
      </IconButton>

      <Popover
        id="font-scale-popover"
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              px: 2,
              py: 1.5,
              width: 220,
              borderRadius: "12px",
              border: "1px solid #E7E5E4",
              boxShadow: "0 8px 24px rgba(28, 25, 23, 0.12)",
            },
          },
        }}
      >
        <Stack spacing={0.5}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="caption" sx={{ color: colors.slate, fontWeight: 600 }}>
              {t("nav.fontSize")}
            </Typography>
            <Typography variant="caption" sx={{ color: colors.charcoal, fontWeight: 700 }}>
              {percentFor(index)}%
            </Typography>
          </Stack>
          <Box sx={{ px: 0.5 }}>
            <Slider
              value={index}
              min={0}
              max={STEPS.length - 1}
              step={1}
              marks
              valueLabelDisplay="off"
              aria-label={t("nav.fontSize")}
              onChange={(_, value) => setIndex(Array.isArray(value) ? value[0] : value)}
              sx={{
                color: colors.brand,
                py: 1,
                "& .MuiSlider-mark": {
                  bgcolor: colors.borderWarm,
                },
              }}
            />
          </Box>
          <Stack direction="row" justifyContent="space-between" sx={{ px: 0.25 }}>
            <Typography component="span" sx={{ fontSize: "0.7rem", fontWeight: 700, color: colors.slate }}>
              A
            </Typography>
            <Typography component="span" sx={{ fontSize: "0.95rem", fontWeight: 700, color: colors.slate }}>
              A
            </Typography>
          </Stack>
        </Stack>
      </Popover>
    </>
  );
}
