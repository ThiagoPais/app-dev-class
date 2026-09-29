import { afterAll, beforeAll, expect, mock, test } from 'bun:test';
import { createRequire } from 'node:module';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore, terminate } from 'firebase/firestore';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.GCLOUD_PROJECT?.startsWith('demo-')) {
  throw new Error('Run with the Firestore emulator and a demo- project. See functions/README.md.');
}
const backendRequire = createRequire(new URL('../functions/package.json', import.meta.url));
const admin = backendRequire('firebase-admin/app');
const { getFirestore: adminFirestore, Timestamp } = backendRequire('firebase-admin/firestore');
const projectId = process.env.GCLOUD_PROJECT;
const databaseId = process.env.FIRESTORE_DATABASE_ID || 'app-db';
const adminApp = admin.initializeApp({ projectId }, 'pagination-seeds');
const seeds = adminFirestore(adminApp, databaseId);
const app = initializeApp({ projectId }, 'pagination-client');
const db = getFirestore(app, databaseId);
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
connectFirestoreEmulator(db, host, Number(port), { mockUserToken: { sub: 'alice', user_id: 'alice' } });
mock.module('../src/services/firebase.ts', () => ({ app, db, auth: { currentUser: { uid: 'alice' } } }));
const { getTopicFeedPage, listCityTopics, listRegionTopics, listTopicMessages } =
  await import('../src/domains/forum/services/forum.service.ts');

const region = 'pagination-tests';
const city = 'Cidade Paginação';
const cityNormalized = 'cidade paginacao';
const topicIds = [];
const replyIds = [];
const replyTopic = 'pagination-replies';
const topicData = (i) => ({
  author_id: 'alice', author_snapshot: { full_name: 'Alice', avatar_url: null },
  title: i >= 60 && i < 70 ? `Café antigo ${i}` : `Conversa ${i}`, content: i === 68 ? 'Uma agulha no conteúdo antigo' : 'Conteúdo',
  region, city, city_normalized: cityNormalized,
  upvotes_count: 0, downvotes_count: 0, net_votes: 0, replies_count: 0,
  is_pinned: false, is_locked: false, is_deleted: false,
  last_reply_at: Timestamp.fromMillis(100000 - Math.floor(i / 2) * 100),
  created_at: Timestamp.fromMillis(100000), updated_at: Timestamp.fromMillis(100000),
});

beforeAll(async () => {
  const batch = seeds.batch();
  for (let i = 0; i < 85; i++) {
    const id = `pagination-${String(i).padStart(3, '0')}`;
    topicIds.push(id);
    batch.set(seeds.doc(`forum_topics/${id}`), {
      ...topicData(i), ...(i >= 70 ? { city: 'Outra cidade', city_normalized: 'outra cidade' } : {}),
    });
  }
  for (let i = 0; i < 5; i++) {
    const id = `pagination-deleted-${i}`;
    topicIds.push(id);
    batch.set(seeds.doc(`forum_topics/${id}`), { ...topicData(0), is_deleted: true });
  }
  topicIds.push(replyTopic);
  batch.set(seeds.doc(`forum_topics/${replyTopic}`), { ...topicData(0), region: 'reply-tests', city_normalized: 'reply-tests', replies_count: 71 });
  for (let i = 0; i < 126; i++) {
    const id = `reply-${String(i).padStart(3, '0')}`;
    if (i >= 55) replyIds.push(id);
    batch.set(seeds.doc(`forum_topics/${replyTopic}/messages/${id}`), {
      topic_id: replyTopic, author_id: 'alice', content: `Reply ${i}`,
      author_snapshot: { full_name: 'Alice', avatar_url: null },
      is_deleted: i < 55, upvotes_count: 0, downvotes_count: 0, net_votes: 0,
      created_at: Timestamp.fromMillis(Math.floor(i / 2) * 100), updated_at: Timestamp.fromMillis(100000),
    });
  }
  await batch.commit();
}, 30000);

afterAll(async () => {
  await Promise.all(topicIds.map((id) => seeds.recursiveDelete(seeds.doc(`forum_topics/${id}`))));
  await terminate(db);
  await deleteApp(app);
  await seeds.terminate();
  await admin.deleteApp(adminApp);
}, 30000);

async function collect(load) {
  const ids = [];
  let cursor = null;
  let pages = 0;
  while (true) {
    const page = await load(cursor);
    ids.push(...page.items.map((item) => item.id));
    pages++;
    if (!page.hasMore) break;
    expect(page.cursor).not.toBeNull();
    cursor = page.cursor;
    if (pages > 20) throw new Error('Pagination did not terminate');
  }
  expect(new Set(ids).size).toBe(ids.length);
  return ids;
}

test('city pagination reaches all 70 topics with tied timestamps and excludes deletions', async () => {
  const ids = await collect((cursor) => listCityTopics(cityNormalized, 'recent', 20, cursor));
  expect(ids.toSorted()).toEqual(topicIds.slice(0, 70).toSorted());
}, 30000);

test('region pagination reaches all 85 topics beyond the original 30-topic cap', async () => {
  const ids = await collect((cursor) => listRegionTopics(region, 30, cursor));
  expect(ids.toSorted()).toEqual(topicIds.slice(0, 85).toSorted());
}, 30000);

test('reply pages exclude 55 deleted replies and reach every live reply without duplicates', async () => {
  const first = await listTopicMessages(replyTopic);
  expect(first.items.length).toBe(50);
  expect(first.items[0].id).toBe('reply-055');
  expect(first.hasMore).toBe(true);
  const ids = await collect((cursor) => listTopicMessages(replyTopic, 50, cursor));
  expect(ids).toEqual(replyIds);
}, 30000);

test('search finds accented titles beyond both original feed limits', async () => {
  for (const filter of [null, city]) {
    const ids = await collect((cursor) => getTopicFeedPage(region, filter, 'cafe', cursor));
    expect(ids.toSorted()).toEqual(topicIds.slice(60, 70).toSorted());
  }
}, 30000);

test('search reports no results only after checking the entire feed', async () => {
  const result = await getTopicFeedPage(region, null, 'missing phrase');
  expect(result.items).toEqual([]);
  expect(result.hasMore).toBe(false);
}, 30000);

test('canceled search stops before reading another page', async () => {
  let checks = 0;
  const result = await getTopicFeedPage(region, null, 'missing phrase', null, () => ++checks <= 1);
  expect(checks).toBe(2);
  expect(result.items).toEqual([]);
  expect(result.cursor).not.toBeNull();
}, 30000);


test('search includes content and city matches in older pages', async () => {
  const content = await getTopicFeedPage(region, city, 'agulha');
  expect(content.items.map((item) => item.id)).toEqual(['pagination-068']);
  const cities = await getTopicFeedPage(region, null, 'outra cidade');
  expect(cities.items.map((item) => item.id).toSorted()).toEqual(topicIds.slice(70, 85).toSorted());
}, 30000);
