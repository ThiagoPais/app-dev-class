import { beforeEach, describe, expect, test } from 'bun:test';
import { collection, doc, getDoc, getDocs, Timestamp } from 'firebase/firestore';

import { clearDatabase, db, loadChatService } from '../chat/emulator-env.js';

beforeEach(clearDatabase);

const user = (userId, fullName = userId.toUpperCase(), avatarUrl = null) => ({
  userId,
  profile: { fullName, avatarUrl },
});

async function getOrCreate(dto) {
  const service = await loadChatService();
  return service.getOrCreateDirectChat(dto);
}

async function rawChat(id) {
  const snap = await getDoc(doc(db, 'chats', id));
  return snap.exists() ? snap.data() : null;
}

async function chatCount() {
  return (await getDocs(collection(db, 'chats'))).size;
}

describe('getOrCreateDirectChat', () => {
  // Spec §2 Direct chat ID, §3.2 Direct row, plan §4 stored fields
  test('creates chats/{sortedA_sortedB} with the exact stored fields', async () => {
    await getOrCreate({
      currentUser: user('bob', 'Bob B', 'http://x/bob.png'),
      otherUser: user('alice', 'Alice A', null),
    });
    const data = await rawChat('alice_bob');
    expect(data).not.toBeNull();
    expect(data.type).toBe('direct');
    expect(data.user_ids).toEqual(['alice', 'bob']);
    expect(data.participants).toEqual({
      alice: { full_name: 'Alice A', avatar_url: null },
      bob: { full_name: 'Bob B', avatar_url: 'http://x/bob.png' },
    });
    expect(data.name).toBeNull();
    expect(data.avatar_url).toBeNull();
    expect(data.created_by).toBeNull();
    expect(data.admin_ids).toEqual([]);
    expect(data.last_message).toBeNull();
    expect(data.unread_counts).toEqual({ alice: 0, bob: 0 });
    expect(data.last_message_at).toBeInstanceOf(Timestamp);
    expect(data.created_at).toBeInstanceOf(Timestamp);
    expect(data.updated_at).toBeInstanceOf(Timestamp);
    // real server timestamps, not epoch/placeholder
    expect(Math.abs(data.created_at.toMillis() - Date.now())).toBeLessThan(60_000);
  });

  // Spec §3.1 Chat shape
  test('returns an app-level camelCase Chat with Date instances', async () => {
    const chat = await getOrCreate({
      currentUser: user('bob', 'Bob B', 'http://x/bob.png'),
      otherUser: user('alice', 'Alice A', null),
    });
    expect(chat.id).toBe('alice_bob');
    expect(chat.type).toBe('direct');
    expect(chat.userIds).toEqual(['alice', 'bob']);
    expect(chat.participants).toEqual({
      alice: { fullName: 'Alice A', avatarUrl: null },
      bob: { fullName: 'Bob B', avatarUrl: 'http://x/bob.png' },
    });
    expect(chat.name).toBeNull();
    expect(chat.avatarUrl).toBeNull();
    expect(chat.createdBy).toBeNull();
    expect(chat.adminIds).toEqual([]);
    expect(chat.lastMessage).toBeNull();
    expect(chat.unreadCounts).toEqual({ alice: 0, bob: 0 });
    expect(chat.lastMessageAt).toBeInstanceOf(Date);
    expect(chat.createdAt).toBeInstanceOf(Date);
    expect(chat.updatedAt).toBeInstanceOf(Date);
  });

  // Spec §5 Direct AC2: either order -> same id, one doc
  test('(a,b) and (b,a) yield the same id and a single document', async () => {
    const first = await getOrCreate({ currentUser: user('a'), otherUser: user('b') });
    const second = await getOrCreate({ currentUser: user('b'), otherUser: user('a') });
    expect(first.id).toBe('a_b');
    expect(second.id).toBe('a_b');
    expect(await chatCount()).toBe(1);
  });

  // Spec §5 Direct AC2: concurrent calls
  test('concurrent calls in mixed order create exactly one document', async () => {
    const results = await Promise.all([
      getOrCreate({ currentUser: user('a'), otherUser: user('b') }),
      getOrCreate({ currentUser: user('b'), otherUser: user('a') }),
      getOrCreate({ currentUser: user('a'), otherUser: user('b') }),
      getOrCreate({ currentUser: user('b'), otherUser: user('a') }),
      getOrCreate({ currentUser: user('a'), otherUser: user('b') }),
      getOrCreate({ currentUser: user('b'), otherUser: user('a') }),
    ]);
    expect(new Set(results.map((c) => c.id)).size).toBe(1);
    expect(results[0].id).toBe('a_b');
    expect(await chatCount()).toBe(1);
    expect((await rawChat('a_b')).user_ids).toEqual(['a', 'b']);
  });

  // Plan §4: existing doc returned as-is
  test('existing chat is returned as-is and not overwritten', async () => {
    await getOrCreate({ currentUser: user('a', 'Old A', 'old'), otherUser: user('b', 'Old B') });
    const before = await rawChat('a_b');

    const again = await getOrCreate({
      currentUser: user('a', 'New A', 'new'),
      otherUser: user('b', 'New B', 'newb'),
    });
    const after = await rawChat('a_b');

    expect(after.participants).toEqual(before.participants);
    expect(after.participants.a.full_name).toBe('Old A');
    expect(after.created_at.isEqual(before.created_at)).toBe(true);
    expect(again.id).toBe('a_b');
    expect(again.participants.a.fullName).toBe('Old A');
    expect(again.createdAt).toBeInstanceOf(Date);
    expect(again.createdAt.getTime()).toBe(before.created_at.toMillis());
  });

  // Spec §2: plain code-unit ordering
  test("sorts mixed-case ids by code unit ('Zed_alice')", async () => {
    const chat = await getOrCreate({ currentUser: user('alice'), otherUser: user('Zed') });
    expect(chat.id).toBe('Zed_alice');
    expect(chat.userIds).toEqual(['Zed', 'alice']);
    expect(await rawChat('Zed_alice')).not.toBeNull();
  });

  // Spec §5 Direct (self chat not allowed), error code
  test('same user on both sides rejects with CHAT_SELF_NOT_ALLOWED and writes nothing', async () => {
    let error;
    try {
      await getOrCreate({ currentUser: user('a'), otherUser: user('a') });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('CHAT_SELF_NOT_ALLOWED');
    expect(await chatCount()).toBe(0);
  });

  // Distinct pairs do not collide
  test('different pairs produce different documents', async () => {
    const ab = await getOrCreate({ currentUser: user('a'), otherUser: user('b') });
    const ac = await getOrCreate({ currentUser: user('a'), otherUser: user('c') });
    expect(ab.id).toBe('a_b');
    expect(ac.id).toBe('a_c');
    expect(await chatCount()).toBe(2);
  });
});
