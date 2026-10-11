/** Someone the user can open a mini profile for and start a conversation with. */
export interface ChatContact {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface MiniProfile extends ChatContact {
  city: string;
  bio: string;
  memberSince: string;
  topicsCount: number;
  repliesCount: number;
}

/** A message as rendered by the conversation screen. */
export interface ConversationMessage {
  id: string;
  senderId: string;
  text: string;
  sentAt: Date;
}

/** One row of the user's chat list. */
export interface ChatSummary {
  id: string;
  title: string;
  avatarUrl: string | null;
  preview: string;
  lastMessageAt: Date;
  unreadCount: number;
  /** The other person in a direct chat; null for groups. */
  contact: ChatContact | null;
}
