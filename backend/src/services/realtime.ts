import jwt from "jsonwebtoken";
import type { Server, Socket } from "socket.io";
import { env, hasJwtSecret } from "../config/env";
import { isRole, type Role } from "../constants/roles";
import { hasSupabaseAdmin, supabaseAdmin } from "./supabaseClient";

type RealtimeUser = {
  sub: string;
  email: string;
  role: Role;
  name?: string;
};

type SocketAck =
  | { status: "ok"; room?: string }
  | { status: "error"; message: string };

type CaseRoomPayload = {
  caseId?: unknown;
};

type InternalRoomPayload = {
  peerUserId?: unknown;
};

type NotificationEvent = {
  id: string;
  userId: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export type CaseChatMessageEvent = {
  id: string;
  caseId: string;
  senderId: string | null;
  senderRole: Role;
  senderName: string;
  messageText: string;
  createdAt: string;
  isCustomer: boolean;
};

export type InternalChatMessageEvent = {
  id: string;
  senderId: string;
  senderRole: Role;
  senderName: string;
  recipientId: string;
  recipientRole: Role;
  recipientName: string;
  messageText: string;
  createdAt: string;
};

let ioRef: Server | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toSocketError(message: string): Error {
  const error = new Error(message) as Error & { data?: { message: string } };
  error.data = { message };
  return error;
}

function readTokenFromSocket(socket: Socket): string | null {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === "string" && authToken.trim()) {
    return authToken.startsWith("Bearer ") ? authToken.slice("Bearer ".length) : authToken;
  }

  const headerToken = socket.handshake.headers.authorization;
  if (typeof headerToken === "string" && headerToken.trim().startsWith("Bearer ")) {
    return headerToken.slice("Bearer ".length).trim();
  }

  return null;
}

function parseRealtimeUser(rawToken: string): RealtimeUser | null {
  if (!hasJwtSecret) {
    return null;
  }

  try {
    const decoded = jwt.verify(rawToken, env.jwtSecret) as jwt.JwtPayload | string;
    if (typeof decoded === "string") {
      return null;
    }

    if (
      typeof decoded.sub !== "string" ||
      typeof decoded.email !== "string" ||
      !isRole(decoded.role)
    ) {
      return null;
    }

    return {
      sub: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      name: typeof decoded.name === "string" ? decoded.name : undefined,
    };
  } catch {
    return null;
  }
}

function getAllowedInternalPeerRoles(role: Role): Role[] {
  switch (role) {
    case "CSR":
      return ["Manager", "Executive", "Admin"];
    case "Manager":
      return ["CSR", "Executive", "Admin"];
    case "Executive":
      return ["CSR", "Manager", "Admin"];
    case "Admin":
      return ["CSR", "Manager", "Executive", "Admin"];
    case "Customer":
      return [];
    default:
      return [];
  }
}

function canUsersChatInternally(roleA: Role, roleB: Role): boolean {
  return getAllowedInternalPeerRoles(roleA).includes(roleB) && getAllowedInternalPeerRoles(roleB).includes(roleA);
}

export function getUserRoomName(userId: string): string {
  return `user:${userId}`;
}

export function getCaseRoomName(caseId: string): string {
  return `case:${caseId}`;
}

export function getInternalRoomName(userA: string, userB: string): string {
  const [left, right] = [userA, userB].sort((a, b) => a.localeCompare(b));
  return `internal:${left}:${right}`;
}

async function canJoinCaseRoom(user: RealtimeUser, caseId: string): Promise<boolean> {
  if (!hasSupabaseAdmin || !supabaseAdmin) {
    return false;
  }

  if (user.role === "Customer") {
    const customerResult = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("user_id", user.sub)
      .maybeSingle();

    if (customerResult.error || !customerResult.data) {
      return false;
    }

    const caseResult = await supabaseAdmin
      .from("cases")
      .select("id")
      .eq("id", caseId)
      .eq("customer_id", customerResult.data.id)
      .maybeSingle();

    return Boolean(caseResult.data && !caseResult.error);
  }

  if (user.role === "CSR") {
    const caseResult = await supabaseAdmin
      .from("cases")
      .select("id")
      .eq("id", caseId)
      .eq("assigned_to", user.sub)
      .maybeSingle();

    return Boolean(caseResult.data && !caseResult.error);
  }

  return false;
}

async function canJoinInternalRoom(user: RealtimeUser, peerUserId: string): Promise<boolean> {
  if (!hasSupabaseAdmin || !supabaseAdmin) {
    return false;
  }

  if (peerUserId === user.sub) {
    return false;
  }

  const peerResult = await supabaseAdmin
    .from("users")
    .select("id,role")
    .eq("id", peerUserId)
    .maybeSingle();

  if (peerResult.error || !peerResult.data || !isRole(peerResult.data.role)) {
    return false;
  }

  return canUsersChatInternally(user.role, peerResult.data.role);
}

function callAck(callback: unknown, payload: SocketAck) {
  if (typeof callback === "function") {
    (callback as (value: SocketAck) => void)(payload);
  }
}

function toCaseRoomPayload(payload: unknown): { caseId: string } | null {
  if (!isRecord(payload)) {
    return null;
  }

  const parsed = payload as CaseRoomPayload;
  if (typeof parsed.caseId !== "string" || !isUuid(parsed.caseId)) {
    return null;
  }

  return { caseId: parsed.caseId };
}

function toInternalRoomPayload(payload: unknown): { peerUserId: string } | null {
  if (!isRecord(payload)) {
    return null;
  }

  const parsed = payload as InternalRoomPayload;
  if (typeof parsed.peerUserId !== "string" || !isUuid(parsed.peerUserId)) {
    return null;
  }

  return { peerUserId: parsed.peerUserId };
}

function getSocketUser(socket: Socket): RealtimeUser | null {
  const user = socket.data.user;
  if (!isRecord(user)) {
    return null;
  }

  if (
    typeof user.sub !== "string" ||
    typeof user.email !== "string" ||
    !isRole(user.role)
  ) {
    return null;
  }

  return {
    sub: user.sub,
    email: user.email,
    role: user.role,
    name: typeof user.name === "string" ? user.name : undefined,
  };
}

function setupSocketAuth(io: Server) {
  io.use((socket, next) => {
    if (!hasJwtSecret) {
      next(toSocketError("JWT_SECRET is required in backend/.env."));
      return;
    }

    const token = readTokenFromSocket(socket);
    if (!token) {
      next(toSocketError("Missing realtime auth token."));
      return;
    }

    const user = parseRealtimeUser(token);
    if (!user) {
      next(toSocketError("Invalid realtime auth token."));
      return;
    }

    socket.data.user = user;
    next();
  });
}

function setupSocketHandlers(io: Server) {
  io.on("connection", (socket) => {
    const user = getSocketUser(socket);
    if (!user) {
      socket.disconnect(true);
      return;
    }

    socket.join(getUserRoomName(user.sub));
    socket.emit("connected", {
      message: "Socket.io connected to TreeCRM backend",
      user: {
        id: user.sub,
        email: user.email,
        role: user.role,
      },
    });

    socket.on("chat:join-case", async (payload: unknown, callback?: (result: SocketAck) => void) => {
      const parsed = toCaseRoomPayload(payload);
      if (!parsed) {
        callAck(callback, { status: "error", message: "caseId must be a valid UUID." });
        return;
      }

      const allowed = await canJoinCaseRoom(user, parsed.caseId);
      if (!allowed) {
        callAck(callback, { status: "error", message: "You are not allowed to join this case room." });
        return;
      }

      const room = getCaseRoomName(parsed.caseId);
      socket.join(room);
      callAck(callback, { status: "ok", room });
    });

    socket.on("chat:leave-case", (payload: unknown, callback?: (result: SocketAck) => void) => {
      const parsed = toCaseRoomPayload(payload);
      if (!parsed) {
        callAck(callback, { status: "error", message: "caseId must be a valid UUID." });
        return;
      }

      const room = getCaseRoomName(parsed.caseId);
      socket.leave(room);
      callAck(callback, { status: "ok", room });
    });

    socket.on("chat:join-internal", async (payload: unknown, callback?: (result: SocketAck) => void) => {
      const parsed = toInternalRoomPayload(payload);
      if (!parsed) {
        callAck(callback, { status: "error", message: "peerUserId must be a valid UUID." });
        return;
      }

      const allowed = await canJoinInternalRoom(user, parsed.peerUserId);
      if (!allowed) {
        callAck(callback, { status: "error", message: "You are not allowed in this internal chat room." });
        return;
      }

      const room = getInternalRoomName(user.sub, parsed.peerUserId);
      socket.join(room);
      callAck(callback, { status: "ok", room });
    });

    socket.on("chat:leave-internal", (payload: unknown, callback?: (result: SocketAck) => void) => {
      const parsed = toInternalRoomPayload(payload);
      if (!parsed) {
        callAck(callback, { status: "error", message: "peerUserId must be a valid UUID." });
        return;
      }

      const room = getInternalRoomName(user.sub, parsed.peerUserId);
      socket.leave(room);
      callAck(callback, { status: "ok", room });
    });
  });
}

export function initializeRealtime(io: Server) {
  ioRef = io;
  setupSocketAuth(io);
  setupSocketHandlers(io);
}

export function emitCaseChatMessage(payload: CaseChatMessageEvent) {
  if (!ioRef) {
    return;
  }

  ioRef.to(getCaseRoomName(payload.caseId)).emit("chat:case:message", payload);
}

export function emitInternalChatMessage(payload: InternalChatMessageEvent) {
  if (!ioRef) {
    return;
  }

  ioRef
    .to(getInternalRoomName(payload.senderId, payload.recipientId))
    .emit("chat:internal:message", payload);
}

export function emitNotification(payload: NotificationEvent) {
  if (!ioRef) {
    return;
  }

  ioRef.to(getUserRoomName(payload.userId)).emit("notification:new", payload);
}
