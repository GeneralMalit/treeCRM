"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { ShellEmptyState } from "@/components/shell/ShellEmptyState";
import { ShellPageHeader } from "@/components/shell/ShellPageHeader";
import { ShellSection } from "@/components/shell/ShellSection";
import { ShellStatStrip } from "@/components/shell/ShellStatStrip";
import { getLandingRoute, getStoredAccessToken, me } from "@/lib/auth";
import {
  fetchInternalChatContacts,
  fetchInternalChatMessages,
  postInternalChatMessage,
  type InternalChatContact,
  type InternalChatMessage,
} from "@/lib/employeeChat";
import { upsertInternalMessage } from "@/lib/employeeWorkspaceUtils";
import {
  getRealtimeSocket,
  joinInternalRoom,
  leaveInternalRoom,
  type InternalChatSocketMessage,
  type NotificationSocketEvent,
  type RealtimeSocket,
} from "@/lib/realtime";
import type { Role } from "@/lib/roles";

type EmployeeMessagesPageProps = {
  role: Exclude<Role, "Customer">;
  title: string;
  description: string;
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

function getDisplayName(contact: InternalChatContact): string {
  return contact.name?.trim() || contact.email;
}

function mapSocketMessage(
  payload: InternalChatSocketMessage,
  viewerId: string,
): InternalChatMessage {
  return {
    id: payload.id,
    senderId: payload.senderId,
    senderRole: payload.senderRole,
    senderName: payload.senderId === viewerId ? "You" : payload.senderName,
    recipientId: payload.recipientId,
    recipientRole: payload.recipientRole,
    recipientName: payload.recipientName,
    messageText: payload.messageText,
    createdAt: payload.createdAt,
    isSelf: payload.senderId === viewerId,
  };
}

export function EmployeeMessagesPage({ role, title, description }: EmployeeMessagesPageProps) {
  const router = useRouter();
  const socketRef = useRef<RealtimeSocket | null>(null);
  const activePeerIdRef = useRef<string | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<InternalChatContact[]>([]);
  const [selectedPeerId, setSelectedPeerId] = useState("");
  const [messages, setMessages] = useState<InternalChatMessage[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [draft, setDraft] = useState("");
  const [activity, setActivity] = useState<NotificationSocketEvent[]>([]);

  const selectedPeer = useMemo(
    () => contacts.find((contact) => contact.id === selectedPeerId) ?? null,
    [contacts, selectedPeerId],
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

        if (currentUser.role !== role) {
          router.replace(getLandingRoute(currentUser.role));
          return;
        }

        const contactList = await fetchInternalChatContacts(accessToken);
        if (cancelled) {
          return;
        }

        setUserId(currentUser.sub);
        setUserEmail(currentUser.email);
        setUserName(currentUser.name?.trim() || null);
        setContacts(contactList);
        setSelectedPeerId((current) => current || contactList[0]?.id || "");
        setStatus("ready");
      } catch (error) {
        if (cancelled) {
          return;
        }

        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Failed to load internal messages.");
      } finally {
        if (!cancelled) {
          setContactsLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [role, router]);

  useEffect(() => {
    if (status !== "ready" || !selectedPeerId) {
      setMessages([]);
      setThreadLoading(false);
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    let cancelled = false;
    setThreadLoading(true);

    const socket = getRealtimeSocket(accessToken);
    socketRef.current = socket;
    activePeerIdRef.current = selectedPeerId;

    const joinCurrentRoom = () => {
      void joinInternalRoom(socket, selectedPeerId).catch((error) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Failed to join the internal chat room.");
        }
      });
    };

    const handleSocketMessage = (payload: InternalChatSocketMessage) => {
      if (payload.senderId !== selectedPeerId && payload.recipientId !== selectedPeerId) {
        return;
      }

      if (!userId) {
        return;
      }

      setMessages((current) => upsertInternalMessage(current, mapSocketMessage(payload, userId)));
    };

    const handleNotification = (payload: NotificationSocketEvent) => {
      if (payload.type !== "internal_message") {
        return;
      }

      setActivity((current) => [payload, ...current].slice(0, 5));
    };

    socket.on("connect", joinCurrentRoom);
    socket.on("chat:internal:message", handleSocketMessage);
    socket.on("notification:new", handleNotification);

    if (socket.connected) {
      joinCurrentRoom();
    }

    fetchInternalChatMessages(accessToken, selectedPeerId)
      .then((thread) => {
        if (cancelled) {
          return;
        }

        setMessages(thread.messages);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setMessage(error instanceof Error ? error.message : "Failed to load the selected conversation.");
      })
      .finally(() => {
        if (!cancelled) {
          setThreadLoading(false);
        }
      });

    return () => {
      cancelled = true;
      socket.off("connect", joinCurrentRoom);
      socket.off("chat:internal:message", handleSocketMessage);
      socket.off("notification:new", handleNotification);
      void leaveInternalRoom(socket, selectedPeerId).catch(() => undefined);
    };
  }, [router, selectedPeerId, status, userId]);

  const stats = useMemo(
    () => [
      { label: "Contacts", value: String(contacts.length), detail: "Allowed peers" },
      { label: "Messages", value: String(messages.length), detail: "Current thread" },
      { label: "Notifications", value: String(activity.length), detail: "Live socket events" },
      { label: "Selected peer", value: selectedPeer ? getDisplayName(selectedPeer) : "None", detail: "Conversation target" },
    ],
    [activity.length, contacts.length, messages.length, selectedPeer],
  );

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedPeer || !draft.trim()) {
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    setSendingMessage(true);
    setMessage(null);
    try {
      const createdMessage = await postInternalChatMessage(accessToken, selectedPeer.id, draft.trim());
      if (userId) {
        setMessages((current) => upsertInternalMessage(current, createdMessage));
      }
      setDraft("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to send internal message.");
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <Stack spacing={3}>
      <ShellPageHeader
        title={title}
        description={description}
        actions={
          <Button variant="outlined" onClick={() => window.location.reload()} disabled={contactsLoading || threadLoading}>
            Refresh
          </Button>
        }
      />

      {status === "loading" ? <Alert severity="info">Loading internal chat...</Alert> : null}
      {status === "error" ? <Alert severity="error">{message ?? "Failed to load internal chat."}</Alert> : null}
      {status === "ready" && userEmail ? (
        <Typography variant="body2" color="text.secondary">
          Signed in as {userName ? `${userName} (${userEmail})` : userEmail}
        </Typography>
      ) : null}
      {message && status === "ready" ? <Alert severity="error">{message}</Alert> : null}

      <ShellStatStrip items={stats} />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(280px, 0.86fr) minmax(0, 1.14fr)" },
          gap: 3,
        }}
      >
        <Stack spacing={3}>
          <ShellSection>
            <Stack spacing={1.5}>
              <Typography variant="h6" fontWeight={700}>
                Contacts
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Select a peer to open the conversation.
              </Typography>
              {contacts.length === 0 ? (
                <ShellEmptyState title="No contacts" description="No internal chat peers are available for this role." />
              ) : (
                <List dense disablePadding>
                  {contacts.map((contact) => {
                    const selected = contact.id === selectedPeerId;
                    return (
                      <ListItemButton
                        key={contact.id}
                        selected={selected}
                        onClick={() => setSelectedPeerId(contact.id)}
                        sx={{ borderRadius: 1 }}
                      >
                        <ListItemText
                          primary={getDisplayName(contact)}
                          secondary={`${contact.role} | ${contact.email}`}
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              )}
            </Stack>
          </ShellSection>

          <ShellSection>
            <Stack spacing={1.5}>
              <Typography variant="h6" fontWeight={700}>
                Activity
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Live notifications from the socket stay here in a compact feed.
              </Typography>
              {activity.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No live notifications yet.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {activity.map((item) => (
                    <Box
                      key={item.id}
                      sx={{
                        p: 1.25,
                        border: "1px solid rgba(148,163,184,0.28)",
                        borderRadius: 1,
                        backgroundColor: "#f8fafc",
                      }}
                    >
                      <Typography variant="body2">{item.message}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {safeFormatDate(item.createdAt)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </Stack>
          </ShellSection>
        </Stack>

        <ShellSection sx={{ display: "flex", flexDirection: "column", gap: 2, minHeight: 0 }}>
          <Stack spacing={0.5}>
            <Typography variant="h6" fontWeight={700}>
              Conversation
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {selectedPeer ? getDisplayName(selectedPeer) : "Choose a contact to begin."}
            </Typography>
          </Stack>

          <Divider />

          {selectedPeer ? (
            <>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                  maxHeight: { lg: "56vh" },
                  overflowY: "auto",
                  pr: 0.5,
                }}
              >
                {threadLoading ? (
                  <Typography variant="body2" color="text.secondary">
                    Loading conversation...
                  </Typography>
                ) : messages.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No messages in this conversation yet.
                  </Typography>
                ) : (
                  messages.map((item) => (
                    <Box
                      key={item.id}
                      sx={{
                        alignSelf: item.isSelf ? "flex-end" : "flex-start",
                        maxWidth: "85%",
                        p: 1.25,
                        borderRadius: 1,
                        border: "1px solid rgba(148,163,184,0.3)",
                        backgroundColor: item.isSelf ? "#DBEAFE" : "#F8FAFC",
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        {item.senderName} ({item.senderRole}) | {safeFormatDate(item.createdAt)}
                      </Typography>
                      <Typography variant="body2">{item.messageText}</Typography>
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
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  disabled={sendingMessage || threadLoading}
                />
                <Button type="submit" variant="contained" disabled={sendingMessage || threadLoading || !draft.trim()}>
                  {sendingMessage ? "Sending..." : "Send message"}
                </Button>
              </Stack>
            </>
          ) : null}
        </ShellSection>
      </Box>
    </Stack>
  );
}
