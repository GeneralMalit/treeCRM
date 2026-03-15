"use client";

import { useEffect, useState } from "react";
import { Box, Button, Card, CardContent, Container, Stack, Typography } from "@mui/material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearStoredAccessToken, getLandingRoute, getStoredAccessToken, me } from "@/lib/auth";

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
    <Box
      sx={{
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        background:
          "radial-gradient(1300px 520px at 20% -8%, rgba(16,185,129,0.16), transparent), radial-gradient(900px 440px at 100% 0%, rgba(14,165,233,0.12), transparent), #f6f8fb",
      }}
    >
      <Box
        component="header"
        sx={{
          py: 2.25,
          px: { xs: 2, md: 4 },
          borderBottom: "1px solid rgba(15, 23, 42, 0.10)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(8px)",
        }}
      >
        <Box
          component={Link}
          href="/"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 1.1,
            textDecoration: "none",
            "&:hover .brand-icon": { transform: "rotate(10deg) scale(1.08)" },
            "&:hover .brand-node": { boxShadow: "0 0 0 6px rgba(20,83,45,0.12)" },
            "&:hover .brand-text": { letterSpacing: "-0.012em" },
          }}
        >
          <Box
            className="brand-icon"
            sx={{
              position: "relative",
              width: 28,
              height: 28,
              transition: "transform 180ms ease",
            }}
          >
            <Box sx={{ position: "absolute", left: 5, top: 12, width: 18, height: 2, backgroundColor: "#14532d" }} />
            <Box sx={{ position: "absolute", left: 12, top: 5, width: 2, height: 18, backgroundColor: "#14532d" }} />
            <Box
              className="brand-node"
              sx={{
                position: "absolute",
                left: 0,
                top: 10,
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#10b981",
                transition: "box-shadow 180ms ease",
              }}
            />
            <Box
              className="brand-node"
              sx={{
                position: "absolute",
                left: 10,
                top: 0,
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#16a34a",
                transition: "box-shadow 180ms ease",
              }}
            />
            <Box
              className="brand-node"
              sx={{
                position: "absolute",
                right: 0,
                top: 10,
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#0ea5e9",
                transition: "box-shadow 180ms ease",
              }}
            />
            <Box
              className="brand-node"
              sx={{
                position: "absolute",
                left: 10,
                bottom: 0,
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#14532d",
                transition: "box-shadow 180ms ease",
              }}
            />
          </Box>
          <Typography
            className="brand-text"
            variant="h6"
            fontWeight={900}
            sx={{
              letterSpacing: "-0.02em",
              color: "#14532d",
              fontFamily: "var(--font-geist-sans)",
              transition: "letter-spacing 180ms ease",
            }}
          >
            TreeCRM
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <Button component={Link} href="/login" variant="text" sx={{ color: "#0f172a", fontWeight: 600 }}>
            Sign In
          </Button>
          <Button
            component={Link}
            href="/login?mode=register"
            variant="contained"
            size="small"
            disableElevation
            sx={{
              backgroundColor: "#166534",
              fontWeight: 700,
              "&:hover": { backgroundColor: "#14532d" },
            }}
          >
            Get Started
          </Button>
        </Stack>
      </Box>

      <Box component="main" sx={{ flexGrow: 1 }}>
        <Container maxWidth="lg" sx={{ pt: { xs: 8, md: 12 }, pb: { xs: 8, md: 10 } }}>
          <Stack spacing={4} alignItems="center" textAlign="center" sx={{ maxWidth: 920, mx: "auto" }}>
            <Typography
              variant="h2"
              component="h1"
              fontWeight={900}
              sx={{
                fontSize: { xs: "2.3rem", sm: "3.2rem", md: "4rem" },
                lineHeight: { xs: 1.05, md: 1.02 },
                letterSpacing: "-0.02em",
                color: "#14532d",
              }}
            >
              TreeCRM
            </Typography>
            <Typography
              variant="h4"
              component="p"
              sx={{
                maxWidth: 860,
                color: "#0f172a",
                fontWeight: 760,
                lineHeight: 1.2,
                letterSpacing: "-0.02em",
                fontSize: { xs: "1.45rem", sm: "1.8rem", md: "2.2rem" },
              }}
            >
              Turn ticket chaos into clear, fast resolution.
            </Typography>
            <Typography
              variant="h6"
              component="p"
              sx={{
                maxWidth: 760,
                color: "#334155",
                fontWeight: 450,
                lineHeight: 1.55,
                fontSize: { xs: "1rem", md: "1.12rem" },
              }}
            >
              Give your team one place to triage, collaborate, and close cases without losing context.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} pt={2}>
              <Button
                component={Link}
                href="/login"
                variant="contained"
                size="large"
                disableElevation
                sx={{
                  px: 4.5,
                  py: 1.45,
                  fontWeight: 700,
                  backgroundColor: "#166534",
                  "&:hover": { backgroundColor: "#14532d" },
                }}
              >
                Sign In
              </Button>
              <Button
                component={Link}
                href="/login?mode=register"
                variant="outlined"
                size="large"
                sx={{
                  px: 4.5,
                  py: 1.45,
                  fontWeight: 600,
                  color: "#1e293b",
                  borderColor: "rgba(15, 23, 42, 0.22)",
                  "&:hover": {
                    borderColor: "rgba(15, 23, 42, 0.45)",
                    backgroundColor: "rgba(15, 23, 42, 0.03)",
                  },
                }}
              >
                Get Started
              </Button>
            </Stack>
          </Stack>
        </Container>

        <Box
          sx={{
            py: { xs: 7, md: 9 },
            borderTop: "1px solid rgba(15, 23, 42, 0.10)",
            backgroundColor: "rgba(255,255,255,0.88)",
          }}
        >
          <Container maxWidth="lg">
            <Typography variant="h4" component="h2" fontWeight={800} textAlign="center" gutterBottom sx={{ color: "#0f172a" }}>
              Why teams switch to TreeCRM
            </Typography>
            <Typography variant="subtitle1" sx={{ color: "#475569", textAlign: "center", mb: 6.5 }}>
              Less back-and-forth, faster handling, and better customer trust.
            </Typography>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
                gap: 2.5,
              }}
            >
              <Card
                sx={{
                  height: "100%",
                  border: "1px solid rgba(15, 23, 42, 0.10)",
                  borderRadius: 3,
                  boxShadow: "0 8px 30px rgba(15, 23, 42, 0.06)",
                }}
                elevation={0}
              >
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="h6" fontWeight={750} gutterBottom sx={{ color: "#0f172a" }}>
                    Cut response time
                  </Typography>
                  <Typography sx={{ color: "#475569", lineHeight: 1.65 }}>
                    Assign ownership instantly, keep full conversation history, and avoid repeated handoffs.
                  </Typography>
                </CardContent>
              </Card>

              <Card
                sx={{
                  height: "100%",
                  border: "1px solid rgba(15, 23, 42, 0.10)",
                  borderRadius: 3,
                  boxShadow: "0 8px 30px rgba(15, 23, 42, 0.06)",
                }}
                elevation={0}
              >
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="h6" fontWeight={750} gutterBottom sx={{ color: "#0f172a" }}>
                    Give customers clarity
                  </Typography>
                  <Typography sx={{ color: "#475569", lineHeight: 1.65 }}>
                    Keep customers updated in real time so they always know what is happening and what comes next.
                  </Typography>
                </CardContent>
              </Card>

              <Card
                sx={{
                  height: "100%",
                  border: "1px solid rgba(15, 23, 42, 0.10)",
                  borderRadius: 3,
                  boxShadow: "0 8px 30px rgba(15, 23, 42, 0.06)",
                }}
                elevation={0}
              >
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="h6" fontWeight={750} gutterBottom sx={{ color: "#0f172a" }}>
                    Manage at scale
                  </Typography>
                  <Typography sx={{ color: "#475569", lineHeight: 1.65 }}>
                    Standardize workflows, monitor team load, and keep service performance consistent as you grow.
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </Container>
        </Box>
      </Box>
    </Box>
  );
}
