/** Someone the user can open a mini profile for and start a conversation with. */
export interface ChatParticipant {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface MiniProfile extends ChatParticipant {
  city: string;
  bio: string;
  memberSince: string;
  topicsCount: number;
  repliesCount: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  sentAt: Date;
}
