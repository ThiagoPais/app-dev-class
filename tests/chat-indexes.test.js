import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const config = JSON.parse(
  readFileSync(new URL('../firestore.indexes.json', import.meta.url), 'utf8'),
);

const asc = (fieldPath) => ({ fieldPath, order: 'ASCENDING' });
const desc = (fieldPath) => ({ fieldPath, order: 'DESCENDING' });
const idx = (collectionGroup, fields) => ({
  collectionGroup,
  queryScope: 'COLLECTION',
  fields,
});

const existing = [
  ['messages ASC is_deleted + created_at', idx('messages', [asc('is_deleted'), asc('created_at')])],
  ['users email + createdAt DESC', idx('users', [asc('email'), desc('createdAt')])],
  ['users cpf + createdAt DESC', idx('users', [asc('cpf'), desc('createdAt')])],
  ['users isActive + createdAt DESC', idx('users', [asc('isActive'), desc('createdAt')])],
  [
    'forum_topics city/is_deleted/is_pinned/last_reply_at',
    idx('forum_topics', [asc('city_normalized'), asc('is_deleted'), desc('is_pinned'), desc('last_reply_at')]),
  ],
  [
    'forum_topics city/is_deleted/net_votes',
    idx('forum_topics', [asc('city_normalized'), asc('is_deleted'), desc('net_votes')]),
  ],
  [
    'forum_topics region/is_deleted/last_reply_at',
    idx('forum_topics', [asc('region'), asc('is_deleted'), desc('last_reply_at')]),
  ],
  ['forum_topics author_id + created_at DESC', idx('forum_topics', [asc('author_id'), desc('created_at')])],
];

const chatsIndexes = config.indexes.filter((i) => i.collectionGroup === 'chats');

test('spec 4.1: exactly one chats index exists', () => {
  expect(chatsIndexes.length).toBe(1);
});

test('spec 4.1: chats index has COLLECTION scope', () => {
  expect(chatsIndexes[0]?.queryScope).toBe('COLLECTION');
});

test('spec 4.1: chats fields are user_ids CONTAINS then last_message_at DESC', () => {
  expect(chatsIndexes[0]?.fields).toEqual([
    { fieldPath: 'user_ids', arrayConfig: 'CONTAINS' },
    { fieldPath: 'last_message_at', order: 'DESCENDING' },
  ]);
});

test('spec 4.1: chats index has only collectionGroup/queryScope/fields keys', () => {
  expect(chatsIndexes.length).toBe(1);
  expect(Object.keys(chatsIndexes[0]).sort()).toEqual(['collectionGroup', 'fields', 'queryScope']);
});

for (const [name, expectedIndex] of existing) {
  test(`spec 4 additive: existing index preserved: ${name}`, () => {
    const matches = config.indexes.filter((i) => JSON.stringify(i) === JSON.stringify(expectedIndex));
    expect(matches.length).toBe(1);
  });
}

test('spec 4 additive: indexes has exactly 9 entries', () => {
  expect(config.indexes.length).toBe(9);
});

test('spec 4 additive: fieldOverrides is still empty', () => {
  expect(config.fieldOverrides).toEqual([]);
});

test('DDD 4.9: no index on chat_messages subcollection', () => {
  expect(config.indexes.filter((i) => i.collectionGroup === 'chat_messages')).toEqual([]);
});
