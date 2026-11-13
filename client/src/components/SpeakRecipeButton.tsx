import { useEffect, useId, useRef, useState } from "react";
import {
  Button,
  IconButton,
  Snackbar,
  Alert,
  Box,
  type ButtonProps,
  type IconButtonProps,
} from "@mui/material";
import VolumeUpOutlinedIcon from "@mui/icons-material/VolumeUpOutlined";
import { useTranslation } from "react-i18next";
import { colors, editButtonSx } from "../theme";
import {
  isSpeakerActive,
  speakText,
  stopSpeaking,
  type SpeakLang,
} from "../lib/speakRecipe";

function VoiceWave() {
  return (
    <Box component="span" className="voice-wave" aria-hidden>
      <span />
      <span />
      <span />
      <span />
    </Box>
  );
}

interface BaseProps {
  text: string | string[];
  lang: SpeakLang;
  disabled?: boolean;
  speakerKey?: string;
}

type IconMode = BaseProps & {
  variant?: "icon";
  iconSx?: IconButtonProps["sx"];
};

type ButtonMode = BaseProps & {
  variant: "button";
  fullWidth?: boolean;
  buttonSx?: ButtonProps["sx"];
};

type Props = IconMode | ButtonMode;

export function SpeakRecipeButton(props: Props) {
  const { t } = useTranslation();
  const { text, lang, disabled, speakerKey } = props;
  const reactId = useId();
  const speakerId = speakerKey || reactId;
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      // Keep wave visible for this button’s whole session OR while our click handler awaits
      setSpeaking(inFlightRef.current || isSpeakerActive(speakerId));
    }, 120);
    return () => window.clearInterval(id);
  }, [speakerId]);

  const toggle = async () => {
    if (disabled) return;

    // Cancel in-progress readout for this recipe
    if (inFlightRef.current || isSpeakerActive(speakerId)) {
      inFlightRef.current = false;
      stopSpeaking(speakerId);
      setSpeaking(false);
      return;
    }

    setError(null);
    inFlightRef.current = true;
    setSpeaking(true);

    try {
      const result = await speakText(text, lang, speakerId);
      if (!result.ok) {
        if (result.reason === "no-voice") {
          setError(
            lang === "ta"
              ? t("list.speakNoTamilVoice")
              : lang === "hi"
                ? t("list.speakNoHindiVoice")
                : t("list.speakUnsupported")
          );
        } else if (result.reason === "failed") {
          setError(t("list.speakFailed"));
        } else if (result.reason === "unsupported") {
          setError(t("list.speakUnsupported"));
        }
      }
    } finally {
      inFlightRef.current = false;
      setSpeaking(isSpeakerActive(speakerId));
    }
  };

  const label = speaking ? t("list.speakStop") : t("list.speak");
  const hasText = Array.isArray(text) ? text.length > 0 : !!text.trim();

  const snackbar = (
    <Snackbar
      open={!!error}
      autoHideDuration={7000}
      onClose={() => setError(null)}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Alert severity="info" onClose={() => setError(null)} sx={{ maxWidth: 420 }}>
        {error}
      </Alert>
    </Snackbar>
  );

  if (props.variant === "button") {
    return (
      <>
        <Button
          variant="outlined"
          startIcon={speaking ? <VoiceWave /> : <VolumeUpOutlinedIcon />}
          onClick={() => void toggle()}
          disabled={disabled || !hasText}
          fullWidth={props.fullWidth}
          title={label}
          aria-label={label}
          aria-pressed={speaking}
          sx={{
            ...editButtonSx,
            borderRadius: "12px",
            color: speaking ? "#BE123C" : colors.darkStone,
            ...(props.buttonSx || {}),
          }}
        >
          {speaking ? t("list.speakStop") : t("list.speak")}
        </Button>
        {snackbar}
      </>
    );
  }

  return (
    <>
      <IconButton
        aria-label={label}
        title={label}
        aria-pressed={speaking}
        onClick={() => void toggle()}
        disabled={disabled || !hasText}
        sx={{
          ...editButtonSx,
          borderRadius: "12px",
          width: 44,
          height: 44,
          flexShrink: 0,
          color: speaking ? "#BE123C" : colors.darkStone,
          "&.Mui-disabled": {
            bgcolor: "#F4F4F5 !important",
            color: `${colors.slate} !important`,
            borderColor: "rgba(28, 25, 23, 0.08) !important",
            boxShadow: "none",
            opacity: 0.45,
          },
          ...(props.iconSx || {}),
        }}
      >
        {speaking ? <VoiceWave /> : <VolumeUpOutlinedIcon />}
      </IconButton>
      {snackbar}
    </>
  );
}
