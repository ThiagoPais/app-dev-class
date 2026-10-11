// Type-level tests for spec 002-chat-service §3.1. Checked by `npx tsc --noEmit`.
// Not a runtime test: only type imports, no executable statements with side effects.
import type {
  AddGroupMembersDTO,
  Chat,
  ChatLastMessage,
  ChatMessage,
  ChatMessageType,
  ChatParticipant,
  ChatSystemEvent,
  ChatSystemEventKind,
  ChatType,
  CreateGroupChatDTO,
  MemberInput,
  OpenDirectChatDTO,
  SendChatMessageDTO,
  UpdateGroupInfoDTO,
} from '../src/domains/chat/models';

// ---- type-equality helpers -------------------------------------------------
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

// ---- string unions: exact members -------------------------------------------
export type _ChatType = Expect<Equals<ChatType, 'direct' | 'group'>>;
export type _ChatMessageType = Expect<Equals<ChatMessageType, 'text' | 'system'>>;
export type _ChatSystemEventKind = Expect<
  Equals<
    ChatSystemEventKind,
    | 'group_created'
    | 'member_added'
    | 'member_removed'
    | 'member_left'
    | 'admin_promoted'
    | 'admin_demoted'
    | 'group_renamed'
  >
>;

// ---- ChatParticipant --------------------------------------------------------
export const participantWithAvatar = {
  fullName: 'Ana',
  avatarUrl: 'https://x/a.png',
} satisfies ChatParticipant;
export const participantNoAvatar = { fullName: 'Bob', avatarUrl: null } satisfies ChatParticipant;
// @ts-expect-error avatarUrl is required (null, not undefined/omitted)
export const participantMissingAvatar: ChatParticipant = { fullName: 'Bob' };
// @ts-expect-error avatarUrl cannot be undefined
export const participantUndefAvatar: ChatParticipant = { fullName: 'Bob', avatarUrl: undefined };
// @ts-expect-error fullName must be string
export const participantBadName: ChatParticipant = { fullName: 1, avatarUrl: null };

// ---- ChatLastMessage ---------------------------------------------------------
export const lastMessage = {
  messageId: 'm1',
  authorId: 'u1',
  message: 'hi',
  createdAt: new Date(0),
  isDeleted: false,
} satisfies ChatLastMessage;
// @ts-expect-error isDeleted is required
export const lastMessageMissing: ChatLastMessage = {
  messageId: 'm1',
  authorId: 'u1',
  message: 'hi',
  createdAt: new Date(0),
};
export const lastMessageBadDate: ChatLastMessage = {
  messageId: 'm1',
  authorId: 'u1',
  message: 'hi',
  // @ts-expect-error createdAt is a Date, not a string
  createdAt: '2024-01-01',
  isDeleted: false,
};

// ---- Chat (direct and group) -------------------------------------------------
export const directChat = {
  id: 'a_b',
  type: 'direct',
  userIds: ['a', 'b'],
  participants: { a: participantNoAvatar, b: participantWithAvatar },
  name: null,
  avatarUrl: null,
  createdBy: null,
  adminIds: [],
  lastMessage: null,
  lastMessageAt: new Date(0),
  unreadCounts: { a: 0, b: 0 },
  createdAt: new Date(0),
  updatedAt: new Date(0),
} satisfies Chat;

export const groupChat = {
  id: 'g1',
  type: 'group',
  userIds: ['a', 'b', 'c'],
  participants: { a: participantNoAvatar, b: participantWithAvatar, c: participantNoAvatar },
  name: 'Class',
  avatarUrl: 'https://x/g.png',
  createdBy: 'a',
  adminIds: ['a'],
  lastMessage,
  lastMessageAt: new Date(0),
  unreadCounts: { a: 0, b: 1, c: 2 },
  createdAt: new Date(0),
  updatedAt: new Date(0),
} satisfies Chat;

export const chatBadType: Chat = {
  ...directChat,
  // @ts-expect-error invalid ChatType literal
  type: 'channel',
};
export const chatBadUnread: Chat = {
  ...directChat,
  // @ts-expect-error unreadCounts must be Record<string, number>
  unreadCounts: { a: '0' },
};
export const chatUnreadArray: Chat = {
  ...directChat,
  // @ts-expect-error unreadCounts is a record, not an array
  unreadCounts: [0, 0],
};
export const chatNameUndefined: Chat = {
  ...directChat,
  // @ts-expect-error name is string | null, not undefined
  name: undefined,
};
export const chatBadParticipants: Chat = {
  ...directChat,
  // @ts-expect-error participant values need fullName/avatarUrl
  participants: { a: 'Ana' },
};
export const chatBadLastMessage: Chat = {
  ...directChat,
  // @ts-expect-error lastMessage is ChatLastMessage | null
  lastMessage: 'hi',
};
// @ts-expect-error adminIds is required
export const chatMissingAdminIds: Chat = (({ adminIds: _a, ...rest }) => rest)(directChat);

// ---- ChatSystemEvent ---------------------------------------------------------
export const systemEvent = {
  kind: 'member_added',
  actorId: 'a',
  targetIds: ['b', 'c'],
} satisfies ChatSystemEvent;
export const systemEventBadKind: ChatSystemEvent = {
  // @ts-expect-error invalid system event kind
  kind: 'member_banned',
  actorId: 'a',
  targetIds: [],
};
// @ts-expect-error targetIds is required
export const systemEventMissing: ChatSystemEvent = { kind: 'member_left', actorId: 'a' };

// ---- ChatMessage (text vs system) ------------------------------------------------
export const textMessage = {
  id: 'm1',
  chatId: 'g1',
  type: 'text',
  authorId: 'a',
  authorSnapshot: participantNoAvatar,
  message: 'hello',
  systemEvent: null,
  isDeleted: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
} satisfies ChatMessage;

export const systemMessage = {
  id: 'm2',
  chatId: 'g1',
  type: 'system',
  authorId: null,
  authorSnapshot: null,
  message: null,
  systemEvent,
  isDeleted: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
} satisfies ChatMessage;

export const messageAuthorUndefined: ChatMessage = {
  ...systemMessage,
  // @ts-expect-error authorId must be null (not undefined) for system
  authorId: undefined,
};
export const messageBadType: ChatMessage = {
  ...textMessage,
  // @ts-expect-error invalid ChatMessageType literal
  type: 'image',
};
// @ts-expect-error systemEvent is a required field (null for text)
export const messageMissingSystemEvent: ChatMessage = (({ systemEvent: _s, ...rest }) => rest)(
  textMessage,
);
// @ts-expect-error chatId is required
export const messageMissingChatId: ChatMessage = (({ chatId: _c, ...rest }) => rest)(textMessage);
export const messageBadEventKind: ChatMessage = {
  ...systemMessage,
  // @ts-expect-error systemEvent must be a ChatSystemEvent
  systemEvent: { kind: 'nope', actorId: 'a', targetIds: [] },
};

// ---- MemberInput ----------------------------------------------------------------
export const member = { userId: 'a', profile: participantNoAvatar } satisfies MemberInput;
// @ts-expect-error profile is required
export const memberMissingProfile: MemberInput = { userId: 'a' };

// ---- DTOs ------------------------------------------------------------------------
export const openDirect = {
  currentUser: member,
  otherUser: { userId: 'b', profile: participantWithAvatar },
} satisfies OpenDirectChatDTO;
// @ts-expect-error otherUser is required
export const openDirectMissing: OpenDirectChatDTO = { currentUser: member };

// avatarUrl optional (omitted)
export const createGroupMinimal = {
  creator: member,
  members: [member],
  name: 'Class',
} satisfies CreateGroupChatDTO;
// avatarUrl optional but may be string or null
export const createGroupAvatar = {
  creator: member,
  members: [member],
  name: 'Class',
  avatarUrl: 'https://x/g.png',
} satisfies CreateGroupChatDTO;
export const createGroupNullAvatar = {
  creator: member,
  members: [member],
  name: 'Class',
  avatarUrl: null,
} satisfies CreateGroupChatDTO;
// @ts-expect-error name is required
export const createGroupNoName: CreateGroupChatDTO = { creator: member, members: [member] };
// @ts-expect-error members is required
export const createGroupNoMembers: CreateGroupChatDTO = { creator: member, name: 'x' };

// name and avatarUrl both optional
export const updateInfoEmpty = { chatId: 'g1', actorId: 'a' } satisfies UpdateGroupInfoDTO;
export const updateInfoName = { chatId: 'g1', actorId: 'a', name: 'New' } satisfies UpdateGroupInfoDTO;
export const updateInfoClearAvatar = {
  chatId: 'g1',
  actorId: 'a',
  avatarUrl: null,
} satisfies UpdateGroupInfoDTO;
// @ts-expect-error actorId is required
export const updateInfoNoActor: UpdateGroupInfoDTO = { chatId: 'g1' };
export const updateInfoNullName: UpdateGroupInfoDTO = {
  chatId: 'g1',
  actorId: 'a',
  // @ts-expect-error name is string (optional), not nullable
  name: null,
};

export const addMembers = {
  chatId: 'g1',
  actorId: 'a',
  members: [member],
} satisfies AddGroupMembersDTO;
// @ts-expect-error members is required
export const addMembersMissing: AddGroupMembersDTO = { chatId: 'g1', actorId: 'a' };

export const sendDto = {
  chatId: 'g1',
  authorId: 'a',
  authorSnapshot: participantNoAvatar,
  message: 'hello',
} satisfies SendChatMessageDTO;
// @ts-expect-error authorSnapshot is required
export const sendDtoMissingSnapshot: SendChatMessageDTO = { chatId: 'g1', authorId: 'a', message: 'x' };
export const sendDtoNullSnapshot: SendChatMessageDTO = {
  chatId: 'g1',
  authorId: 'a',
  // @ts-expect-error authorSnapshot must not be null in the DTO
  authorSnapshot: null,
  message: 'x',
};
