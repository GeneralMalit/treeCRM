import { Box, Paper, Stack, Typography } from "@mui/material";

type ShellStatItem = {
  label: string;
  value: string;
  detail?: string;
};

type ShellStatStripProps = {
  items: ShellStatItem[];
};

export function ShellStatStrip({ items }: ShellStatStripProps) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, minmax(0, 1fr))",
          xl: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))`,
        },
        gap: 2,
      }}
    >
      {items.map((item) => (
        <Paper
          key={item.label}
          variant="outlined"
          sx={{
            p: 2,
            borderColor: "rgba(148, 163, 184, 0.28)",
            boxShadow: "none",
            borderRadius: 3,
          }}
        >
          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary">
              {item.label}
            </Typography>
            <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: "-0.03em" }}>
              {item.value}
            </Typography>
            {item.detail ? (
              <Typography variant="caption" color="text.secondary">
                {item.detail}
              </Typography>
            ) : null}
          </Stack>
        </Paper>
      ))}
    </Box>
  );
}
