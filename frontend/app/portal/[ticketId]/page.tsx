"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  clearStoredAccessToken,
  getLandingRoute,
  getStoredAccessToken,
  logout,
  me,
} from "@/lib/auth";
import {
  fetchPortalTicketDetail,
  postPortalTicketMessage,
  type PortalMessage,
  type PortalTicketDetailResponse,
} from "@/lib/customerPortal";
import {
  disconnectRealtimeSocket,
  getRealtimeSocket,
  joinCaseRoom,
  leaveCaseRoom,
  type CaseChatSocketMessage,
  type RealtimeSocket,
} from "@/lib/realtime";

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

  const handleLogout = async () => {
    const accessToken = getStoredAccessToken();
    if (accessToken) {
      await logout(accessToken).catch(() => undefined);
    }

    disconnectRealtimeSocket();
    clearStoredAccessToken();
    router.replace("/login");
  };

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

  const activeStatusIndex = useMemo(() => {
    if (state.status !== "ready") {
      return -1;
    }

    return STATUS_FLOW.indexOf(state.data.detail.ticket.status);
  }, [state]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={2.5}>
        <Paper elevation={1} sx={{ p: 3 }}>
          <Stack spacing={1.25}>
            <Typography variant="h5">Ticket Detail</Typography>
            <Typography color="text.secondary">
              Review ticket status and timeline, then continue the conversation with support.
            </Typography>

            {state.status === "loading" && <Alert severity="info">Loading ticket details...</Alert>}
            {state.status === "error" && <Alert severity="error">{state.message}</Alert>}
            {state.status === "ready" && (
              <Alert severity="success">
                Signed in as {state.data.user.name ? `${state.data.user.name} (${state.data.user.email})` : state.data.user.email}
              </Alert>
            )}

            <Stack direction="row" spacing={1.25}>
              <Button component={Link} href="/portal" variant="contained">
                Back to Tickets
              </Button>
              <Button component={Link} href="/" variant="outlined">
                Home
              </Button>
              <Button variant="outlined" onClick={handleLogout}>
                Logout
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {state.status === "ready" && (
          <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
            <Paper elevation={1} sx={{ p: 2.5, flex: 1 }}>
              <Stack spacing={1.25}>
                <Typography variant="h6">{state.data.detail.ticket.subject}</Typography>
                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                  <Chip label={`Status: ${state.data.detail.ticket.status}`} />
                  <Chip label={`Priority: ${state.data.detail.ticket.priority}`} variant="outlined" />
                  <Chip label={`Category: ${state.data.detail.ticket.category}`} variant="outlined" />
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

                <Typography variant="subtitle2">Status Flow</Typography>
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

                <Divider />

                <Typography variant="subtitle2">Ticket Description</Typography>
                <Paper variant="outlined" sx={{ p: 1.25, borderColor: "#E5E7EB" }}>
                  <Typography variant="body2">
                    {state.data.detail.ticket.description || "No description provided."}
                  </Typography>
                </Paper>

                <Typography variant="subtitle2">Attachments</Typography>
                {state.data.detail.ticket.attachments.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No attachments were added.
                  </Typography>
                )}
                {state.data.detail.ticket.attachments.length > 0 && (
                  <Stack spacing={0.5}>
                    {state.data.detail.ticket.attachments.map((attachment) => (
                      <Typography key={attachment} variant="body2">
                        - {attachment}
                      </Typography>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Paper>

            <Paper elevation={1} sx={{ p: 2.5, flex: 1 }}>
              <Typography variant="h6">Timeline</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Ticket lifecycle events and status transitions.
              </Typography>
              <Divider sx={{ mb: 1.5 }} />
              <Stack spacing={1}>
                {state.data.detail.timeline.map((item) => (
                  <Paper key={item.id} variant="outlined" sx={{ p: 1, borderColor: "#E5E7EB" }}>
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

              <Divider sx={{ my: 1.5 }} />

              <Typography variant="h6">Conversation</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Messages between you and support.
              </Typography>

              <Stack spacing={1} sx={{ mb: 1.5 }}>
                {state.data.detail.messages.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No messages yet.
                  </Typography>
                )}

                {state.data.detail.messages.map((message) => (
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
                ))}
              </Stack>

              <Stack component="form" spacing={1} onSubmit={handleSendMessage}>
                <TextField
                  multiline
                  minRows={3}
                  label="Message"
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                  disabled={sendingMessage}
                />
                {actionMessage && <Alert severity={actionMessage.type}>{actionMessage.text}</Alert>}
                <Button type="submit" variant="contained" disabled={sendingMessage}>
                  {sendingMessage ? "Sending..." : "Send Message"}
                </Button>
              </Stack>
            </Paper>
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
