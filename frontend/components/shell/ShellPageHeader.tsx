import { Box, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

type ShellPageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function ShellPageHeader({ title, description, actions }: ShellPageHeaderProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 2.2,
      }}
      >
      <Stack spacing={0.75} sx={{ minWidth: 0 }}>
        <Typography component="h1" variant="h4" fontWeight={900} sx={{ letterSpacing: 0, color: "#0f172a" }}>
          {title}
        </Typography>
        {description ? (
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 760, lineHeight: 1.65 }}>
            {description}
          </Typography>
        ) : null}
      </Stack>
      {actions ? <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>{actions}</Box> : null}
    </Box>
  );
}
