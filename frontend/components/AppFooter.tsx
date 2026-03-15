import { Box, Container, Typography } from "@mui/material";
import { APP_FOOTER_TEXT } from "@/lib/appMeta";

export function AppFooter() {
  return (
    <Box
      component="footer"
      sx={{
        borderTop: "1px solid #E5E7EB",
        backgroundColor: "#F8FAFC",
        mt: "auto",
      }}
    >
      <Container maxWidth="lg" sx={{ py: 2.5 }}>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ textAlign: "center", fontFamily: "var(--font-geist-sans)" }}
        >
          {APP_FOOTER_TEXT}
        </Typography>
      </Container>
    </Box>
  );
}
