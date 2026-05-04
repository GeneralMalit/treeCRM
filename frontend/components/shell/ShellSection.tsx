import { Paper, type PaperProps } from "@mui/material";

type ShellSectionProps = PaperProps;

export function ShellSection({ children, sx, ...props }: ShellSectionProps) {
  return (
    <Paper
      variant="outlined"
      {...props}
      sx={{
        p: { xs: 2, sm: 2.5, lg: 3 },
        borderColor: "rgba(100, 116, 139, 0.20)",
        boxShadow: "0 14px 36px rgba(15, 23, 42, 0.04)",
        backgroundImage: "none",
        backgroundColor: "#ffffff",
        borderRadius: 2,
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}
