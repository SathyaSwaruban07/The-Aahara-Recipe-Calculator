import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline, ThemeProvider } from "@mui/material";
import App from "./App";
import { theme } from "./theme";
import { ContentTranslationProvider } from "./i18n/ContentTranslation";
import { AdminModeProvider } from "./admin/AdminMode";
import "./i18n";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ContentTranslationProvider>
        <AdminModeProvider>
          <App />
        </AdminModeProvider>
      </ContentTranslationProvider>
    </ThemeProvider>
  </StrictMode>
);
