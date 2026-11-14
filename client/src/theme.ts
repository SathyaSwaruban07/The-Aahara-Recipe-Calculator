import { createTheme } from "@mui/material/styles";

const googleSansStack =
  '"Google Sans", "Product Sans", "Noto Sans", "Noto Sans Tamil", "Noto Sans Devanagari", "Segoe UI", sans-serif';

/** Classy warm palette for lavender–peach mesh background */
export const colors = {
  brand: "#1C1917",
  brandHover: "#0C0A09",
  charcoal: "#111827",
  slate: "#4B5563",
  darkStone: "#292524",
  surface: "rgba(255, 255, 255, 0.96)",
  surfaceSolid: "#FFFFFF",
  border: "rgba(255, 255, 255, 0.8)",
  borderWarm: "#E7E5E4",
  editBg: "#FAF9F6",
  deleteBg: "#FFFFFF",
  deleteBorder: "#FECDD3",
  deleteText: "#BE123C",
} as const;

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: colors.brand,
      light: "#44403C",
      dark: colors.brandHover,
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: colors.darkStone,
      light: "#57534E",
      dark: "#1C1917",
    },
    error: {
      main: colors.deleteText,
      light: "#FFE4E6",
      dark: "#9F1239",
      contrastText: "#FFFFFF",
    },
    background: {
      default: "#F3EEF8",
      paper: colors.surfaceSolid,
    },
    text: {
      primary: colors.charcoal,
      secondary: colors.slate,
    },
    divider: "rgba(28, 25, 23, 0.08)",
  },
  typography: {
    fontFamily: googleSansStack,
    h1: { fontFamily: googleSansStack, fontWeight: 700, letterSpacing: "-0.02em", color: colors.charcoal },
    h2: { fontFamily: googleSansStack, fontWeight: 700, color: colors.charcoal },
    h3: { fontFamily: googleSansStack, fontWeight: 600, color: colors.charcoal },
    h4: { fontFamily: googleSansStack, fontWeight: 600, color: colors.charcoal },
    h5: { fontFamily: googleSansStack, fontWeight: 600, color: colors.charcoal },
    h6: { fontFamily: googleSansStack, fontWeight: 600, color: colors.charcoal },
    button: {
      fontFamily: googleSansStack,
      textTransform: "none",
      fontWeight: 600,
    },
    body1: { fontFamily: googleSansStack, color: colors.charcoal },
    body2: { fontFamily: googleSansStack, color: colors.slate },
    caption: { fontFamily: googleSansStack, color: colors.slate },
    overline: { fontFamily: googleSansStack, color: colors.slate },
    subtitle1: { fontFamily: googleSansStack },
    subtitle2: { fontFamily: googleSansStack },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: { fontFamily: googleSansStack },
        body: { fontFamily: googleSansStack },
        "*": { fontFamily: "inherit" },
        ":root": {
          "--color-brand": colors.brand,
          "--color-brand-hover": colors.brandHover,
          "--color-charcoal": colors.charcoal,
          "--color-slate": colors.slate,
          "--color-surface": colors.surface,
          "--color-border-warm": colors.borderWarm,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          paddingInline: 18,
          minHeight: 44,
        },
        containedPrimary: {
          backgroundColor: colors.brand,
          color: "#FFFFFF",
          boxShadow: "0 4px 12px rgba(28, 25, 23, 0.18)",
          "&:hover": {
            backgroundColor: colors.brandHover,
            boxShadow: "0 6px 16px rgba(28, 25, 23, 0.22)",
          },
        },
        outlinedPrimary: {
          borderColor: "rgba(28, 25, 23, 0.08)",
          borderWidth: 1,
          color: colors.darkStone,
          backgroundColor: "#F4F4F5",
          boxShadow: "0 1px 2px rgba(28, 25, 23, 0.05), 0 1px 3px rgba(28, 25, 23, 0.04)",
          "&:hover": {
            borderColor: "rgba(28, 25, 23, 0.12)",
            backgroundColor: "#EEEEF0",
            boxShadow: "0 2px 4px rgba(28, 25, 23, 0.07), 0 1px 2px rgba(28, 25, 23, 0.04)",
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: 44,
          minHeight: 44,
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: "rgba(28, 25, 23, 0.08)",
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        fullWidth: true,
        size: "medium",
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: colors.surfaceSolid,
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: colors.borderWarm,
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#D6D3D1",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: colors.brand,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
  },
});

/** Warm-plum tinted multi-layer shadow for pastel mesh backgrounds */
export const floatingCardShadow = [
  "0 1px 2px rgba(28, 25, 23, 0.04)",
  "0 4px 12px rgba(28, 25, 23, 0.05)",
].join(", ");

export const floatingCardShadowHover = [
  "0 2px 4px rgba(28, 25, 23, 0.05)",
  "0 8px 20px rgba(28, 25, 23, 0.07)",
].join(", ");

export const primaryButtonSx = {
  bgcolor: colors.brand,
  color: "#FFFFFF",
  borderRadius: "12px",
  boxShadow: "0 4px 12px rgba(28, 25, 23, 0.18)",
  "&:hover": {
    bgcolor: colors.brandHover,
    boxShadow: "0 6px 16px rgba(28, 25, 23, 0.22)",
  },
  // Prevent MUI disabled style from turning the espresso button into a solid black block
  "&.Mui-disabled": {
    bgcolor: `${colors.brand} !important`,
    color: "#FFFFFF !important",
    opacity: 0.55,
    boxShadow: "none",
  },
} as const;

/** Soft secondary actions — hairline edge, light grey, lift from shadow */
export const softControlShadow =
  "0 1px 2px rgba(28, 25, 23, 0.05), 0 1px 3px rgba(28, 25, 23, 0.04)";
export const softControlShadowHover =
  "0 2px 4px rgba(28, 25, 23, 0.07), 0 1px 2px rgba(28, 25, 23, 0.04)";

export const editButtonSx = {
  bgcolor: "#F4F4F5",
  color: colors.darkStone,
  border: "1px solid rgba(28, 25, 23, 0.08)",
  borderColor: "rgba(28, 25, 23, 0.08)",
  boxShadow: softControlShadow,
  "&:hover": {
    bgcolor: "#EEEEF0",
    borderColor: "rgba(28, 25, 23, 0.12)",
    boxShadow: softControlShadowHover,
  },
} as const;

export const deleteButtonSx = {
  bgcolor: "#F7F2F3",
  color: colors.deleteText,
  border: "1px solid rgba(190, 18, 60, 0.12)",
  borderColor: "rgba(190, 18, 60, 0.12)",
  boxShadow: softControlShadow,
  "&:hover": {
    bgcolor: "#FFF1F2",
    borderColor: "rgba(190, 18, 60, 0.2)",
    boxShadow: softControlShadowHover,
  },
} as const;

export const surfaceSx = {
  bgcolor: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: "20px",
  backdropFilter: "blur(10px)",
} as const;

/** Soft info callout for recipe notes */
export const notesCalloutSx = {
  bgcolor: "rgba(219, 234, 254, 0.65)",
  border: "1px solid rgba(37, 99, 235, 0.35)",
  borderRadius: "12px",
} as const;

export const notesCalloutLabelSx = {
  color: "#1D4ED8",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  display: "block",
};

/** Frosted glass panel (form / scale content) */
export const frostSurfaceSx = {
  borderRadius: "20px",
  bgcolor: "rgba(255, 255, 255, 0.45)",
  backdropFilter: "blur(8px)",
  border: "1px solid rgba(255, 255, 255, 0.55)",
} as const;

/** Shared Back to recipes control — solid white, compact */
export const backButtonSx = {
  bgcolor: "#FFFFFF",
  color: colors.darkStone,
  border: "1px solid rgba(28, 25, 23, 0.08)",
  borderRadius: "12px",
  boxShadow: softControlShadow,
  minHeight: 44,
  px: 2,
  width: "auto",
  alignSelf: "flex-start",
  "&:hover": {
    bgcolor: "#FAFAFA",
    borderColor: "rgba(28, 25, 23, 0.12)",
    boxShadow: softControlShadowHover,
  },
} as const;
