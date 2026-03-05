import { Container, Paper, Stack, Typography } from "@mui/material";

export default function EmployeePage() {
  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Paper elevation={1} sx={{ p: 4 }}>
        <Stack spacing={1}>
          <Typography variant="h5">Employee Interface</Typography>
          <Typography color="text.secondary">
            Placeholder for the hierarchical tree control center (CSR, Manager, Executive, Admin).
          </Typography>
        </Stack>
      </Paper>
    </Container>
  );
}

