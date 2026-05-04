"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { AuthenticatedShell } from "@/components/shell/AuthenticatedShell";
import { ShellEmptyState } from "@/components/shell/ShellEmptyState";
import { ShellPageHeader } from "@/components/shell/ShellPageHeader";
import { ShellSection } from "@/components/shell/ShellSection";
import { ShellStatStrip } from "@/components/shell/ShellStatStrip";
import { getLandingRoute, getStoredAccessToken, me } from "@/lib/auth";
import { createPortalTicket, fetchPortalTickets, type PortalDashboardResponse } from "@/lib/customerPortal";
import { safeFormatDate, sortTicketsByLatest } from "@/lib/portalPageUtils";

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

type CreateTicketForm = {
  subject: string;
  description: string;
  category: (typeof TICKET_CATEGORIES)[number];
  attachments: string;
};

const EMPTY_FORM: CreateTicketForm = {
  subject: "",
  description: "",
  category: "General Inquiry",
  attachments: "",
};

export default function PortalPage() {
  const router = useRouter();
  const [state, setState] = useState<ViewState>({ status: "loading" });
  const [createOpen, setCreateOpen] = useState(false);
  const [formState, setFormState] = useState<CreateTicketForm>(EMPTY_FORM);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  const openCreateDialog = () => {
    setFormState(EMPTY_FORM);
    setCreateOpen(true);
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

    const attachments = formState.attachments
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    setCreatingTicket(true);
    setActionMessage(null);
    try {
      const createdTicket = await createPortalTicket(accessToken, {
        subject: formState.subject,
        description: formState.description,
        category: formState.category,
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

      setCreateOpen(false);
      setFormState(EMPTY_FORM);
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

  const counts = useMemo(() => {
    if (state.status !== "ready") {
      return null;
    }

    return {
      total: ticketList.length,
      open: ticketList.filter((ticket) => ticket.status === "Open").length,
      inProgress: ticketList.filter((ticket) => ticket.status === "In Progress").length,
      resolved: ticketList.filter((ticket) => ticket.status === "Resolved").length,
    };
  }, [state, ticketList]);

  return (
    <AuthenticatedShell role="Customer" title="Customer portal" subtitle="Tickets">
      <Stack spacing={3}>
      <ShellPageHeader
        title="Tickets"
        description="Your ticket list stays in focus. Open any item to continue the conversation."
        actions={
          <>
            <Button variant="outlined" onClick={() => void handleRefreshTickets()} disabled={state.status !== "ready"}>
              Refresh
            </Button>
            <Button variant="contained" onClick={openCreateDialog} disabled={state.status !== "ready"}>
              Create ticket
            </Button>
          </>
        }
      />

      {state.status === "loading" ? <Alert severity="info">Validating session and loading tickets...</Alert> : null}
      {state.status === "error" ? <Alert severity="error">{state.message}</Alert> : null}
      {actionMessage ? <Alert severity={actionMessage.type}>{actionMessage.text}</Alert> : null}

      {counts ? (
        <ShellStatStrip
          items={[
            { label: "Tickets", value: String(counts.total), detail: "All support requests" },
            { label: "Open", value: String(counts.open), detail: "Waiting to be handled" },
            { label: "In progress", value: String(counts.inProgress), detail: "Currently active" },
            { label: "Resolved", value: String(counts.resolved), detail: "Completed conversations" },
          ]}
        />
      ) : null}

      <ShellSection>
        <Stack spacing={2}>
          <Typography variant="h6" fontWeight={700}>
            Your tickets
          </Typography>

          {state.status === "ready" && ticketList.length === 0 ? (
            <ShellEmptyState
              title="No tickets yet"
              description="Create your first ticket to start a support conversation."
              actionLabel="Create ticket"
              onAction={openCreateDialog}
            />
          ) : null}

          {state.status === "ready" && ticketList.length > 0 ? (
            <TableContainer component={Paper} variant="outlined" sx={{ boxShadow: "none" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Subject</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Updated</TableCell>
                    <TableCell>Assigned employee</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ticketList.map((ticket) => (
                    <TableRow key={ticket.id} hover>
                      <TableCell>
                        <Stack spacing={0.25}>
                          <Typography variant="body2" fontWeight={600}>
                            {ticket.subject}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {ticket.id}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{ticket.status}</TableCell>
                      <TableCell>{ticket.priority}</TableCell>
                      <TableCell>{ticket.category}</TableCell>
                      <TableCell>{safeFormatDate(ticket.updatedAt)}</TableCell>
                      <TableCell>{ticket.assignedEmployee?.name || ticket.assignedEmployee?.email || "Pending"}</TableCell>
                      <TableCell align="right">
                        <Button component={Link} href={`/portal/${ticket.id}`} size="small" variant="outlined">
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : null}
        </Stack>
      </ShellSection>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create ticket</DialogTitle>
        <DialogContent dividers>
          <Stack
            component="form"
            id="create-ticket-form"
            spacing={2}
            sx={{ pt: 0.5 }}
            onSubmit={handleCreateTicket}
          >
            <TextField
              label="Subject"
              value={formState.subject}
              onChange={(event) => setFormState((current) => ({ ...current, subject: event.target.value }))}
              required
            />
            <FormControl fullWidth>
              <InputLabel id="ticket-category-label">Category</InputLabel>
              <Select
                labelId="ticket-category-label"
                label="Category"
                value={formState.category}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    category: event.target.value as CreateTicketForm["category"],
                  }))
                }
              >
                {TICKET_CATEGORIES.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              multiline
              minRows={4}
              label="Description"
              value={formState.description}
              onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
              required
            />
            <TextField
              multiline
              minRows={3}
              label="Attachments (one per line)"
              value={formState.attachments}
              onChange={(event) => setFormState((current) => ({ ...current, attachments: event.target.value }))}
              helperText="Enter file names or links."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            type="submit"
            form="create-ticket-form"
            variant="contained"
            disabled={creatingTicket || !formState.subject.trim() || !formState.description.trim()}
          >
            {creatingTicket ? "Creating..." : "Create ticket"}
          </Button>
        </DialogActions>
      </Dialog>
      </Stack>
    </AuthenticatedShell>
  );
}
