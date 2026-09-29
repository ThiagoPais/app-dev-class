import { afterEach, expect, mock, test } from 'bun:test';
import { act, createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Window } from 'happy-dom';

const window = new Window();
Object.assign(globalThis, {
  window,
  document: window.document,
  navigator: window.navigator,
  IS_REACT_ACT_ENVIRONMENT: true,
});

let inputProps;
const platform = { OS: 'web' };
mock.module('react-native', () => ({
  Platform: platform,
  StyleSheet: { create: (styles) => styles },
  View: ({ children }) => createElement('div', null, children),
  Text: ({ children }) => createElement('span', null, children),
  TextInput: (props) => {
    inputProps = props;
    return createElement('textarea', {
      value: props.value,
      readOnly: props.editable === false,
      onChange: (event) => props.onChangeText(event.target.value),
    });
  },
  Pressable: ({ children, onPress, disabled }) => createElement('button', { onClick: onPress, disabled }, children),
  ActivityIndicator: () => createElement('span', null, 'loading'),
}));
mock.module('@expo/vector-icons', () => ({ Ionicons: () => null }));
mock.module('react-native-svg', () => ({ default: () => null, Path: () => null }));
mock.module('expo-router', () => ({ useFocusEffect: (callback) => useEffect(callback, [callback]) }));
mock.module('../src/domains/auth/index.ts', () => ({ useAuth: () => ({ user: { id: 'alice' } }) }));

const feedPage = mock();
const messagePage = mock();
const baseTopic = { id: 'topic', isDeleted: false, repliesCount: 0, upvotesCount: 0, downvotesCount: 0, netVotes: 0 };
const getTopic = mock(async () => ({ ...baseTopic }));
const topicVote = mock(async () => null);
const messageVote = mock(async () => null);
const createMessage = mock();
const castTopicVote = mock();
const castMessageVote = mock();
mock.module('../src/domains/forum/services/forum.service.ts', () => ({
  getTopicFeedPage: feedPage,
  listTopicMessages: messagePage,
  getForumTopic: getTopic,
  getUserTopicVote: topicVote,
  getUserMessageVote: messageVote,
  castMessageVote,
  castTopicVote,
  createForumMessage: createMessage,
  softDeleteForumMessage: async () => {},
  softDeleteForumTopic: async () => {},
  updateForumMessage: async () => {},
}));

const { ReplyComposer } = await import('../src/domains/forum/components/reply-composer.tsx');
const { SocialAuthButton } = await import('../src/domains/auth/components/social-auth-button.tsx');
const { useTopicFeed } = await import('../src/domains/forum/hooks/use-topic-feed.ts');
const { useTopicDetail } = await import('../src/domains/forum/hooks/use-topic-detail.ts');

let root;
let container;
async function render(element) {
  if (!root) {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  }
  await act(async () => root.render(element));
}
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = null;
  feedPage.mockReset();
  messagePage.mockReset();
  getTopic.mockReset();
  getTopic.mockImplementation(async () => ({ ...baseTopic }));
  topicVote.mockReset();
  topicVote.mockResolvedValue(null);
  messageVote.mockReset();
  messageVote.mockResolvedValue(null);
  createMessage.mockReset();
  castTopicVote.mockReset();
  castMessageVote.mockReset();
  platform.OS = 'web';
});
const settle = async (ms = 10) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)));
const reply = (id) => ({ id, createdAt: new Date(0) });
const page = (items, cursor = null, hasMore = false) => ({ items, cursor, hasMore });

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
  return { promise, resolve, reject };
}

// Render the real component and retain its React state between target changes.
test('switching between equal replies resets the draft and submits to the new target', async () => {
  let target = 'a';
  const submitted = [];
  const props = {
    editingMessageId: target, editingContent: 'Same reply', bottomInset: 0,
    onCancelEdit: () => {}, onSubmit: async (content) => { submitted.push([target, content]); return true; },
  };
  await render(createElement(ReplyComposer, props));
  await act(async () => inputProps.onChangeText('Draft for A'));
  expect(container.querySelector('textarea').value).toBe('Draft for A');
  target = 'b';
  await render(createElement(ReplyComposer, { ...props, editingMessageId: target }));
  expect(container.querySelector('textarea').value).toBe('Same reply');
  await act(async () => container.querySelectorAll('button')[1].click());
  expect(submitted).toEqual([['b', 'Same reply']]);
});

test('canceling an edit clears its draft before composing a new reply', async () => {
  const props = { editingMessageId: 'a', editingContent: 'Original', bottomInset: 0, onCancelEdit: () => {}, onSubmit: async () => true };
  await render(createElement(ReplyComposer, props));
  await act(async () => inputProps.onChangeText('Draft'));
  await render(createElement(ReplyComposer, { ...props, editingMessageId: null, editingContent: null }));
  expect(container.querySelector('textarea').value).toBe('');
});

test('Google sign-in renders on web and stays hidden on iOS and Android', async () => {
  const button = createElement(SocialAuthButton, { provider: 'google' });
  await render(button);
  expect(container.querySelector('button')).not.toBeNull();
  for (const OS of ['ios', 'android']) {
    platform.OS = OS;
    await render(createElement(SocialAuthButton, { provider: 'google' }));
    expect(container.querySelector('button')).toBeNull();
  }
});

test('reply pagination ignores duplicate requests and a stale page after refresh', async () => {
  messagePage.mockResolvedValueOnce(page([reply('a')], 'cursor-a', true));
  let detail;
  function Screen() { detail = useTopicDetail('topic'); return null; }
  await render(createElement(Screen));
  expect(detail.messages.map((item) => item.id)).toEqual(['a']);
  let complete;
  messagePage.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
  let pending;
  await act(async () => { pending = detail.loadMore(); void detail.loadMore(); });
  expect(messagePage).toHaveBeenCalledTimes(2);
  expect(messagePage.mock.calls[1]).toEqual(['topic', 50, 'cursor-a']);
  messagePage.mockResolvedValueOnce(page([reply('fresh')]));
  await act(async () => detail.refresh());
  await act(async () => { complete(page([reply('stale')], 'old', true)); await pending; });
  expect(detail.messages.map((item) => item.id)).toEqual(['fresh']);
  expect(detail.hasMore).toBe(false);
});

test('feed pagination appends topics, deduplicates overlap, and retries a failed page', async () => {
  feedPage.mockResolvedValueOnce(page([{ id: 'a' }], 'cursor-a', true));
  let feed;
  function Screen() { feed = useTopicFeed(null); return null; }
  await render(createElement(Screen));
  await settle();
  feedPage.mockRejectedValueOnce(new Error('offline'));
  const warn = console.warn;
  console.warn = () => {};
  try { await act(async () => feed.loadMore()); } finally { console.warn = warn; }
  expect(feed.topics.map((item) => item.id)).toEqual(['a']);
  expect(feed.hasMore).toBe(true);
  expect(feed.errorMessage).not.toBeNull();
  feedPage.mockResolvedValueOnce(page([{ id: 'a' }, { id: 'b' }]));
  await act(async () => feed.loadMore());
  expect(feed.topics.map((item) => item.id)).toEqual(['a', 'b']);
  expect(feedPage.mock.calls[2][3]).toBe('cursor-a');
  expect(feed.errorMessage).toBeNull();
});

test('a new search invalidates a pending feed page and starts from the beginning', async () => {
  let complete;
  feedPage.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
  let feed;
  function Screen() { feed = useTopicFeed('Plano Piloto'); return null; }
  await render(createElement(Screen));
  await settle();
  const isActive = feedPage.mock.calls[0][4];
  feedPage.mockResolvedValueOnce(page([{ id: 'match' }]));
  await act(async () => feed.setSearch('needle'));
  expect(isActive()).toBe(false);
  await act(async () => complete(page([{ id: 'old-filter' }])));
  await settle(320);
  expect(feed.topics.map((item) => item.id)).toEqual(['match']);
  expect(feedPage.mock.calls[1].slice(0, 4)).toEqual(['DF', 'Plano Piloto', 'needle', null]);
});

test('retry after a failed refresh restarts the feed even when no later page exists', async () => {
  feedPage.mockResolvedValueOnce(page([{ id: 'a' }]));
  let feed;
  function Screen() { feed = useTopicFeed(null); return null; }
  await render(createElement(Screen));
  await settle();
  feedPage.mockRejectedValueOnce(new Error('offline'));
  const warn = console.warn;
  console.warn = () => {};
  try { await act(async () => feed.refresh()); } finally { console.warn = warn; }
  expect(feed.hasMore).toBe(false);
  feedPage.mockResolvedValueOnce(page([{ id: 'fresh' }]));
  await act(async () => feed.retry());
  expect(feedPage.mock.calls[2][3]).toBeNull();
  expect(feed.topics.map((item) => item.id)).toEqual(['fresh']);
});

for (const success of [true, false]) {
  test(`reply submission locks editing and cancellation, then ${success ? 'clears' : 'preserves'} the draft`, async () => {
    const submission = deferred();
    const cancel = mock();
    const submit = mock(() => submission.promise);
    await render(createElement(ReplyComposer, {
      editingMessageId: 'a', editingContent: 'Original', bottomInset: 0,
      onCancelEdit: cancel, onSubmit: submit,
    }));
    await act(async () => inputProps.onChangeText('Edited reply'));
    await act(async () => container.querySelectorAll('button')[1].click());
    expect(container.querySelector('textarea').readOnly).toBe(true);
    await act(async () => { for (const button of container.querySelectorAll('button')) button.click(); });
    expect(cancel).not.toHaveBeenCalled();
    expect(submit.mock.calls).toEqual([['Edited reply']]);
    await act(async () => submission.resolve(success));
    expect(container.querySelector('textarea').readOnly).toBe(false);
    expect(inputProps.value).toBe(success ? '' : 'Edited reply');
  });
}

test('refresh waits for a sent reply and uses the server count without duplicates', async () => {
  messagePage.mockResolvedValueOnce(page([]));
  let detail;
  function Screen() { detail = useTopicDetail('topic'); return null; }
  await render(createElement(Screen));
  const write = deferred();
  createMessage.mockReturnValueOnce(write.promise);
  let sending;
  let refreshing;
  await act(async () => { sending = detail.sendMessage('New reply'); });
  await act(async () => { refreshing = detail.refresh(); });
  expect(detail.isRefreshing).toBe(true);
  expect(getTopic).toHaveBeenCalledTimes(1);
  const message = reply('new');
  getTopic.mockResolvedValue({ ...baseTopic, repliesCount: 1 });
  messagePage.mockResolvedValueOnce(page([message]));
  await act(async () => { write.resolve(message); await sending; await refreshing; });
  expect(detail.messages.map((item) => item.id)).toEqual(['new']);
  expect(detail.topic.repliesCount).toBe(1);
  expect(detail.isRefreshing).toBe(false);
});

test('a reply sent during an in-flight refresh survives its stale snapshot', async () => {
  messagePage.mockResolvedValueOnce(page([]));
  let detail;
  function Screen() { detail = useTopicDetail('topic'); return null; }
  await render(createElement(Screen));
  const staleRead = deferred();
  messagePage.mockReturnValueOnce(staleRead.promise);
  let refreshing;
  await act(async () => { refreshing = detail.refresh(); });
  const message = reply('new');
  createMessage.mockResolvedValueOnce(message);
  await act(async () => detail.sendMessage('New reply'));
  getTopic.mockResolvedValue({ ...baseTopic, repliesCount: 1 });
  messagePage.mockResolvedValueOnce(page([message]));
  await act(async () => { staleRead.resolve(page([])); await refreshing; });
  expect(detail.messages.map((item) => item.id)).toEqual(['new']);
  expect(detail.topic.repliesCount).toBe(1);
});

for (const target of ['topic', 'message']) {
  for (const success of [true, false]) {
    test(`${target} vote ${success ? 'success' : 'failure'} stays consistent across a pending refresh`, async () => {
      const original = { ...reply('a'), upvotesCount: 0, downvotesCount: 0, netVotes: 0 };
      messagePage.mockResolvedValue(page([original]));
      let detail;
      function Screen() { detail = useTopicDetail('topic'); return null; }
      await render(createElement(Screen));
      const write = deferred();
      const cast = target === 'topic' ? castTopicVote : castMessageVote;
      cast.mockReturnValueOnce(write.promise);
      let voting;
      let refreshing;
      await act(async () => {
        voting = (target === 'topic' ? detail.voteTopic('up') : detail.voteMessage('a', 'up'))
          .catch((error) => error);
      });
      await act(async () => { refreshing = detail.refresh(); });
      expect(target === 'topic' ? detail.topicVote : detail.messageVotes.a).toBe('up');
      expect(getTopic).toHaveBeenCalledTimes(1);
      if (success) {
        if (target === 'topic') {
          getTopic.mockResolvedValue({ ...baseTopic, upvotesCount: 1, netVotes: 1 });
          topicVote.mockResolvedValue('up');
        } else {
          messagePage.mockResolvedValue(page([{ ...original, upvotesCount: 1, netVotes: 1 }]));
          messageVote.mockResolvedValue('up');
        }
      }
      await act(async () => {
        if (success) write.resolve();
        else write.reject(new Error('offline'));
        await voting;
        await refreshing;
      });
      expect(target === 'topic' ? detail.topicVote : detail.messageVotes.a).toBe(success ? 'up' : null);
      expect(target === 'topic' ? detail.topic.netVotes : detail.messages[0].netVotes).toBe(success ? 1 : 0);
      expect(detail.isRefreshing).toBe(false);
    });
  }
}

test('a vote started during refresh invalidates the stale topic and vote reads', async () => {
  messagePage.mockResolvedValueOnce(page([]));
  let detail;
  function Screen() { detail = useTopicDetail('topic'); return null; }
  await render(createElement(Screen));
  const staleRead = deferred();
  messagePage.mockReturnValueOnce(staleRead.promise);
  let refreshing;
  await act(async () => { refreshing = detail.refresh(); });
  castTopicVote.mockResolvedValueOnce();
  await act(async () => detail.voteTopic('up'));
  getTopic.mockResolvedValue({ ...baseTopic, upvotesCount: 1, netVotes: 1 });
  topicVote.mockResolvedValue('up');
  messagePage.mockResolvedValueOnce(page([]));
  await act(async () => { staleRead.resolve(page([])); await refreshing; });
  expect(detail.topicVote).toBe('up');
  expect(detail.topic.netVotes).toBe(1);
});
