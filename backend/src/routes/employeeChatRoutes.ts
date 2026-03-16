import express from "express";
import { isRole, type Role } from "../constants/roles";
import {
  canUsersChatInternally,
  getAllowedInternalPeerRoles,
  parseMessageBody,
  parseUuidParam,
} from "../domain/employeeChatLogic";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { createNotification } from "../services/notificationService";
import { emitCaseChatMessage, emitInternalChatMessage } from "../services/realtime";
import { hasSupabaseAdmin, supabaseAdmin } from "../services/supabaseClient";

type MessageType = "text" | "internal_note" | "system";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  created_at: string;
};

type CaseRow = {
  id: string;
  customer_id: string;
  assigned_to: string | null;
  title: string;
};

type CustomerRow = {
  id: string;
  user_id: string;
};

type CaseMessageRow = {
  id: string;
  case_id: string;
  sender_id: string | null;
  sender_role: Role;
  message_type: MessageType;
  message_text: string;
  created_at: string;
};

type InternalMessageRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  message_text: string;
  created_at: string;
};

const MESSAGE_TYPE_VALUES = ["text", "internal_note", "system"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMessageType(value: unknown): value is MessageType {
  return (
    typeof value === "string" && MESSAGE_TYPE_VALUES.includes(value as (typeof MESSAGE_TYPE_VALUES)[number])
  );
}

function getDisplayName(user: { name?: string | null; email: string }): string {
  if (typeof user.name === "string" && user.name.trim()) {
    return user.name.trim();
  }

  return user.email;
}

function ensureSupabase() {
  if (!hasSupabaseAdmin || !supabaseAdmin) {
    return null;
  }

  return supabaseAdmin;
}

function isMissingRpcFunctionError(message: string | undefined): boolean {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return normalized.includes("could not find the function") || normalized.includes("function") && normalized.includes("does not exist");
}

function extractRpcRecord(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) {
    const [first] = data;
    return isRecord(first) ? first : null;
  }

  return isRecord(data) ? data : null;
}

function toUserRows(rows: unknown[]): UserRow[] {
  return rows
    .filter((row): row is Record<string, unknown> => isRecord(row))
    .filter((row) => {
      return (
        typeof row.id === "string" &&
        typeof row.email === "string" &&
        (typeof row.name === "string" || row.name === null) &&
        typeof row.created_at === "string" &&
        isRole(row.role)
      );
    })
    .map((row) => ({
      id: row.id as string,
      email: row.email as string,
      name: (row.name as string | null) ?? null,
      role: row.role as Role,
      created_at: row.created_at as string,
    }));
}

function toCaseRows(rows: unknown[]): CaseRow[] {
  return rows
    .filter((row): row is Record<string, unknown> => isRecord(row))
    .filter((row) => {
      return (
        typeof row.id === "string" &&
        typeof row.customer_id === "string" &&
        (typeof row.assigned_to === "string" || row.assigned_to === null) &&
        typeof row.title === "string"
      );
    })
    .map((row) => ({
      id: row.id as string,
      customer_id: row.customer_id as string,
      assigned_to: (row.assigned_to as string | null) ?? null,
      title: row.title as string,
    }));
}

function toCustomerRows(rows: unknown[]): CustomerRow[] {
  return rows
    .filter((row): row is Record<string, unknown> => isRecord(row))
    .filter((row) => typeof row.id === "string" && typeof row.user_id === "string")
    .map((row) => ({
      id: row.id as string,
      user_id: row.user_id as string,
    }));
}

function toCaseMessageRows(rows: unknown[]): CaseMessageRow[] {
  return rows
    .filter((row): row is Record<string, unknown> => isRecord(row))
    .filter((row) => {
      return (
        typeof row.id === "string" &&
        typeof row.case_id === "string" &&
        (typeof row.sender_id === "string" || row.sender_id === null) &&
        isRole(row.sender_role) &&
        isMessageType(row.message_type) &&
        typeof row.message_text === "string" &&
        typeof row.created_at === "string"
      );
    })
    .map((row) => ({
      id: row.id as string,
      case_id: row.case_id as string,
      sender_id: (row.sender_id as string | null) ?? null,
      sender_role: row.sender_role as Role,
      message_type: row.message_type as MessageType,
      message_text: row.message_text as string,
      created_at: row.created_at as string,
    }));
}

function toInternalMessageRows(rows: unknown[]): InternalMessageRow[] {
  return rows
    .filter((row): row is Record<string, unknown> => isRecord(row))
    .filter((row) => {
      return (
        typeof row.id === "string" &&
        typeof row.sender_id === "string" &&
        typeof row.recipient_id === "string" &&
        typeof row.message_text === "string" &&
        typeof row.created_at === "string"
      );
    })
    .map((row) => ({
      id: row.id as string,
      sender_id: row.sender_id as string,
      recipient_id: row.recipient_id as string,
      message_text: row.message_text as string,
      created_at: row.created_at as string,
    }));
}

function getRoleSortWeight(role: Role): number {
  switch (role) {
    case "Executive":
      return 1;
    case "Manager":
      return 2;
    case "CSR":
      return 3;
    case "Admin":
      return 4;
    case "Customer":
      return 5;
    default:
      return 99;
  }
}

const router = express.Router();

router.get("/employee/cases/:caseId/messages", requireAuth, requireRole("CSR"), async (req, res) => {
  const client = ensureSupabase();
  if (!client) {
    res.status(500).json({
      status: "error",
      message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for employee chat operations.",
    });
    return;
  }

  const viewer = req.user;
  if (!viewer) {
    res.status(401).json({
      status: "error",
      message: "Authentication is required.",
    });
    return;
  }

  const caseId = parseUuidParam(req.params.caseId, "caseId");
  if ("error" in caseId) {
    res.status(400).json({
      status: "error",
      message: caseId.error,
    });
    return;
  }

  const caseResult = await client
    .from("cases")
    .select("id,customer_id,assigned_to,title")
    .eq("id", caseId.data)
    .maybeSingle();

  if (caseResult.error) {
    res.status(500).json({
      status: "error",
      message: caseResult.error.message,
    });
    return;
  }

  const parsedCase = caseResult.data ? toCaseRows([caseResult.data as unknown])[0] : null;
  if (!parsedCase) {
    res.status(404).json({
      status: "error",
      message: "Case not found.",
    });
    return;
  }

  if (parsedCase.assigned_to !== viewer.sub) {
    res.status(403).json({
      status: "error",
      message: "You can only access chat messages for cases assigned to your account.",
    });
    return;
  }

  const [customerResult, messagesResult] = await Promise.all([
    client.from("customers").select("id,user_id").eq("id", parsedCase.customer_id).maybeSingle(),
    client
      .from("messages")
      .select("id,case_id,sender_id,sender_role,message_type,message_text,created_at")
      .eq("case_id", parsedCase.id)
      .eq("message_type", "text")
      .order("created_at", { ascending: true }),
  ]);

  if (customerResult.error || messagesResult.error) {
    res.status(500).json({
      status: "error",
      message:
        customerResult.error?.message ??
        messagesResult.error?.message ??
        "Failed to load case chat messages.",
    });
    return;
  }

  const customer = customerResult.data ? toCustomerRows([customerResult.data as unknown])[0] : null;
  if (!customer) {
    res.status(404).json({
      status: "error",
      message: "Customer profile for this case was not found.",
    });
    return;
  }

  const messages = toCaseMessageRows((messagesResult.data ?? []) as unknown[]);
  const relatedUserIds = Array.from(
    new Set(
      [viewer.sub, customer.user_id, ...messages.map((message) => message.sender_id)].filter(
        (value): value is string => typeof value === "string",
      ),
    ),
  );

  const usersById = new Map<string, UserRow>();
  if (relatedUserIds.length > 0) {
    const usersResult = await client
      .from("users")
      .select("id,email,name,role,created_at")
      .in("id", relatedUserIds);

    if (usersResult.error) {
      res.status(500).json({
        status: "error",
        message: usersResult.error.message,
      });
      return;
    }

    for (const user of toUserRows((usersResult.data ?? []) as unknown[])) {
      usersById.set(user.id, user);
    }
  }

  const items = messages.map((message) => {
    const sender = message.sender_id ? usersById.get(message.sender_id) : undefined;
    return {
      id: message.id,
      caseId: message.case_id,
      senderId: message.sender_id,
      senderRole: message.sender_role,
      senderName:
        message.sender_id === viewer.sub
          ? "You"
          : sender?.name || sender?.email || message.sender_role,
      messageText: message.message_text,
      createdAt: message.created_at,
      isCustomer: message.sender_role === "Customer",
      isSelf: message.sender_id === viewer.sub,
    };
  });

  res.json({
    status: "ok",
    data: {
      case: {
        id: parsedCase.id,
        title: parsedCase.title,
      },
      messages: items,
    },
  });
});

router.post("/employee/cases/:caseId/messages", requireAuth, requireRole("CSR"), async (req, res) => {
  const client = ensureSupabase();
  if (!client) {
    res.status(500).json({
      status: "error",
      message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for employee chat operations.",
    });
    return;
  }

  const viewer = req.user;
  if (!viewer) {
    res.status(401).json({
      status: "error",
      message: "Authentication is required.",
    });
    return;
  }

  const caseId = parseUuidParam(req.params.caseId, "caseId");
  if ("error" in caseId) {
    res.status(400).json({
      status: "error",
      message: caseId.error,
    });
    return;
  }

  const parsedBody = parseMessageBody(req.body);
  if ("error" in parsedBody) {
    res.status(400).json({
      status: "error",
      message: parsedBody.error,
    });
    return;
  }

  const caseResult = await client
    .from("cases")
    .select("id,customer_id,assigned_to,title")
    .eq("id", caseId.data)
    .maybeSingle();

  if (caseResult.error) {
    res.status(500).json({
      status: "error",
      message: caseResult.error.message,
    });
    return;
  }

  const parsedCase = caseResult.data ? toCaseRows([caseResult.data as unknown])[0] : null;
  if (!parsedCase) {
    res.status(404).json({
      status: "error",
      message: "Case not found.",
    });
    return;
  }

  if (parsedCase.assigned_to !== viewer.sub) {
    res.status(403).json({
      status: "error",
      message: "You can only send chat messages for cases assigned to your account.",
    });
    return;
  }

  const customerResult = await client
    .from("customers")
    .select("id,user_id")
    .eq("id", parsedCase.customer_id)
    .maybeSingle();

  if (customerResult.error) {
    res.status(500).json({
      status: "error",
      message:
        customerResult.error.message ?? "Failed to load the customer profile for this case.",
    });
    return;
  }

  const customer = customerResult.data ? toCustomerRows([customerResult.data as unknown])[0] : null;
  if (!customer) {
    res.status(500).json({
      status: "error",
      message: "Customer profile for this case was not found.",
    });
    return;
  }

  let parsedMessage: CaseMessageRow | null = null;

  if (typeof client.rpc === "function") {
    const rpcMessageResult = await client.rpc("append_csr_case_message_atomic", {
      p_case_id: parsedCase.id,
      p_assigned_to: viewer.sub,
      p_sender_id: viewer.sub,
      p_message_text: parsedBody.data.messageText,
    });

    if (!rpcMessageResult.error) {
      const rpcMessageRecord = extractRpcRecord(rpcMessageResult.data);
      parsedMessage = rpcMessageRecord ? toCaseMessageRows([rpcMessageRecord])[0] ?? null : null;
    } else if (!isMissingRpcFunctionError(rpcMessageResult.error.message)) {
      if (rpcMessageResult.error.message.includes("CASE_TOUCH_CONFLICT")) {
        res.status(409).json({
          status: "error",
          message: "Case message write conflicted with a concurrent update. Please retry.",
        });
        return;
      }

      res.status(500).json({
        status: "error",
        message: rpcMessageResult.error.message,
      });
      return;
    }
  }

  if (!parsedMessage) {
    const messageInsertResult = await client
      .from("messages")
      .insert({
        case_id: parsedCase.id,
        sender_id: viewer.sub,
        sender_role: "CSR",
        message_type: "text",
        message_text: parsedBody.data.messageText,
      })
      .select("id,case_id,sender_id,sender_role,message_type,message_text,created_at")
      .single();

    if (messageInsertResult.error) {
      res.status(500).json({
        status: "error",
        message: messageInsertResult.error.message,
      });
      return;
    }

    parsedMessage = toCaseMessageRows([messageInsertResult.data as unknown])[0] ?? null;
    if (!parsedMessage) {
      res.status(500).json({
        status: "error",
        message: "Failed to parse created case message payload.",
      });
      return;
    }

    const caseTouchResult = await client
      .from("cases")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", parsedCase.id)
      .eq("assigned_to", viewer.sub)
      .select("id")
      .maybeSingle();

    if (caseTouchResult.error) {
      const cleanupResult = await client.from("messages").delete().eq("id", parsedMessage.id);
      res.status(500).json({
        status: "error",
        message: cleanupResult.error
          ? "Failed to finalize case message write and cleanup also failed. Manual cleanup may be required."
          : "Failed to finalize case message write.",
      });
      return;
    }

    if (!caseTouchResult.data) {
      const cleanupResult = await client.from("messages").delete().eq("id", parsedMessage.id);
      res.status(409).json({
        status: "error",
        message: cleanupResult.error
          ? "Case message write conflicted with a concurrent update and cleanup failed. Manual cleanup may be required."
          : "Case message write conflicted with a concurrent update. Please retry.",
      });
      return;
    }
  }

  if (!parsedMessage) {
    res.status(500).json({
      status: "error",
      message: "Failed to parse created case message payload.",
    });
    return;
  }

  const senderName = getDisplayName({ name: viewer.name, email: viewer.email });

  emitCaseChatMessage({
    id: parsedMessage.id,
    caseId: parsedMessage.case_id,
    senderId: parsedMessage.sender_id,
    senderRole: parsedMessage.sender_role,
    senderName,
    messageText: parsedMessage.message_text,
    createdAt: parsedMessage.created_at,
    isCustomer: false,
  });

  if (customer.user_id !== viewer.sub) {
    await createNotification({
      userId: customer.user_id,
      type: "case_message",
      message: `New support reply on "${parsedCase.title}".`,
    });
  }

  res.status(201).json({
    status: "ok",
    data: {
      message: {
        id: parsedMessage.id,
        caseId: parsedMessage.case_id,
        senderId: parsedMessage.sender_id,
        senderRole: parsedMessage.sender_role,
        senderName: "You",
        messageText: parsedMessage.message_text,
        createdAt: parsedMessage.created_at,
        isCustomer: false,
        isSelf: true,
      },
    },
  });
});

router.get(
  "/employee/internal-chat/contacts",
  requireAuth,
  requireRole("CSR", "Manager", "Executive", "Admin"),
  async (req, res) => {
    const client = ensureSupabase();
    if (!client) {
      res.status(500).json({
        status: "error",
        message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for employee chat operations.",
      });
      return;
    }

    const viewer = req.user;
    if (!viewer) {
      res.status(401).json({
        status: "error",
        message: "Authentication is required.",
      });
      return;
    }

    const allowedRoles = getAllowedInternalPeerRoles(viewer.role);
    if (allowedRoles.length === 0) {
      res.status(403).json({
        status: "error",
        message: "Your role is not allowed to use internal employee chat.",
      });
      return;
    }

    const usersResult = await client
      .from("users")
      .select("id,email,name,role,created_at")
      .neq("id", viewer.sub)
      .in("role", allowedRoles);

    if (usersResult.error) {
      res.status(500).json({
        status: "error",
        message: usersResult.error.message,
      });
      return;
    }

    const contacts = toUserRows((usersResult.data ?? []) as unknown[])
      .sort((a, b) => {
        const byRole = getRoleSortWeight(a.role) - getRoleSortWeight(b.role);
        if (byRole !== 0) {
          return byRole;
        }

        return (a.name ?? a.email).localeCompare(b.name ?? b.email);
      })
      .map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.created_at,
      }));

    res.json({
      status: "ok",
      data: {
        contacts,
      },
    });
  },
);

router.get(
  "/employee/internal-chat/:peerUserId/messages",
  requireAuth,
  requireRole("CSR", "Manager", "Executive", "Admin"),
  async (req, res) => {
    const client = ensureSupabase();
    if (!client) {
      res.status(500).json({
        status: "error",
        message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for employee chat operations.",
      });
      return;
    }

    const viewer = req.user;
    if (!viewer) {
      res.status(401).json({
        status: "error",
        message: "Authentication is required.",
      });
      return;
    }

    const peerUserId = parseUuidParam(req.params.peerUserId, "peerUserId");
    if ("error" in peerUserId) {
      res.status(400).json({
        status: "error",
        message: peerUserId.error,
      });
      return;
    }

    if (peerUserId.data === viewer.sub) {
      res.status(400).json({
        status: "error",
        message: "peerUserId cannot be the same as the authenticated user.",
      });
      return;
    }

    const peerResult = await client
      .from("users")
      .select("id,email,name,role,created_at")
      .eq("id", peerUserId.data)
      .maybeSingle();

    if (peerResult.error) {
      res.status(500).json({
        status: "error",
        message: peerResult.error.message,
      });
      return;
    }

    const peer = peerResult.data ? toUserRows([peerResult.data as unknown])[0] : null;
    if (!peer) {
      res.status(404).json({
        status: "error",
        message: "Internal chat peer was not found.",
      });
      return;
    }

    if (!canUsersChatInternally(viewer.role, peer.role)) {
      res.status(403).json({
        status: "error",
        message: `Internal chat is not allowed between ${viewer.role} and ${peer.role}.`,
      });
      return;
    }

    const conversationFilter = `and(sender_id.eq.${viewer.sub},recipient_id.eq.${peer.id}),and(sender_id.eq.${peer.id},recipient_id.eq.${viewer.sub})`;
    const messagesResult = await client
      .from("internal_messages")
      .select("id,sender_id,recipient_id,message_text,created_at")
      .or(conversationFilter)
      .order("created_at", { ascending: true });

    if (messagesResult.error) {
      res.status(500).json({
        status: "error",
        message: messagesResult.error.message,
      });
      return;
    }

    const viewerName = getDisplayName({ name: viewer.name, email: viewer.email });
    const peerName = getDisplayName({ name: peer.name, email: peer.email });
    const messages = toInternalMessageRows((messagesResult.data ?? []) as unknown[]).map((message) => {
      const isSelf = message.sender_id === viewer.sub;
      return {
        id: message.id,
        senderId: message.sender_id,
        senderRole: isSelf ? viewer.role : peer.role,
        senderName: isSelf ? "You" : peerName,
        recipientId: message.recipient_id,
        recipientRole: isSelf ? peer.role : viewer.role,
        recipientName: isSelf ? peerName : viewerName,
        messageText: message.message_text,
        createdAt: message.created_at,
        isSelf,
      };
    });

    res.json({
      status: "ok",
      data: {
        peer: {
          id: peer.id,
          name: peer.name,
          email: peer.email,
          role: peer.role,
        },
        messages,
      },
    });
  },
);

router.post(
  "/employee/internal-chat/:peerUserId/messages",
  requireAuth,
  requireRole("CSR", "Manager", "Executive", "Admin"),
  async (req, res) => {
    const client = ensureSupabase();
    if (!client) {
      res.status(500).json({
        status: "error",
        message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for employee chat operations.",
      });
      return;
    }

    const viewer = req.user;
    if (!viewer) {
      res.status(401).json({
        status: "error",
        message: "Authentication is required.",
      });
      return;
    }

    const peerUserId = parseUuidParam(req.params.peerUserId, "peerUserId");
    if ("error" in peerUserId) {
      res.status(400).json({
        status: "error",
        message: peerUserId.error,
      });
      return;
    }

    if (peerUserId.data === viewer.sub) {
      res.status(400).json({
        status: "error",
        message: "peerUserId cannot be the same as the authenticated user.",
      });
      return;
    }

    const parsedBody = parseMessageBody(req.body);
    if ("error" in parsedBody) {
      res.status(400).json({
        status: "error",
        message: parsedBody.error,
      });
      return;
    }

    const peerResult = await client
      .from("users")
      .select("id,email,name,role,created_at")
      .eq("id", peerUserId.data)
      .maybeSingle();

    if (peerResult.error) {
      res.status(500).json({
        status: "error",
        message: peerResult.error.message,
      });
      return;
    }

    const peer = peerResult.data ? toUserRows([peerResult.data as unknown])[0] : null;
    if (!peer) {
      res.status(404).json({
        status: "error",
        message: "Internal chat peer was not found.",
      });
      return;
    }

    if (!canUsersChatInternally(viewer.role, peer.role)) {
      res.status(403).json({
        status: "error",
        message: `Internal chat is not allowed between ${viewer.role} and ${peer.role}.`,
      });
      return;
    }

    const insertResult = await client
      .from("internal_messages")
      .insert({
        sender_id: viewer.sub,
        recipient_id: peer.id,
        message_text: parsedBody.data.messageText,
      })
      .select("id,sender_id,recipient_id,message_text,created_at")
      .single();

    if (insertResult.error) {
      res.status(500).json({
        status: "error",
        message: insertResult.error.message,
      });
      return;
    }

    const parsedMessage = toInternalMessageRows([insertResult.data as unknown])[0];
    if (!parsedMessage) {
      res.status(500).json({
        status: "error",
        message: "Failed to parse created internal chat message payload.",
      });
      return;
    }

    const senderName = getDisplayName({ name: viewer.name, email: viewer.email });
    const peerName = getDisplayName({ name: peer.name, email: peer.email });

    emitInternalChatMessage({
      id: parsedMessage.id,
      senderId: parsedMessage.sender_id,
      senderRole: viewer.role,
      senderName,
      recipientId: parsedMessage.recipient_id,
      recipientRole: peer.role,
      recipientName: peerName,
      messageText: parsedMessage.message_text,
      createdAt: parsedMessage.created_at,
    });

    await createNotification({
      userId: peer.id,
      type: "internal_message",
      message: `New internal message from ${senderName}.`,
    });

    res.status(201).json({
      status: "ok",
      data: {
        message: {
          id: parsedMessage.id,
          senderId: parsedMessage.sender_id,
          senderRole: viewer.role,
          senderName: "You",
          recipientId: parsedMessage.recipient_id,
          recipientRole: peer.role,
          recipientName: peerName,
          messageText: parsedMessage.message_text,
          createdAt: parsedMessage.created_at,
          isSelf: true,
        },
      },
    });
  },
);

export const employeeChatRouter = router;
