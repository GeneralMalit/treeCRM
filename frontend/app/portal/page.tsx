"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  clearStoredAccessToken,
  getLandingRoute,
  getStoredAccessToken,
  logout,
  me,
} from "@/lib/auth";
import { disconnectRealtimeSocket } from "@/lib/realtime";
import {
  createPortalTicket,
  fetchPortalTickets,
  type PortalDashboardResponse,
  type PortalTicketSummary,
} from "@/lib/customerPortal";

const TICKET_CATEGORIES = [
  "General Inquiry",
  "Technical Issue",
  "Billing",
  "Account Access",
  "Feature Request",
  "Other",
] as const;

type ViewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      data: {
        user: {
          email: string;
          role: "Customer";
          name?: string;
        };
        dashboard: PortalDashboardResponse;
      };
    };

function safeFormatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function sortTicketsByLatest(tickets: PortalTicketSummary[]): PortalTicketSummary[] {
  return [...tickets].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export default function PortalPage() {
  const router = useRouter();
  const [state, setState] = useState<ViewState>({ status: "loading" });
  const [subjectDraft, setSubjectDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [categoryDraft, setCategoryDraft] = useState<(typeof TICKET_CATEGORIES)[number]>("General Inquiry");
  const [attachmentsDraft, setAttachmentsDraft] = useState("");
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const accessToken = getStoredAccessToken();
      if (!accessToken) {
        router.replace("/login");
        return;
      }

      try {
        const currentUser = await me(accessToken);
        if (cancelled) {
          return;
        }

        if (currentUser.role !== "Customer") {
          router.replace(getLandingRoute(currentUser.role));
          return;
        }

        const dashboard = await fetchPortalTickets(accessToken);
        if (cancelled) {
          return;
        }

        setState({
          status: "ready",
          data: {
            user: {
              email: currentUser.email,
              role: "Customer",
              ...(currentUser.name ? { name: currentUser.name } : {}),
            },
            dashboard,
          },
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Failed to load customer portal.",
        });
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleLogout = async () => {
    const accessToken = getStoredAccessToken();
    if (accessToken) {
      await logout(accessToken).catch(() => undefined);
    }

    disconnectRealtimeSocket();
    clearStoredAccessToken();
    router.replace("/login");
  };

  const handleRefreshTickets = async () => {
    if (state.status !== "ready") {
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    try {
      const dashboard = await fetchPortalTickets(accessToken);
      setState({
        status: "ready",
        data: {
          ...state.data,
          dashboard,
        },
      });
    } catch (error) {
      setActionMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to refresh tickets.",
      });
    }
  };

  const handleCreateTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (state.status !== "ready") {
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    const attachments = attachmentsDraft
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    setCreatingTicket(true);
    setActionMessage(null);
    try {
      const createdTicket = await createPortalTicket(accessToken, {
        subject: subjectDraft,
        description: descriptionDraft,
        category: categoryDraft,
        attachments,
      });

      const dashboard = await fetchPortalTickets(accessToken);
      setState({
        status: "ready",
        data: {
          ...state.data,
          dashboard,
        },
      });

      setSubjectDraft("");
      setDescriptionDraft("");
      setCategoryDraft("General Inquiry");
      setAttachmentsDraft("");
      setActionMessage({ type: "success", text: "Ticket created successfully." });
      router.push(`/portal/${createdTicket.id}`);
    } catch (error) {
      setActionMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to create ticket.",
      });
    } finally {
      setCreatingTicket(false);
    }
  };

  const ticketList = useMemo(() => {
    if (state.status !== "ready") {
      return [];
    }

    return sortTicketsByLatest(state.data.dashboard.tickets);
  }, [state]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={2.5}>
        <Paper elevation={1} sx={{ p: 3 }}>
          <Stack spacing={1.25}>
            <Typography variant="h5">Customer Portal</Typography>
            <Typography color="text.secondary">
              Submit support tickets, review progress, and continue your conversation with support.
            </Typography>

            {state.status === "loading" && <Alert severity="info">Validating session and loading tickets...</Alert>}
            {state.status === "error" && <Alert severity="error">{state.message}</Alert>}
            {state.status === "ready" && (
              <Alert severity="success">
                Signed in as {state.data.user.name ? `${state.data.user.name} (${state.data.user.email})` : state.data.user.email}
                {" - "}
                company profile: {state.data.dashboard.customer.company}
              </Alert>
            )}

            <Stack direction="row" spacing={1.25}>
              <Button variant="contained" onClick={handleLogout}>
                Logout
              </Button>
              <Button variant="outlined" onClick={handleRefreshTickets} disabled={state.status !== "ready"}>
                Refresh Tickets
              </Button>
              <Button component={Link} href="/" variant="outlined">
                Home
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
          <Paper elevation={1} sx={{ p: 2.5, flex: 1 }}>
            <Typography variant="h6">Submit a New Ticket</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Include your issue details and optional attachment references.
            </Typography>
            <Divider sx={{ mb: 1.5 }} />

            <Stack component="form" spacing={1.25} onSubmit={handleCreateTicket}>
              <TextField
                label="Subject"
                value={subjectDraft}
                onChange={(event) => setSubjectDraft(event.target.value)}
                disabled={state.status !== "ready" || creatingTicket}
                required
              />

              <TextField
                select
                label="Category"
                value={categoryDraft}
                onChange={(event) => setCategoryDraft(event.target.value as (typeof TICKET_CATEGORIES)[number])}
                disabled={state.status !== "ready" || creatingTicket}
              >
                {TICKET_CATEGORIES.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                multiline
                minRows={4}
                label="Description"
                value={descriptionDraft}
                onChange={(event) => setDescriptionDraft(event.target.value)}
                disabled={state.status !== "ready" || creatingTicket}
                required
              />

              <TextField
                multiline
                minRows={3}
                label="Attachments (one per line)"
                value={attachmentsDraft}
                onChange={(event) => setAttachmentsDraft(event.target.value)}
                disabled={state.status !== "ready" || creatingTicket}
                helperText="Enter file names or links. Upload handling is planned for a later session."
              />

              {actionMessage && <Alert severity={actionMessage.type}>{actionMessage.text}</Alert>}

              <Button type="submit" variant="contained" disabled={state.status !== "ready" || creatingTicket}>
                {creatingTicket ? "Creating..." : "Create Ticket"}
              </Button>
            </Stack>
          </Paper>

          <Paper elevation={1} sx={{ p: 2.5, flex: 1.2 }}>
            <Typography variant="h6">Your Tickets</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              All tickets are sorted by most recent activity.
            </Typography>
            <Divider sx={{ mb: 1.5 }} />

            {state.status === "ready" && ticketList.length === 0 && (
              <Alert severity="info">No tickets yet. Create your first ticket using the form.</Alert>
            )}

            {state.status === "ready" && ticketList.length > 0 && (
              <Stack spacing={1.25}>
                {ticketList.map((ticket) => (
                  <Paper
                    key={ticket.id}
                    variant="outlined"
                    sx={{
                      p: 1.25,
                      borderColor: "#E5E7EB",
                    }}
                  >
                    <Stack spacing={0.75}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", sm: "center" }}
                        spacing={1}
                      >
                        <Typography sx={{ fontWeight: 600 }}>{ticket.subject}</Typography>
                        <Stack direction="row" spacing={0.75}>
                          <Chip size="small" label={ticket.status} />
                          <Chip size="small" variant="outlined" label={ticket.priority} />
                          <Chip size="small" variant="outlined" label={ticket.category} />
                        </Stack>
                      </Stack>

                      <Typography variant="caption" color="text.secondary">
                        Updated: {safeFormatDate(ticket.updatedAt)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Assigned: {ticket.assignedEmployee?.name || ticket.assignedEmployee?.email || "Pending assignment"}
                      </Typography>

                      <Box>
                        <Button component={Link} href={`/portal/${ticket.id}`} size="small" variant="outlined">
                          View Ticket
                        </Button>
                      </Box>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>
        </Stack>
      </Stack>
    </Container>
  );
}
