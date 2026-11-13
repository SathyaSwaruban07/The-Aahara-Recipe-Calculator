import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { primaryButtonSx } from "../theme";

const ADMIN_USER = import.meta.env.VITE_ADMIN_USER || "admin";
const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS || "admin@TheAahara";
const STORAGE_KEY = "recipe-proportions-admin";

function readAdminStatus(): boolean {
  try {
    if (localStorage.getItem(STORAGE_KEY) === "1") return true;
    // migrate older session-only unlocks once
    if (sessionStorage.getItem(STORAGE_KEY) === "1") {
      localStorage.setItem(STORAGE_KEY, "1");
      sessionStorage.removeItem(STORAGE_KEY);
      return true;
    }
  } catch {
    /* private mode / blocked storage */
  }
  return false;
}

interface AdminCtx {
  isAdmin: boolean;
  requestAdmin: () => void;
  exitAdmin: () => void;
}

const AdminModeContext = createContext<AdminCtx | null>(null);

export function AdminModeProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(readAdminStatus);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  const requestAdmin = useCallback(() => {
    if (isAdmin) return;
    setUsername("");
    setPassword("");
    setError(null);
    setDialogOpen(true);
  }, [isAdmin]);

  const exitAdmin = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setIsAdmin(false);
  }, []);

  const blurFocus = () => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  };

  const submit = () => {
    if (username.trim() === ADMIN_USER && password === ADMIN_PASS) {
      try {
        localStorage.setItem(STORAGE_KEY, "1");
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setIsAdmin(true);
      setDialogOpen(false);
      setError(null);
      // Don't leave keyboard/focus on the Admin mode switch after unlock
      window.setTimeout(blurFocus, 0);
      return;
    }
    setError(t("admin.invalidCredentials"));
  };

  const value = useMemo(
    () => ({ isAdmin, requestAdmin, exitAdmin }),
    [isAdmin, requestAdmin, exitAdmin]
  );

  return (
    <AdminModeContext.Provider value={value}>
      {children}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        disableRestoreFocus
        TransitionProps={{
          onExited: blurFocus,
        }}
      >
        <DialogTitle>{t("admin.loginTitle")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label={t("admin.username")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label={t("admin.password")}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              InputLabelProps={{ shrink: true }}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
          <Button variant="contained" onClick={submit} sx={primaryButtonSx}>
            {t("admin.unlock")}
          </Button>
        </DialogActions>
      </Dialog>
    </AdminModeContext.Provider>
  );
}

export function useAdminMode() {
  const ctx = useContext(AdminModeContext);
  if (!ctx) throw new Error("useAdminMode must be used within AdminModeProvider");
  return ctx;
}
