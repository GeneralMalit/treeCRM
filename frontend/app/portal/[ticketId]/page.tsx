"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getLandingRoute, getStoredAccessToken, me } from "@/lib/auth";
import {
  fetchPortalTicketDetail,
  postPortalTicketMessage,
  submitPortalTicketCustomerSatisfaction,
  type PortalMessage,
  type PortalTicketDetailResponse,
} from "@/lib/customerPortal";
import {
  getRealtimeSocket,
  joinCaseRoom,
  leaveCaseRoom,
  type CaseChatSocketMessage,
  type RealtimeSocket,
} from "@/lib/realtime";
import { ShellPageHeader } from "@/components/shell/ShellPageHeader";
import { ShellSection } from "@/components/shell/ShellSection";
import { AuthenticatedShell } from "@/components/shell/AuthenticatedShell";

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
        detail: PortalTicketDetailResponse;
      };
    };

const STATUS_FLOW: Array<"Open" | "In Progress" | "Resolved" | "Dropped"> = [
  "Open",
  "In Progress",
  "Resolved",
  "Dropped",
];

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

function upsertMessage(messages: PortalMessage[], nextMessage: PortalMessage): PortalMessage[] {
  const byId = new Map(messages.map((message) => [message.id, message]));
  byId.set(nextMessage.id, nextMessage);

  return [...byId.values()].sort((a, b) => {
    const byDate = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (byDate !== 0) {
      return byDate;
    }

    return a.id.localeCompare(b.id);
  });
}

function fromSocketMessage(payload: CaseChatSocketMessage): PortalMessage {
  return {
    id: payload.id,
    senderId: payload.senderId,
    senderRole: payload.senderRole,
    senderName: payload.senderRole === "Customer" ? "You" : payload.senderName,
    messageText: payload.messageText,
    createdAt: payload.createdAt,
    isCustomer: payload.isCustomer,
  };
}

export default function PortalTicketDetailPage() {
  const router = useRouter();
  const params = useParams<{ ticketId: string }>();
  const ticketId = typeof params.ticketId === "string" ? params.ticketId : "";

  const [state, setState] = useState<ViewState>({ status: "loading" });
  const [messageDraft, setMessageDraft] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [ratingDraft, setRatingDraft] = useState<number>(5);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!ticketId) {
        setState({ status: "error", message: "Ticket ID is missing from the route." });
        return;
      }

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

        const detail = await fetchPortalTicketDetail(accessToken, ticketId);
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
            detail,
          },
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Failed to load ticket detail.",
        });
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [router, ticketId]);

  useEffect(() => {
    if (state.status !== "ready" || !ticketId) {
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      return;
    }

    const socket: RealtimeSocket = getRealtimeSocket(accessToken);

    const joinCurrentCaseRoom = () => {
      void joinCaseRoom(socket, ticketId).catch((error) => {
        setActionMessage({
          type: "error",
          text: error instanceof Error ? error.message : "Failed to connect to realtime chat.",
        });
      });
    };

    const handleCaseMessage = (payload: CaseChatSocketMessage) => {
      if (payload.caseId !== ticketId) {
        return;
      }

      setState((current) => {
        if (current.status !== "ready") {
          return current;
        }

        return {
          status: "ready",
          data: {
            ...current.data,
            detail: {
              ...current.data.detail,
              messages: upsertMessage(current.data.detail.messages, fromSocketMessage(payload)),
            },
          },
        };
      });
    };

    socket.on("connect", joinCurrentCaseRoom);
    socket.on("chat:case:message", handleCaseMessage);

    if (socket.connected) {
      joinCurrentCaseRoom();
    }

    return () => {
      socket.off("connect", joinCurrentCaseRoom);
      socket.off("chat:case:message", handleCaseMessage);
      void leaveCaseRoom(socket, ticketId).catch(() => undefined);
    };
  }, [state.status, ticketId]);

  const currentTicketRating = state.status === "ready" ? state.data.detail.ticket.customerSatisfactionRating : null;

  useEffect(() => {
    if (state.status !== "ready") {
      return;
    }

    setRatingDraft(currentTicketRating ?? 5);
  }, [currentTicketRating, state.status]);

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (state.status !== "ready" || !ticketId) {
      return;
    }

    const trimmedMessage = messageDraft.trim();
    if (!trimmedMessage) {
      setActionMessage({ type: "error", text: "Message cannot be empty." });
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    setSendingMessage(true);
    setActionMessage(null);
    try {
      const createdMessage = await postPortalTicketMessage(accessToken, ticketId, trimmedMessage);

      setState((current) => {
        if (current.status !== "ready") {
          return current;
        }

        return {
          status: "ready",
          data: {
            ...current.data,
            detail: {
              ...current.data.detail,
              messages: upsertMessage(current.data.detail.messages, createdMessage),
            },
          },
        };
      });

      setMessageDraft("");
      setActionMessage({ type: "success", text: "Message sent." });
    } catch (error) {
      setActionMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to send message.",
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSubmitCustomerSatisfaction = async () => {
    if (state.status !== "ready" || !ticketId) {
      return;
    }

    if (!state.data.detail.ticket.canSubmitCustomerSatisfaction) {
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    setSubmittingRating(true);
    setActionMessage(null);
    try {
      await submitPortalTicketCustomerSatisfaction(accessToken, ticketId, ratingDraft);
      const refreshedDetail = await fetchPortalTicketDetail(accessToken, ticketId);

      setState((current) => {
        if (current.status !== "ready") {
          return current;
        }

        return {
          status: "ready",
          data: {
            ...current.data,
            detail: refreshedDetail,
          },
        };
      });
      setActionMessage({ type: "success", text: "Thanks! Your customer satisfaction rating was submitted." });
    } catch (error) {
      setActionMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to submit customer satisfaction.",
      });
    } finally {
      setSubmittingRating(false);
    }
  };

  const activeStatusIndex = useMemo(() => {
    if (state.status !== "ready") {
      return -1;
    }

    return STATUS_FLOW.indexOf(state.data.detail.ticket.status);
  }, [state]);

  return (
    <AuthenticatedShell role="Customer" title="Customer portal" subtitle="Ticket detail">
      <Stack spacing={3}>
      <ShellPageHeader
        title={state.status === "ready" ? state.data.detail.ticket.subject : "Ticket detail"}
        description="Conversation stays primary. Status, timeline, and support metadata live in the side panel."
        actions={
          <Button component={Link} href="/portal" variant="outlined" size="small">
            Back to tickets
          </Button>
        }
      />

      {state.status === "loading" ? <Alert severity="info">Loading ticket details...</Alert> : null}
      {state.status === "error" ? <Alert severity="error">{state.message}</Alert> : null}
      {state.status === "ready" ? (
        <Typography variant="body2" color="text.secondary">
          Signed in as {state.data.user.name ? `${state.data.user.name} (${state.data.user.email})` : state.data.user.email}
        </Typography>
      ) : null}
      {actionMessage ? <Alert severity={actionMessage.type}>{actionMessage.text}</Alert> : null}

      {state.status === "ready" ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.6fr) minmax(320px, 0.9fr)" },
            gap: 3,
            alignItems: "start",
          }}
        >
          <ShellSection sx={{ display: "flex", flexDirection: "column", gap: 2, minHeight: 0 }}>
            <Stack spacing={1}>
              <Typography variant="h6" fontWeight={700}>
                Conversation
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Messages between you and support.
              </Typography>
            </Stack>

            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1,
                maxHeight: { lg: "58vh" },
                overflowY: "auto",
                pr: 0.5,
              }}
            >
              {state.data.detail.messages.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No messages yet.
                </Typography>
              ) : (
                state.data.detail.messages.map((message) => (
                  <Box
                    key={message.id}
                    sx={{
                      alignSelf: message.isCustomer ? "flex-end" : "flex-start",
                      maxWidth: "85%",
                      p: 1.25,
                      borderRadius: 1.25,
                      backgroundColor: message.isCustomer ? "#DBEAFE" : "#F3F4F6",
                      border: "1px solid #E5E7EB",
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {message.senderName} ({message.senderRole}) | {safeFormatDate(message.createdAt)}
                    </Typography>
                    <Typography variant="body2">{message.messageText}</Typography>
                  </Box>
                ))
              )}
            </Box>

            <Divider />

            <Stack component="form" spacing={1} onSubmit={handleSendMessage}>
              <TextField
                multiline
                minRows={3}
                label="Message"
                value={messageDraft}
                onChange={(event) => setMessageDraft(event.target.value)}
                disabled={sendingMessage}
              />
              <Button type="submit" variant="contained" disabled={sendingMessage}>
                {sendingMessage ? "Sending..." : "Send Message"}
              </Button>
            </Stack>
          </ShellSection>

          <ShellSection sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Stack spacing={1}>
              <Typography variant="h6" fontWeight={700}>
                Ticket details
              </Typography>
              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                <Chip label={`Status: ${state.data.detail.ticket.status}`} />
                <Chip label={`Priority: ${state.data.detail.ticket.priority}`} variant="outlined" />
                <Chip label={`Category: ${state.data.detail.ticket.category}`} variant="outlined" />
              </Stack>
            </Stack>

            <Typography variant="body2" color="text.secondary">
              Assigned support:{" "}
              {state.data.detail.ticket.assignedEmployee?.name ||
                state.data.detail.ticket.assignedEmployee?.email ||
                "Pending assignment"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Created: {safeFormatDate(state.data.detail.ticket.createdAt)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Updated: {safeFormatDate(state.data.detail.ticket.updatedAt)}
            </Typography>

            <Divider />

            <Stack spacing={1}>
              <Typography variant="subtitle2">Status flow</Typography>
              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                {STATUS_FLOW.map((statusLabel, index) => (
                  <Chip
                    key={statusLabel}
                    label={statusLabel}
                    color={index <= activeStatusIndex ? "primary" : "default"}
                    variant={index <= activeStatusIndex ? "filled" : "outlined"}
                  />
                ))}
              </Stack>
            </Stack>

            <Stack spacing={1}>
              <Typography variant="subtitle2">Description</Typography>
              <Paper variant="outlined" sx={{ p: 1.25, borderColor: "#E5E7EB", boxShadow: "none" }}>
                <Typography variant="body2">
                  {state.data.detail.ticket.description || "No description provided."}
                </Typography>
              </Paper>
            </Stack>

            <Stack spacing={1}>
              <Typography variant="subtitle2">Attachments</Typography>
              {state.data.detail.ticket.attachments.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No attachments were added.
                </Typography>
              ) : (
                <Stack spacing={0.5}>
                  {state.data.detail.ticket.attachments.map((attachment) => (
                    <Typography key={attachment} variant="body2">
                      - {attachment}
                    </Typography>
                  ))}
                </Stack>
              )}
            </Stack>

            <Divider />

            <Stack spacing={1.25}>
              <Typography variant="subtitle2">Customer satisfaction</Typography>
              {state.data.detail.ticket.customerSatisfactionRating !== null ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    color="success"
                    label={`Submitted: ${state.data.detail.ticket.customerSatisfactionRating}/5`}
                  />
                  {state.data.detail.ticket.customerSatisfactionSubmittedAt ? (
                    <Typography variant="caption" color="text.secondary">
                      {safeFormatDate(state.data.detail.ticket.customerSatisfactionSubmittedAt)}
                    </Typography>
                  ) : null}
                </Stack>
              ) : state.data.detail.ticket.canSubmitCustomerSatisfaction ? (
                <Stack spacing={1}>
                  <Typography variant="body2" color="text.secondary">
                    This ticket is resolved. Please rate your support experience.
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                      <InputLabel id="ticket-rating-label">Rating</InputLabel>
                      <Select
                        labelId="ticket-rating-label"
                        label="Rating"
                        value={String(ratingDraft)}
                        onChange={(event) => setRatingDraft(Number(event.target.value))}
                      >
                        {[5, 4, 3, 2, 1].map((rating) => (
                          <MenuItem key={rating} value={String(rating)}>
                            {rating}/5
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Button
                      variant="contained"
                      onClick={handleSubmitCustomerSatisfaction}
                      disabled={submittingRating}
                    >
                      {submittingRating ? "Submitting..." : "Submit Rating"}
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Rating becomes available after the ticket is resolved.
                </Typography>
              )}
            </Stack>

            <Divider />

            <Stack spacing={1}>
              <Typography variant="subtitle2">Timeline</Typography>
              <Stack spacing={1}>
                {state.data.detail.timeline.map((item) => (
                  <Paper key={item.id} variant="outlined" sx={{ p: 1, borderColor: "#E5E7EB", boxShadow: "none" }}>
                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={0.75}>
                      <Typography variant="body2">{item.label}</Typography>
                      <Chip size="small" label={item.type} variant="outlined" />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {safeFormatDate(item.createdAt)}
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            </Stack>
          </ShellSection>
        </Box>
      ) : null}
      </Stack>
    </AuthenticatedShell>
  );
}
