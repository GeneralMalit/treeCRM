import { Button, Paper, Stack, Typography } from "@mui/material";

type ShellEmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function ShellEmptyState({ title, description, actionLabel, onAction }: ShellEmptyStateProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        borderRadius: 2,
        borderColor: "rgba(100, 116, 139, 0.20)",
        boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
        background: "linear-gradient(180deg, rgba(248,250,252,0.96), rgba(255,255,255,0.98))",
      }}
    >
      <Stack spacing={1.5}>
        <Typography variant="h6" fontWeight={800}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
        {actionLabel && onAction ? (
          <Button onClick={onAction} variant="contained" sx={{ alignSelf: "flex-start" }}>
            {actionLabel}
          </Button>
        ) : null}
      </Stack>
    </Paper>
  );
}
