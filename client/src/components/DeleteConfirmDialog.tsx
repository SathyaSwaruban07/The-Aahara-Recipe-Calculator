import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { useTranslation } from "react-i18next";

interface Props {
  open: boolean;
  recipeName: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}

export function DeleteConfirmDialog({ open, recipeName, onCancel, onConfirm, busy }: Props) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{t("common.confirmDeleteTitle")}</DialogTitle>
      <DialogContent>
        <DialogContentText>{t("common.confirmDeleteBody", { name: recipeName })}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={busy}
          autoFocus
          sx={{ bgcolor: "#BE123C", "&:hover": { bgcolor: "#9F1239" } }}
        >
          {t("common.confirmDelete")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
