import { beforeEach, describe, expect, test } from 'bun:test';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';

import { clearDatabase, db, loadChatService } from '../chat/emulator-env.js';

beforeEach(clearDatabase);

const profile = (n) => ({ fullName: `User ${n}`, avatarUrl: n % 2 ? `http://x/${n}.png` : null });
const member = (id, n = 1) => ({ userId: id, profile: profile(n) });
const CREATOR = member('creator', 0);

function dto(overrides = {}) {
  return {
    creator: CREATOR,
    members: [member('bob', 1), member('carol', 2)],
    name: 'Study group',
    ...overrides,
  };
}

async function service() {
  const s = await loadChatService();
  expect(typeof s.createGroupChat).toBe('function');
  return s;
}

async function create(input) {
  const s = await service();
  return s.createGroupChat(input);
}

async function allChats() {
  const snap = await getDocs(collection(db, 'chats'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function messages(chatId) {
  const snap = await getDocs(collection(db, 'chats', chatId, 'chat_messages'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function raw(chatId) {
  const snap = await getDoc(doc(db, 'chats', chatId));
  return snap.exists() ? snap.data() : null;
}

async function expectRejected(code, input) {
  await service();
  let error;
  try {
    await create(input);
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(Error);
  expect(error.code).toBe(code);
  expect(await allChats()).toHaveLength(0);
}

function others(count, prefix = 'u') {
  return Array.from({ length: count }, (_, i) => member(`${prefix}${i}`, i));
}

describe('createGroupChat stored documents (AC#4)', () => {
  test('stores group chat doc with creator first, sole admin, created_by, trimmed name', async () => {
    const chat = await create(dto({ name: '  Study group  ', avatarUrl: 'http://x/g.png' }));
    const stored = await raw(chat.id);
    expect(stored).not.toBeNull();
    expect(stored.type).toBe('group');
    expect(stored.user_ids).toEqual(['creator', 'bob', 'carol']);
    expect(stored.name).toBe('Study group');
    expect(stored.avatar_url).toBe('http://x/g.png');
    expect(stored.created_by).toBe('creator');
    expect(stored.admin_ids).toEqual(['creator']);
    expect(stored.last_message).toBeNull();
    expect(stored.participants).toEqual({
      creator: { full_name: 'User 0', avatar_url: null },
      bob: { full_name: 'User 1', avatar_url: 'http://x/1.png' },
      carol: { full_name: 'User 2', avatar_url: null },
    });
    expect(stored.unread_counts).toEqual({ creator: 0, bob: 0, carol: 0 });
  });

  test('avatar_url is null when omitted or undefined', async () => {
    const a = await create(dto());
    const b = await create(dto({ avatarUrl: undefined }));
    expect((await raw(a.id)).avatar_url).toBeNull();
    expect((await raw(b.id)).avatar_url).toBeNull();
  });

  test('timestamps are real server timestamps and all equal in the same commit', async () => {
    const before = Date.now();
    const chat = await create(dto());
    const stored = await raw(chat.id);
    for (const key of ['created_at', 'updated_at', 'last_message_at']) {
      expect(typeof stored[key].toDate).toBe('function');
      expect(Math.abs(stored[key].toMillis() - before)).toBeLessThan(60_000);
    }
    expect(stored.last_message_at.isEqual(stored.created_at)).toBe(true);
    expect(stored.updated_at.isEqual(stored.created_at)).toBe(true);
  });

  test('writes exactly one group_created system message', async () => {
    const chat = await create(dto());
    const msgs = await messages(chat.id);
    expect(msgs).toHaveLength(1);
    const m = msgs[0];
    expect(m.type).toBe('system');
    expect(m.chat_id).toBe(chat.id);
    expect(m.author_id).toBeNull();
    expect(m.author_snapshot).toBeNull();
    expect(m.message).toBeNull();
    expect(m.system_event).toEqual({ kind: 'group_created', actor_id: 'creator', target_ids: [] });
    expect(m.is_deleted).toBe(false);
    expect(typeof m.created_at.toDate).toBe('function');
    expect(typeof m.updated_at.toDate).toBe('function');
    expect(Math.abs(m.created_at.toMillis() - Date.now())).toBeLessThan(60_000);
  });

  test('system message does not change preview, counters, or last_message_at (AC#11)', async () => {
    const chat = await create(dto());
    const stored = await raw(chat.id);
    expect(stored.last_message).toBeNull();
    expect(Object.values(stored.unread_counts).every((n) => n === 0)).toBe(true);
    expect(Object.keys(stored.unread_counts).sort()).toEqual(['bob', 'carol', 'creator']);
    expect(stored.last_message_at.isEqual(stored.created_at)).toBe(true);
  });

  test('creates only the group chat doc (no other chats)', async () => {
    const chat = await create(dto());
    const chats = await allChats();
    expect(chats.map((c) => c.id)).toEqual([chat.id]);
  });
});

describe('createGroupChat returned Chat', () => {
  test('returns camelCase Chat matching the stored doc', async () => {
    const chat = await create(dto({ name: ' Study group ', avatarUrl: 'http://x/g.png' }));
    const stored = await raw(chat.id);
    expect(typeof chat.id).toBe('string');
    expect(chat.id.length).toBeGreaterThan(0);
    expect(chat.type).toBe('group');
    expect(chat.userIds).toEqual(['creator', 'bob', 'carol']);
    expect(chat.adminIds).toEqual(['creator']);
    expect(chat.createdBy).toBe('creator');
    expect(chat.name).toBe('Study group');
    expect(chat.avatarUrl).toBe('http://x/g.png');
    expect(chat.participants).toEqual({
      creator: { fullName: 'User 0', avatarUrl: null },
      bob: { fullName: 'User 1', avatarUrl: 'http://x/1.png' },
      carol: { fullName: 'User 2', avatarUrl: null },
    });
    expect(chat.unreadCounts).toEqual({ creator: 0, bob: 0, carol: 0 });
    expect(chat.lastMessage).toBeNull();
    expect(chat.lastMessageAt).toBeInstanceOf(Date);
    expect(chat.createdAt).toBeInstanceOf(Date);
    expect(chat.updatedAt).toBeInstanceOf(Date);
    expect(chat.createdAt.getTime()).toBe(stored.created_at.toMillis());
    expect(chat.updatedAt.getTime()).toBe(stored.updated_at.toMillis());
    expect(chat.lastMessageAt.getTime()).toBe(stored.last_message_at.toMillis());
  });

  test('returned avatarUrl is null when omitted', async () => {
    const chat = await create(dto());
    expect(chat.avatarUrl).toBeNull();
  });

  test('two identical calls produce different ids and two docs', async () => {
    const a = await create(dto());
    const b = await create(dto());
    expect(a.id).not.toBe(b.id);
    expect(await allChats()).toHaveLength(2);
  });
});

describe('createGroupChat name validation', () => {
  for (const [label, name] of [
    ['empty', ''],
    ['whitespace-only', '   \t\n '],
    ['61 chars', 'a'.repeat(61)],
    ['61 chars plus whitespace', `  ${'a'.repeat(61)}  `],
  ]) {
    test(`${label} name rejects with CHAT_GROUP_NAME_INVALID and writes nothing`, async () => {
      await expectRejected('CHAT_GROUP_NAME_INVALID', dto({ name }));
    });
  }

  test('exactly 60 chars is accepted', async () => {
    const name = 'a'.repeat(60);
    const chat = await create(dto({ name }));
    expect((await raw(chat.id)).name).toBe(name);
  });

  test('60 chars with surrounding whitespace is accepted and stored trimmed', async () => {
    const name = 'b'.repeat(60);
    const chat = await create(dto({ name: `  ${name}\n ` }));
    expect((await raw(chat.id)).name).toBe(name);
    expect(chat.name).toBe(name);
  });
});

describe('createGroupChat member rules', () => {
  test('no other members rejects with CHAT_GROUP_TOO_SMALL', async () => {
    await expectRejected('CHAT_GROUP_TOO_SMALL', dto({ members: [] }));
  });

  test('only the creator repeated rejects with CHAT_GROUP_TOO_SMALL', async () => {
    await expectRejected('CHAT_GROUP_TOO_SMALL', dto({ members: [member('creator', 0), member('creator', 0)] }));
  });

  test('exactly 2 total members is accepted', async () => {
    const chat = await create(dto({ members: [member('bob', 1)] }));
    const stored = await raw(chat.id);
    expect(stored.user_ids).toEqual(['creator', 'bob']);
    expect(stored.unread_counts).toEqual({ creator: 0, bob: 0 });
  });

  test('101 total members rejects with CHAT_GROUP_FULL', async () => {
    await expectRejected('CHAT_GROUP_FULL', dto({ members: others(100) }));
  });

  test('exactly 100 total members is accepted', async () => {
    const chat = await create(dto({ members: others(99) }));
    const stored = await raw(chat.id);
    expect(stored.user_ids).toHaveLength(100);
    expect(stored.user_ids[0]).toBe('creator');
    expect(Object.keys(stored.participants)).toHaveLength(100);
    expect(Object.keys(stored.unread_counts)).toHaveLength(100);
    expect(await messages(chat.id)).toHaveLength(1);
  });

  test('150 inputs deduplicating to 99 others are accepted', async () => {
    const input = [...others(99), ...others(51)];
    expect(input).toHaveLength(150);
    const chat = await create(dto({ members: input }));
    expect((await raw(chat.id)).user_ids).toHaveLength(100);
  });

  test('duplicates are dropped keeping first occurrence and order; creator entry dropped', async () => {
    const chat = await create(
      dto({
        members: [
          member('zed', 1),
          member('creator', 0),
          member('amy', 2),
          { userId: 'zed', profile: { fullName: 'Other Zed', avatarUrl: null } },
          member('amy', 4),
        ],
      }),
    );
    const stored = await raw(chat.id);
    expect(stored.user_ids).toEqual(['creator', 'zed', 'amy']);
    expect(stored.participants.zed).toEqual({ full_name: 'User 1', avatar_url: 'http://x/1.png' });
    expect(stored.participants.amy).toEqual({ full_name: 'User 2', avatar_url: null });
    expect(stored.participants.creator).toEqual({ full_name: 'User 0', avatar_url: null });
    expect(stored.unread_counts).toEqual({ creator: 0, zed: 0, amy: 0 });
    expect(chat.userIds).toEqual(['creator', 'zed', 'amy']);
  });

  test('user_ids keep join order (not sorted)', async () => {
    const chat = await create(dto({ members: [member('zoe', 1), member('adam', 2), member('mia', 3)] }));
    expect((await raw(chat.id)).user_ids).toEqual(['creator', 'zoe', 'adam', 'mia']);
  });
});
