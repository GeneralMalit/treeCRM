import { Container, Paper, Stack, Typography } from "@mui/material";

export default function LoginPage() {
  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper elevation={1} sx={{ p: 4 }}>
        <Stack spacing={1}>
          <Typography variant="h5">Login</Typography>
          <Typography color="text.secondary">
            Placeholder login page. Session 2 will implement authentication and role redirects.
          </Typography>
        </Stack>
      </Paper>
    </Container>
  );
}

