import { Box, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { colors } from "../theme";
import type { PrepTreeNode } from "../lib/prepRecipes";

interface Props {
  nodes: PrepTreeNode[];
  /** Compact spacing for cards / form summary */
  dense?: boolean;
}

function TreeRows({ nodes, dense }: { nodes: PrepTreeNode[]; dense?: boolean }) {
  const { t } = useTranslation();
  return (
    <Stack spacing={dense ? 0.65 : 1}>
      {nodes.map((node) => (
        <Box key={node.key}>
          <Stack direction="row" justifyContent="space-between" spacing={1.5} alignItems="baseline">
            <Typography
              variant={dense ? "body2" : "body1"}
              sx={{
                color: colors.charcoal,
                fontWeight: node.isPrep || node.depth === 0 ? 600 : 500,
                minWidth: 0,
                wordBreak: "break-word",
                pl: node.depth * 1.75,
                borderLeft: node.depth > 0 ? `2px solid rgba(13, 148, 136, 0.35)` : undefined,
                ml: node.depth > 0 ? 0.5 : 0,
              }}
            >
              {node.depth > 0 ? (
                <Typography component="span" sx={{ color: colors.slate, mr: 0.75, fontWeight: 500 }}>
                  └
                </Typography>
              ) : null}
              {node.name}
              {node.isPrep ? (
                <Typography
                  component="span"
                  variant="caption"
                  sx={{ ml: 0.75, color: colors.slate, fontWeight: 600 }}
                >
                  ({t("scale.prepLine")})
                </Typography>
              ) : null}
            </Typography>
            <Typography
              variant={dense ? "body2" : "body1"}
              sx={{
                color: colors.charcoal,
                fontWeight: 700,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {node.amount} {t(`units.${node.unit}`)}
            </Typography>
          </Stack>
          {node.soak && node.soakDuration != null ? (
            <Typography
              variant="body2"
              sx={{
                mt: 0.2,
                color: colors.slate,
                fontWeight: 600,
                pl: node.depth * 1.75 + (node.depth > 0 ? 0.5 : 0),
              }}
            >
              {t("form.soak")}: {node.soakDuration} {t(`form.soakUnits.${node.soakUnit || "minutes"}`)}
            </Typography>
          ) : null}
          {node.children.length > 0 ? (
            <Box sx={{ mt: dense ? 0.5 : 0.75 }}>
              <TreeRows nodes={node.children} dense={dense} />
            </Box>
          ) : null}
        </Box>
      ))}
    </Stack>
  );
}

export function PrepIngredientTree({ nodes, dense }: Props) {
  const { t } = useTranslation();
  if (!nodes.length) {
    return (
      <Typography variant="body2" sx={{ color: colors.slate }}>
        {t("form.summaryEmpty")}
      </Typography>
    );
  }
  return <TreeRows nodes={nodes} dense={dense} />;
}
