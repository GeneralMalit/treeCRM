import Link from "next/link";
import { Box, Typography, type SxProps, type Theme } from "@mui/material";

type BrandMarkProps = {
  href?: string;
  compact?: boolean;
  sx?: SxProps<Theme>;
};

export function BrandMark({ href = "/", compact = false, sx }: BrandMarkProps) {
  const content = (
    <>
      <Box
        aria-hidden
        sx={{
          position: "relative",
          width: compact ? 26 : 32,
          height: compact ? 26 : 32,
          flexShrink: 0,
        }}
      >
        <Box sx={{ position: "absolute", left: "20%", right: "20%", top: "48%", height: 2, bgcolor: "#0f5132" }} />
        <Box sx={{ position: "absolute", top: "20%", bottom: "20%", left: "48%", width: 2, bgcolor: "#0f5132" }} />
        {[
          { left: 0, top: "37%", color: "#14b8a6" },
          { left: "37%", top: 0, color: "#16a34a" },
          { right: 0, top: "37%", color: "#0284c7" },
          { left: "37%", bottom: 0, color: "#0f5132" },
        ].map((node, index) => (
          <Box
            key={index}
            sx={{
              position: "absolute",
              width: compact ? 8 : 9,
              height: compact ? 8 : 9,
              borderRadius: "50%",
              border: "2px solid #ffffff",
              boxShadow: "0 1px 4px rgba(15, 23, 42, 0.14)",
              bgcolor: node.color,
              ...node,
            }}
          />
        ))}
      </Box>
      <Typography
        variant={compact ? "subtitle1" : "h6"}
        fontWeight={900}
        sx={{ color: "#0f5132", lineHeight: 1, letterSpacing: 0 }}
      >
        TreeCRM
      </Typography>
    </>
  );

  return (
    <Box
      component={Link}
      href={href}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: compact ? 1 : 1.15,
        color: "inherit",
        textDecoration: "none",
        ...sx,
      }}
    >
      {content}
    </Box>
  );
}
