import { expect, mock, test } from 'bun:test';

import { LAST_MESSAGE_PREVIEW_LENGTH } from '../src/domains/chat/constants/index.ts';
import {
  mapDocToChat,
  mapDocToChatMessage,
  mapParticipant,
  toDate,
  toFirestoreParticipant,
  truncatePreview,
} from '../src/domains/chat/services/chat.helpers.ts';

// The barrel re-exports chat.service.ts, which imports the Firebase client (and react-native).
mock.module('../src/services/firebase.ts', () => ({ db: {}, auth: { currentUser: null } }));
const services = await import('../src/domains/chat/services/index.ts');

const d1 = new Date('2026-01-01T10:00:00.000Z');
const d2 = new Date('2026-01-02T11:00:00.000Z');
const d3 = new Date('2026-01-03T12:00:00.000Z');
const ts = (date) => ({ toDate: () => date });

// ---- toDate ----

test('toDate converts a Timestamp-like object', () => {
  expect(toDate(ts(d1))).toBe(d1);
});

test('toDate returns the same Date for a Date', () => {
  expect(toDate(d2)).toBe(d2);
});

test('toDate falls back to now for null, undefined and other values', () => {
  for (const value of [null, undefined, 42, 'x', {}]) {
    const before = Date.now();
    const result = toDate(value);
    expect(result).toBeInstanceOf(Date);
    expect(Math.abs(result.getTime() - before)).toBeLessThan(2000);
  }
});

// ---- participants ----

test('toFirestoreParticipant maps to snake_case', () => {
  expect(toFirestoreParticipant({ fullName: 'Ana Lima', avatarUrl: 'http://a/b.png' })).toEqual({
    full_name: 'Ana Lima',
    avatar_url: 'http://a/b.png',
  });
  expect(toFirestoreParticipant({ fullName: 'Bob', avatarUrl: null })).toEqual({
    full_name: 'Bob',
    avatar_url: null,
  });
});

test('mapParticipant maps snake_case to camelCase', () => {
  expect(mapParticipant({ full_name: 'Ana', avatar_url: 'u' })).toEqual({
    fullName: 'Ana',
    avatarUrl: 'u',
  });
});

test('mapParticipant applies defaults for undefined or missing fields', () => {
  expect(mapParticipant(undefined)).toEqual({ fullName: '', avatarUrl: null });
  expect(mapParticipant({})).toEqual({ fullName: '', avatarUrl: null });
  expect(mapParticipant({ full_name: 'Z' })).toEqual({ fullName: 'Z', avatarUrl: null });
});

// ---- mapDocToChat ----

const fullGroupDoc = () => ({
  type: 'group',
  user_ids: ['u1', 'u2', 'u3'],
  participants: {
    u1: { full_name: 'One', avatar_url: null },
    u2: { full_name: 'Two', avatar_url: 'http://two' },
    u3: { full_name: 'Three', avatar_url: null },
  },
  name: 'Study group',
  avatar_url: 'http://group',
  created_by: 'u1',
  admin_ids: ['u1'],
  last_message: {
    message_id: 'm1',
    author_id: 'u2',
    message: 'hello',
    created_at: ts(d2),
    is_deleted: true,
  },
  last_message_at: ts(d2),
  unread_counts: { u1: 0, u2: 0, u3: 4 },
  created_at: ts(d1),
  updated_at: ts(d3),
});

test('mapDocToChat maps a full group document', () => {
  const chat = mapDocToChat('chat1', fullGroupDoc());
  expect(chat).toEqual({
    id: 'chat1',
    type: 'group',
    userIds: ['u1', 'u2', 'u3'],
    participants: {
      u1: { fullName: 'One', avatarUrl: null },
      u2: { fullName: 'Two', avatarUrl: 'http://two' },
      u3: { fullName: 'Three', avatarUrl: null },
    },
    name: 'Study group',
    avatarUrl: 'http://group',
    createdBy: 'u1',
    adminIds: ['u1'],
    lastMessage: {
      messageId: 'm1',
      authorId: 'u2',
      message: 'hello',
      createdAt: d2,
      isDeleted: true,
    },
    lastMessageAt: d2,
    unreadCounts: { u1: 0, u2: 0, u3: 4 },
    createdAt: d1,
    updatedAt: d3,
  });
  expect(chat.lastMessage.createdAt).toBeInstanceOf(Date);
  expect(chat.createdAt).toBeInstanceOf(Date);
});

test('mapDocToChat applies defaults for a minimal direct chat', () => {
  const chat = mapDocToChat('a_b', {
    type: 'direct',
    user_ids: ['a', 'b'],
    last_message_at: ts(d1),
    created_at: ts(d1),
    updated_at: ts(d1),
  });
  expect(chat.id).toBe('a_b');
  expect(chat.type).toBe('direct');
  expect(chat.userIds).toEqual(['a', 'b']);
  expect(chat.name).toBeNull();
  expect(chat.avatarUrl).toBeNull();
  expect(chat.createdBy).toBeNull();
  expect(chat.adminIds).toEqual([]);
  expect(chat.lastMessage).toBeNull();
  expect(chat.unreadCounts).toEqual({});
  expect(chat.participants).toEqual({});
  expect(chat.lastMessageAt).toBe(d1);
});

test('mapDocToChat defaults userIds to [] when missing', () => {
  const chat = mapDocToChat('x', { type: 'group' });
  expect(chat.userIds).toEqual([]);
  expect(chat.participants).toEqual({});
  expect(chat.lastMessage).toBeNull();
});

// ---- mapDocToChatMessage ----

test('mapDocToChatMessage maps a text message', () => {
  const msg = mapDocToChatMessage('m1', 'chatA', {
    chat_id: 'ignored',
    type: 'text',
    author_id: 'u1',
    author_snapshot: { full_name: 'One', avatar_url: 'http://one' },
    message: 'hi there',
    system_event: null,
    is_deleted: false,
    created_at: ts(d1),
    updated_at: ts(d2),
  });
  expect(msg).toEqual({
    id: 'm1',
    chatId: 'chatA',
    type: 'text',
    authorId: 'u1',
    authorSnapshot: { fullName: 'One', avatarUrl: 'http://one' },
    message: 'hi there',
    systemEvent: null,
    isDeleted: false,
    createdAt: d1,
    updatedAt: d2,
  });
});

test('mapDocToChatMessage maps a system message', () => {
  const msg = mapDocToChatMessage('s1', 'chatB', {
    type: 'system',
    author_id: null,
    author_snapshot: null,
    message: null,
    system_event: { kind: 'member_added', actor_id: 'u1', target_ids: ['u2', 'u3'] },
    is_deleted: false,
    created_at: ts(d1),
    updated_at: ts(d1),
  });
  expect(msg.type).toBe('system');
  expect(msg.chatId).toBe('chatB');
  expect(msg.authorId).toBeNull();
  expect(msg.authorSnapshot).toBeNull();
  expect(msg.message).toBeNull();
  expect(msg.systemEvent).toEqual({
    kind: 'member_added',
    actorId: 'u1',
    targetIds: ['u2', 'u3'],
  });
});

test('mapDocToChatMessage defaults isDeleted to false and keeps true', () => {
  const base = {
    type: 'text',
    author_id: 'u1',
    author_snapshot: { full_name: 'One', avatar_url: null },
    message: '',
    created_at: ts(d1),
    updated_at: ts(d1),
  };
  expect(mapDocToChatMessage('m', 'c', base).isDeleted).toBe(false);
  expect(mapDocToChatMessage('m', 'c', { ...base, is_deleted: true }).isDeleted).toBe(true);
});

// ---- truncatePreview ----

test('truncatePreview uses the 200-char constant', () => {
  expect(LAST_MESSAGE_PREVIEW_LENGTH).toBe(200);
});

test('truncatePreview boundaries', () => {
  const n = LAST_MESSAGE_PREVIEW_LENGTH;
  expect(truncatePreview('a'.repeat(n))).toBe('a'.repeat(n));
  expect(truncatePreview('a'.repeat(n + 1))).toBe('a'.repeat(n));
  expect(truncatePreview('a'.repeat(n + 1)).length).toBe(n);
  expect(truncatePreview('short')).toBe('short');
  expect(truncatePreview('')).toBe('');
});

test('truncatePreview keeps the first characters', () => {
  const text = 'x'.repeat(150) + 'y'.repeat(100);
  expect(truncatePreview(text)).toBe(text.slice(0, 200));
});

// ---- barrel encapsulation ----

test('services barrel does not expose the helpers', () => {
  for (const name of [
    'toDate',
    'toFirestoreParticipant',
    'mapParticipant',
    'mapDocToChat',
    'mapDocToChatMessage',
    'truncatePreview',
  ]) {
    expect(name in services).toBe(false);
  }
});
