"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Box, Button, Container, Paper, Stack, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { clearStoredAccessToken, getLandingRoute, getStoredAccessToken, me } from "@/lib/auth";

const navItems = [
  { label: "Product", href: "#product" },
  { label: "Portal", href: "#portal" },
  { label: "Operations", href: "#operations" },
  { label: "Security", href: "#security" },
];

const workflowSteps = [
  { label: "Customer portal", detail: "Ticket created with category, priority, and conversation context." },
  { label: "CSR workspace", detail: "Ownership, tags, status, notes, and customer chat stay beside the case." },
  { label: "Manager review", detail: "Escalations and reassignment decisions move through the same workspace." },
];

const ticketRows = [
  ["Login issue", "Open", "High", "Account Access"],
  ["Billing question", "In Progress", "Medium", "Billing"],
  ["Feature request", "Resolved", "Low", "Product"],
];

function ProductWindow({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        overflow: "hidden",
        borderRadius: 2,
        borderColor: "rgba(100, 116, 139, 0.22)",
        boxShadow: "0 24px 70px rgba(15, 23, 42, 0.10)",
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.25,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(100, 116, 139, 0.18)",
          bgcolor: "#ffffff",
        }}
      >
        <Stack direction="row" spacing={0.7} aria-hidden>
          {["#ef4444", "#f59e0b", "#10b981"].map((color) => (
            <Box key={color} sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color }} />
          ))}
        </Stack>
        <Typography variant="caption" fontWeight={800} color="text.secondary">
          {title}
        </Typography>
      </Box>
      {children}
    </Paper>
  );
}

function TreePreview() {
  return (
    <Box
      sx={{
        aspectRatio: "520 / 280",
        borderRadius: 1.5,
        bgcolor: "#f8fafc",
        border: "1px solid rgba(100, 116, 139, 0.18)",
        overflow: "hidden",
      }}
    >
      <Box
        component="img"
        src="/landing-tree-preview.svg"
        alt="Tree workspace hierarchy preview"
        sx={{
          display: "block",
          width: "100%",
          height: "100%",
        }}
      />
    </Box>
  );
}

function OperationsWorkspacePreview() {
  return (
    <Box sx={{ p: { xs: 2, md: 2.5 }, bgcolor: "#f8fafc" }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "0.58fr 1.42fr" }, gap: 2 }}>
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
          <Stack spacing={1.2}>
            {["Workspace", "Messages", "Escalations"].map((item, index) => (
              <Box
                key={item}
                sx={{
                  px: 1.2,
                  py: 0.9,
                  borderRadius: 1,
                  bgcolor: index === 0 ? "#e8f6ef" : "transparent",
                  color: index === 0 ? "#0f5132" : "#475569",
                  fontWeight: 800,
                  fontSize: "0.86rem",
                }}
              >
                {item}
              </Box>
            ))}
          </Stack>
        </Paper>
        <Stack spacing={2}>
          <TreePreview />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 1 }}>
            {["18 open cases", "4 high priority", "2 escalations"].map((item) => (
              <Paper key={item} variant="outlined" sx={{ p: 1.4, borderRadius: 1.5 }}>
                <Typography variant="body2" fontWeight={900}>
                  {item}
                </Typography>
              </Paper>
            ))}
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const accessToken = getStoredAccessToken();
      if (!accessToken) {
        setIsCheckingSession(false);
        return;
      }

      try {
        const user = await me(accessToken);
        router.replace(getLandingRoute(user.role));
      } catch {
        clearStoredAccessToken();
        setIsCheckingSession(false);
      }
    };

    void checkSession();
  }, [router]);

  if (isCheckingSession) {
    return (
      <Box sx={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Typography color="text.secondary">Checking your session...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: "#ffffff", color: "#0f172a" }}>
      <Box
        component="header"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          borderBottom: "1px solid rgba(100, 116, 139, 0.18)",
          bgcolor: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(18px)",
        }}
      >
        <Container maxWidth="xl" sx={{ minHeight: 72, display: "flex", alignItems: "center", gap: 3 }}>
          <BrandMark />
          <Stack
            component="nav"
            direction="row"
            spacing={0.5}
            sx={{ display: { xs: "none", md: "flex" }, ml: 2, flex: 1 }}
          >
            {navItems.map((item) => (
              <Button key={item.href} component="a" href={item.href} variant="text" color="inherit">
                {item.label}
              </Button>
            ))}
          </Stack>
          <Stack direction="row" spacing={1} sx={{ ml: "auto" }}>
            <Button component={Link} href="/login" variant="outlined">
              Sign in
            </Button>
            <Button component={Link} href="/login?mode=register" variant="contained" sx={{ display: { xs: "none", sm: "inline-flex" } }}>
              Create customer account
            </Button>
          </Stack>
        </Container>
      </Box>

      <Box component="main">
        <Box
          sx={{
            borderBottom: "1px solid rgba(100, 116, 139, 0.16)",
            background:
              "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
          }}
        >
          <Container
            maxWidth="xl"
            sx={{
              pt: { xs: 7, md: 10 },
              pb: { xs: 5, md: 7 },
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "0.82fr 1.18fr" },
              gap: { xs: 5, lg: 7 },
              alignItems: "center",
            }}
          >
            <Stack spacing={3.2}>
              <Typography
                component="h1"
                variant="h1"
                sx={{
                  fontSize: { xs: "3rem", sm: "4.25rem", lg: "5.4rem" },
                  lineHeight: 0.95,
                  color: "#0f5132",
                }}
              >
                TreeCRM
              </Typography>
              <Typography
                component="p"
                sx={{
                  maxWidth: 720,
                  fontSize: { xs: "1.7rem", md: "2.55rem" },
                  lineHeight: 1.08,
                  fontWeight: 850,
                }}
              >
                Support operations, mapped clearly.
              </Typography>
              <Typography sx={{ maxWidth: 620, color: "#475569", fontSize: { xs: "1rem", md: "1.12rem" }, lineHeight: 1.7 }}>
                Bring customer tickets, employee ownership, escalations, and admin controls into one calm workspace built for service teams that need context to travel with every case.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.4}>
                <Button component={Link} href="/login" variant="contained" size="large">
                  Sign in
                </Button>
                <Button component={Link} href="/login?mode=register" variant="outlined" size="large">
                  Create customer account
                </Button>
              </Stack>
            </Stack>

            <ProductWindow title="Operations workspace">
              <OperationsWorkspacePreview />
            </ProductWindow>
          </Container>
        </Box>

        <Container id="product" maxWidth="xl" sx={{ py: { xs: 6, md: 9 } }}>
          <Stack spacing={4}>
            <Stack spacing={1.3} sx={{ maxWidth: 720 }}>
              <Typography variant="h3">One workflow from portal to resolution</Typography>
              <Typography color="text.secondary">
                TreeCRM keeps the path visible: customer request, CSR ownership, manager review, executive visibility, and admin governance.
              </Typography>
            </Stack>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
              {workflowSteps.map((step, index) => (
                <Paper key={step.label} variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                  <Typography variant="caption" fontWeight={900} color="primary">
                    0{index + 1}
                  </Typography>
                  <Typography variant="h6" sx={{ mt: 1 }}>
                    {step.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.7 }}>
                    {step.detail}
                  </Typography>
                </Paper>
              ))}
            </Box>
          </Stack>
        </Container>

        <Box id="portal" sx={{ bgcolor: "#f8fafc", borderY: "1px solid rgba(100, 116, 139, 0.16)", py: { xs: 6, md: 9 } }}>
          <Container maxWidth="xl" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "0.82fr 1.18fr" }, gap: 4, alignItems: "center" }}>
            <Stack spacing={1.4}>
              <Typography variant="h3">A customer portal that stays readable</Typography>
              <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
                Customers can create tickets, track status, continue conversations, and submit satisfaction ratings without seeing internal routing complexity.
              </Typography>
            </Stack>
            <ProductWindow title="Customer portal">
              <Box sx={{ p: 2.2, bgcolor: "#ffffff" }}>
                <Stack spacing={1.5}>
                  {ticketRows.map((row) => (
                    <Box
                      key={row[0]}
                      sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", sm: "1.4fr 0.8fr 0.7fr 1fr" },
                        gap: 1,
                        px: 1.5,
                        py: 1.2,
                        borderRadius: 1.4,
                        border: "1px solid rgba(100, 116, 139, 0.18)",
                        bgcolor: row[2] === "High" ? "#fffbeb" : "#ffffff",
                      }}
                    >
                      {row.map((cell) => (
                        <Typography key={cell} variant="body2" fontWeight={cell === row[0] ? 800 : 600} color={cell === row[2] && cell === "High" ? "#b7791f" : "inherit"}>
                          {cell}
                        </Typography>
                      ))}
                    </Box>
                  ))}
                </Stack>
              </Box>
            </ProductWindow>
          </Container>
        </Box>

        <Container id="operations" maxWidth="xl" sx={{ py: { xs: 6, md: 9 } }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.1fr 0.9fr" }, gap: 4, alignItems: "center" }}>
            <ProductWindow title="Operations workspace">
              <OperationsWorkspacePreview />
            </ProductWindow>
            <Stack spacing={1.4}>
              <Typography variant="h3">Operations work is visible by design</Typography>
              <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
                The tree canvas gives each role a quick map of employee scope, customer load, active cases, and escalation pressure. Detail panels keep action controls close to the selected case.
              </Typography>
            </Stack>
          </Box>
        </Container>

        <Box id="security" sx={{ bgcolor: "#f8fafc", borderTop: "1px solid rgba(100, 116, 139, 0.16)", py: { xs: 6, md: 9 } }}>
          <Container maxWidth="xl" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "0.86fr 1.14fr" }, gap: 4, alignItems: "center" }}>
            <Stack spacing={1.4}>
              <Typography variant="h3">Admin controls stay compact</Typography>
              <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
                Provision employee accounts, connect CSRs to managers, manage reusable tags, and tune priority settings without turning setup into a separate product.
              </Typography>
            </Stack>
            <ProductWindow title="Admin controls">
              <Box sx={{ p: 2.2, bgcolor: "#ffffff" }}>
                <Stack spacing={1.1}>
                  {["Users by role", "Tag swatches", "Priority defaults"].map((label, index) => (
                    <Box key={label} sx={{ display: "grid", gridTemplateColumns: "1fr 0.8fr 0.8fr", gap: 1, px: 1.4, py: 1.1, border: "1px solid rgba(100,116,139,0.18)", borderRadius: 1.3 }}>
                      <Typography variant="body2" fontWeight={850}>{label}</Typography>
                      <Typography variant="body2" color="text.secondary">{index === 0 ? "Admin" : index === 1 ? "Node color" : "High"}</Typography>
                      <Typography variant="body2" color="primary" fontWeight={850}>{index === 0 ? "Active" : "Configured"}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </ProductWindow>
          </Container>
        </Box>

        <Container maxWidth="xl" sx={{ py: { xs: 6, md: 8 } }}>
          <Paper variant="outlined" sx={{ p: { xs: 3, md: 5 }, borderRadius: 2, bgcolor: "#0f5132", color: "#ffffff" }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems={{ md: "center" }} justifyContent="space-between">
              <Box>
                <Typography variant="h3" sx={{ color: "#ffffff" }}>
                  Start with the right workspace
                </Typography>
                <Typography sx={{ color: "rgba(255,255,255,0.76)", mt: 1, maxWidth: 680 }}>
                  Sign in to continue internal work, or create a customer account to begin a support conversation.
                </Typography>
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                <Button component={Link} href="/login" variant="contained" sx={{ bgcolor: "#ffffff", color: "#0f5132", "&:hover": { bgcolor: "#e8f6ef" } }}>
                  Sign in
                </Button>
                <Button component={Link} href="/login?mode=register" variant="outlined" sx={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.42)", "&:hover": { borderColor: "#ffffff", bgcolor: "rgba(255,255,255,0.08)" } }}>
                  Create customer account
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Container>
      </Box>
    </Box>
  );
}
