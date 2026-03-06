import { io, type Socket } from "socket.io-client";
import type { Role } from "./roles";

const SOCKET_BASE_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type RoomAckResponse =
  | {
      status: "ok";
      room?: string;
    }
  | {
      status: "error";
      message: string;
    };

export type RealtimeSocket = Socket;

export type CaseChatSocketMessage = {
  id: string;
  caseId: string;
  senderId: string | null;
  senderRole: Role;
  senderName: string;
  messageText: string;
  createdAt: string;
  isCustomer: boolean;
};

export type InternalChatSocketMessage = {
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

export type NotificationSocketEvent = {
  id: string;
  userId: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
};

let socketInstance: Socket | null = null;
let socketToken: string | null = null;

function emitRoomAction(
  socket: Socket,
  eventName: string,
  payload: Record<string, unknown>,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    socket.emit(eventName, payload, (response?: RoomAckResponse) => {
      if (!response) {
        reject(new Error("Realtime server did not acknowledge the room request."));
        return;
      }

      if (response.status === "error") {
        reject(new Error(response.message));
        return;
      }

      resolve();
    });
  });
}

export function getRealtimeSocket(accessToken: string): RealtimeSocket {
  if (socketInstance && socketToken === accessToken) {
    if (!socketInstance.connected) {
      socketInstance.connect();
    }

    return socketInstance;
  }

  if (socketInstance) {
    socketInstance.removeAllListeners();
    socketInstance.disconnect();
    socketInstance = null;
    socketToken = null;
  }

  socketInstance = io(SOCKET_BASE_URL, {
    auth: {
      token: accessToken,
    },
    transports: ["websocket"],
    autoConnect: true,
  });
  socketToken = accessToken;

  return socketInstance;
}

export function disconnectRealtimeSocket(): void {
  if (!socketInstance) {
    return;
  }

  socketInstance.removeAllListeners();
  socketInstance.disconnect();
  socketInstance = null;
  socketToken = null;
}

export async function joinCaseRoom(socket: RealtimeSocket, caseId: string): Promise<void> {
  await emitRoomAction(socket, "chat:join-case", { caseId });
}

export async function leaveCaseRoom(socket: RealtimeSocket, caseId: string): Promise<void> {
  await emitRoomAction(socket, "chat:leave-case", { caseId });
}

export async function joinInternalRoom(socket: RealtimeSocket, peerUserId: string): Promise<void> {
  await emitRoomAction(socket, "chat:join-internal", { peerUserId });
}

export async function leaveInternalRoom(socket: RealtimeSocket, peerUserId: string): Promise<void> {
  await emitRoomAction(socket, "chat:leave-internal", { peerUserId });
}
