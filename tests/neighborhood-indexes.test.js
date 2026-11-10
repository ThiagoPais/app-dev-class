import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const config = JSON.parse(
  readFileSync(new URL('../firestore.indexes.json', import.meta.url), 'utf8'),
);

const asc = (fieldPath) => ({ fieldPath, order: 'ASCENDING' });
const desc = (fieldPath) => ({ fieldPath, order: 'DESCENDING' });

const neighborhoodsIndexes = config.indexes.filter((i) => i.collectionGroup === 'neighborhoods');

test('AC2/AC4: exactly one neighborhoods composite index exists', () => {
  expect(neighborhoodsIndexes.length).toBe(1);
});

test('AC2/AC4: neighborhoods index has COLLECTION scope', () => {
  expect(neighborhoodsIndexes[0]?.queryScope).toBe('COLLECTION');
});

test('AC2/AC4: neighborhoods fields are state, city_normalized, neighborhood_normalized all ASCENDING in order', () => {
  expect(neighborhoodsIndexes[0]?.fields).toEqual([
    asc('state'),
    asc('city_normalized'),
    asc('neighborhood_normalized'),
  ]);
});

const preExisting = [
  ['messages', [asc('is_deleted'), asc('created_at')]],
  ['users', [asc('email'), desc('createdAt')]],
  ['users', [asc('cpf'), desc('createdAt')]],
  ['users', [asc('isActive'), desc('createdAt')]],
  ['forum_topics', [asc('city_normalized'), asc('is_deleted'), desc('is_pinned'), desc('last_reply_at')]],
  ['forum_topics', [asc('city_normalized'), asc('is_deleted'), desc('net_votes')]],
  ['forum_topics', [asc('region'), asc('is_deleted'), desc('last_reply_at')]],
  ['forum_topics', [asc('author_id'), desc('created_at')]],
  [
    'chats',
    [
      { fieldPath: 'user_ids', arrayConfig: 'CONTAINS' },
      desc('last_message_at'),
    ],
  ],
];

for (const [group, fields] of preExisting) {
  const label = fields.map((f) => f.fieldPath).join(',');
  test(`AC2/AC4 additive: existing ${group} index preserved (${label})`, () => {
    const matches = config.indexes.filter(
      (i) => i.collectionGroup === group && JSON.stringify(i.fields) === JSON.stringify(fields),
    );
    expect(matches.length).toBe(1);
  });
}
