import { expect, test } from 'bun:test';

import {
  assertAdmin,
  assertGroup,
  assertMember,
} from '../src/domains/chat/services/chat.helpers.ts';

const makeChat = (overrides = {}) => ({
  id: 'chat1',
  type: 'group',
  userIds: ['alice', 'bob', 'carol'],
  adminIds: ['alice'],
  ...overrides,
});

const direct = (overrides = {}) =>
  makeChat({ id: 'alice_bob', type: 'direct', userIds: ['alice', 'bob'], adminIds: [], ...overrides });

const codeOf = (fn) => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    return error.code;
  }
  throw new Error('expected function to throw');
};

// ---- assertMember (spec 3.2; Groups AC#5/#9 membership; Messages AC#17 non-member cannot send) ----

test('assertMember returns undefined for a member of a group', () => {
  expect(assertMember(makeChat(), 'bob')).toBeUndefined();
});

test('assertMember returns undefined for a member of a direct chat', () => {
  expect(assertMember(direct(), 'alice')).toBeUndefined();
});

test('assertMember throws CHAT_NOT_PARTICIPANT for a non-member of a group', () => {
  expect(codeOf(() => assertMember(makeChat(), 'zed'))).toBe('CHAT_NOT_PARTICIPANT');
});

test('assertMember throws CHAT_NOT_PARTICIPANT for a non-member of a direct chat', () => {
  expect(codeOf(() => assertMember(direct(), 'carol'))).toBe('CHAT_NOT_PARTICIPANT');
});

test('assertMember: empty group means everyone is a non-member', () => {
  const chat = makeChat({ userIds: [], adminIds: [] });
  expect(codeOf(() => assertMember(chat, 'alice'))).toBe('CHAT_NOT_PARTICIPANT');
});

test('assertMember id lookup is case-sensitive', () => {
  expect(codeOf(() => assertMember(makeChat(), 'Alice'))).toBe('CHAT_NOT_PARTICIPANT');
});

test('assertMember id lookup is exact, not substring', () => {
  const chat = makeChat({ userIds: ['alice'], adminIds: [] });
  expect(codeOf(() => assertMember(chat, 'ali'))).toBe('CHAT_NOT_PARTICIPANT');
  expect(codeOf(() => assertMember(chat, 'alice2'))).toBe('CHAT_NOT_PARTICIPANT');
});

// ---- assertAdmin (Groups AC#5: non-admins get CHAT_NOT_ADMIN) ----

test('assertAdmin returns undefined for an admin', () => {
  expect(assertAdmin(makeChat(), 'alice')).toBeUndefined();
});

test('assertAdmin throws CHAT_NOT_ADMIN for a member who is not admin', () => {
  expect(codeOf(() => assertAdmin(makeChat(), 'bob'))).toBe('CHAT_NOT_ADMIN');
});

test('assertAdmin throws CHAT_NOT_ADMIN (not NOT_PARTICIPANT) for a non-member', () => {
  expect(codeOf(() => assertAdmin(makeChat(), 'zed'))).toBe('CHAT_NOT_ADMIN');
});

test('assertAdmin always throws CHAT_NOT_ADMIN on a direct chat', () => {
  const chat = direct();
  for (const id of ['alice', 'bob', 'zed']) {
    expect(codeOf(() => assertAdmin(chat, id))).toBe('CHAT_NOT_ADMIN');
  }
});

test('assertAdmin id lookup is case-sensitive and exact', () => {
  const chat = makeChat({ userIds: ['alice'], adminIds: ['alice'] });
  expect(codeOf(() => assertAdmin(chat, 'Alice'))).toBe('CHAT_NOT_ADMIN');
  expect(codeOf(() => assertAdmin(chat, 'ali'))).toBe('CHAT_NOT_ADMIN');
});

test('assertAdmin: empty group has no admins', () => {
  const chat = makeChat({ userIds: [], adminIds: [] });
  expect(codeOf(() => assertAdmin(chat, 'alice'))).toBe('CHAT_NOT_ADMIN');
});

// ---- assertGroup (Groups AC#9: group operations on a direct chat -> CHAT_NOT_GROUP) ----

test('assertGroup returns undefined for a group chat', () => {
  expect(assertGroup(makeChat())).toBeUndefined();
});

test('assertGroup returns undefined for an empty group', () => {
  expect(assertGroup(makeChat({ userIds: [], adminIds: [] }))).toBeUndefined();
});

test('assertGroup throws CHAT_NOT_GROUP for a direct chat', () => {
  expect(codeOf(() => assertGroup(direct()))).toBe('CHAT_NOT_GROUP');
});

// ---- purity ----

test('guards do not mutate the chat', () => {
  const chat = makeChat();
  const snapshot = structuredClone(chat);
  assertMember(chat, 'alice');
  assertAdmin(chat, 'alice');
  assertGroup(chat);
  try { assertMember(chat, 'zed'); } catch {}
  try { assertAdmin(chat, 'bob'); } catch {}
  const d = direct();
  const dSnapshot = structuredClone(d);
  try { assertGroup(d); } catch {}
  expect(chat).toEqual(snapshot);
  expect(d).toEqual(dSnapshot);
});
