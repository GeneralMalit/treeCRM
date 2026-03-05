import { Container, Paper, Stack, Typography } from "@mui/material";

export default function CustomerPage() {
  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Paper elevation={1} sx={{ p: 4 }}>
        <Stack spacing={1}>
          <Typography variant="h5">Customer Portal</Typography>
          <Typography color="text.secondary">
            Placeholder for customer ticket dashboard and ticket detail pages.
          </Typography>
        </Stack>
      </Paper>
    </Container>
  );
}

