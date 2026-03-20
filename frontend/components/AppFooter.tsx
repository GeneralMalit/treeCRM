import { Box, Container, Typography } from "@mui/material";
import { APP_FOOTER_TEXT } from "@/lib/appMeta";

export function AppFooter() {
  return (
    <Box
      component="footer"
      sx={{
        borderTop: "1px solid rgba(148, 163, 184, 0.35)",
        backgroundColor: "#f8fafc",
        mt: "auto",
      }}
    >
      <Container maxWidth="lg" sx={{ py: 1.75 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ textAlign: "center", display: "block", fontFamily: "var(--font-geist-sans)" }}
        >
          {APP_FOOTER_TEXT}
        </Typography>
      </Container>
    </Box>
  );
}
