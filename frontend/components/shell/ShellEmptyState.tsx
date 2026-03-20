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
        borderRadius: 3,
        borderColor: "rgba(148, 163, 184, 0.28)",
        boxShadow: "none",
        background: "linear-gradient(180deg, rgba(248,250,252,0.96), rgba(255,255,255,0.96))",
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
