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
            p: 2.1,
            borderColor: "rgba(100, 116, 139, 0.20)",
            boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
            borderRadius: 2,
            background:
              "linear-gradient(180deg, rgba(255,255,255,1), rgba(248,250,252,0.78))",
          }}
        >
          <Stack spacing={0.5}>
            <Typography variant="caption" color="text.secondary" fontWeight={900} sx={{ textTransform: "uppercase", letterSpacing: 0 }}>
              {item.label}
            </Typography>
            <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: 0, color: "#0f172a" }}>
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
