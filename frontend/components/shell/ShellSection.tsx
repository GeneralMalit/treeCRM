import { Paper, type PaperProps } from "@mui/material";

type ShellSectionProps = PaperProps;

export function ShellSection({ children, sx, ...props }: ShellSectionProps) {
  return (
    <Paper
      variant="outlined"
      {...props}
      sx={{
        p: { xs: 2, sm: 2.5, lg: 3 },
        borderColor: "rgba(148, 163, 184, 0.28)",
        boxShadow: "none",
        backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(248,250,252,0.95))",
        borderRadius: 3,
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}
