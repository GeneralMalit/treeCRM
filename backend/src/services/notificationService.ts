import { hasSupabaseAdmin, supabaseAdmin } from "./supabaseClient";
import { emitNotification } from "./realtime";

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
};

type CreateNotificationInput = {
  userId: string;
  type: string;
  message: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNotificationRow(value: unknown): NotificationRow | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.user_id !== "string" ||
    typeof value.type !== "string" ||
    typeof value.message !== "string" ||
    typeof value.read !== "boolean" ||
    typeof value.created_at !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    user_id: value.user_id,
    type: value.type,
    message: value.message,
    read: value.read,
    created_at: value.created_at,
  };
}

export async function createNotification(input: CreateNotificationInput): Promise<NotificationRow | null> {
  if (!hasSupabaseAdmin || !supabaseAdmin) {
    return null;
  }

  const insertResult = await supabaseAdmin
    .from("notifications")
    .insert({
      user_id: input.userId,
      type: input.type,
      message: input.message,
      read: false,
    })
    .select("id,user_id,type,message,read,created_at")
    .single();

  if (insertResult.error) {
    console.warn("Failed to create notification:", insertResult.error.message);
    return null;
  }

  const notification = toNotificationRow(insertResult.data);
  if (!notification) {
    return null;
  }

  emitNotification({
    id: notification.id,
    userId: notification.user_id,
    type: notification.type,
    message: notification.message,
    read: notification.read,
    createdAt: notification.created_at,
  });

  return notification;
}
