export type ChatType = 'direct' | 'group';
export type ChatMessageType = 'text' | 'system';
export type ChatSystemEventKind =
  | 'group_created'
  | 'member_added'
  | 'member_removed'
  | 'member_left'
  | 'admin_promoted'
  | 'admin_demoted'
  | 'group_renamed';

export interface ChatParticipant {
  fullName: string;
  avatarUrl: string | null;
}

export interface ChatLastMessage {
  messageId: string;
  authorId: string;
  /** Truncated to LAST_MESSAGE_PREVIEW_LENGTH chars. */
  message: string;
  createdAt: Date;
  isDeleted: boolean;
}

export interface Chat {
  id: string;
  type: ChatType;
  userIds: string[];
  participants: Record<string, ChatParticipant>;
  name: string | null;
  avatarUrl: string | null;
  createdBy: string | null;
  adminIds: string[];
  lastMessage: ChatLastMessage | null;
  lastMessageAt: Date;
  unreadCounts: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatSystemEvent {
  kind: ChatSystemEventKind;
  actorId: string;
  targetIds: string[];
}

export interface ChatMessage {
  id: string;
  chatId: string;
  type: ChatMessageType;
  authorId: string | null;
  authorSnapshot: ChatParticipant | null;
  message: string | null;
  systemEvent: ChatSystemEvent | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemberInput {
  userId: string;
  profile: ChatParticipant;
}

export interface OpenDirectChatDTO {
  currentUser: MemberInput;
  otherUser: MemberInput;
}

export interface CreateGroupChatDTO {
  creator: MemberInput;
  members: MemberInput[];
  name: string;
  avatarUrl?: string | null;
}

export interface UpdateGroupInfoDTO {
  chatId: string;
  actorId: string;
  name?: string;
  avatarUrl?: string | null;
}

export interface AddGroupMembersDTO {
  chatId: string;
  actorId: string;
  members: MemberInput[];
}

export interface SendChatMessageDTO {
  chatId: string;
  authorId: string;
  authorSnapshot: ChatParticipant;
  message: string;
}
