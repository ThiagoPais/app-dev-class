import type { Timestamp } from 'firebase/firestore';

import { LAST_MESSAGE_PREVIEW_LENGTH } from '../constants';
import type {
  Chat,
  ChatLastMessage,
  ChatMessage,
  ChatMessageType,
  ChatParticipant,
  ChatSystemEvent,
  ChatSystemEventKind,
  ChatType,
} from '../models';

type WireData = Record<string, unknown>;

export function toDate(value: Timestamp | Date | null | undefined): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === 'object' && 'toDate' in value) return value.toDate();
  return new Date();
}

export function toFirestoreParticipant(participant: ChatParticipant) {
  return {
    full_name: participant.fullName,
    avatar_url: participant.avatarUrl,
  };
}

export function mapParticipant(data: WireData | undefined): ChatParticipant {
  return {
    fullName: (data?.full_name as string) ?? '',
    avatarUrl: (data?.avatar_url as string | null) ?? null,
  };
}

function mapLastMessage(data: WireData | null | undefined): ChatLastMessage | null {
  if (!data) return null;
  return {
    messageId: data.message_id as string,
    authorId: data.author_id as string,
    message: (data.message as string) ?? '',
    createdAt: toDate(data.created_at as Timestamp),
    isDeleted: (data.is_deleted as boolean) ?? false,
  };
}

export function mapDocToChat(id: string, data: WireData): Chat {
  const participants = (data.participants as Record<string, WireData> | undefined) ?? {};
  return {
    id,
    type: data.type as ChatType,
    userIds: (data.user_ids as string[]) ?? [],
    participants: Object.fromEntries(
      Object.entries(participants).map(([uid, participant]) => [uid, mapParticipant(participant)])
    ),
    name: (data.name as string | null) ?? null,
    avatarUrl: (data.avatar_url as string | null) ?? null,
    createdBy: (data.created_by as string | null) ?? null,
    adminIds: (data.admin_ids as string[]) ?? [],
    lastMessage: mapLastMessage(data.last_message as WireData | null | undefined),
    lastMessageAt: toDate(data.last_message_at as Timestamp),
    unreadCounts: (data.unread_counts as Record<string, number>) ?? {},
    createdAt: toDate(data.created_at as Timestamp),
    updatedAt: toDate(data.updated_at as Timestamp),
  };
}

function mapSystemEvent(data: WireData | null | undefined): ChatSystemEvent | null {
  if (!data) return null;
  return {
    kind: data.kind as ChatSystemEventKind,
    actorId: data.actor_id as string,
    targetIds: (data.target_ids as string[]) ?? [],
  };
}

export function mapDocToChatMessage(id: string, chatId: string, data: WireData): ChatMessage {
  const authorSnapshot = data.author_snapshot as WireData | null | undefined;
  return {
    id,
    chatId,
    type: data.type as ChatMessageType,
    authorId: (data.author_id as string | null) ?? null,
    authorSnapshot: authorSnapshot ? mapParticipant(authorSnapshot) : null,
    message: (data.message as string | null) ?? null,
    systemEvent: mapSystemEvent(data.system_event as WireData | null | undefined),
    isDeleted: (data.is_deleted as boolean) ?? false,
    createdAt: toDate(data.created_at as Timestamp),
    updatedAt: toDate(data.updated_at as Timestamp),
  };
}

export function truncatePreview(text: string): string {
  return text.slice(0, LAST_MESSAGE_PREVIEW_LENGTH);
}
