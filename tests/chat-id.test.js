import { expect, test } from 'bun:test';

import { buildDirectChatId } from '../src/domains/chat/utils/chat-id.ts';
import * as barrel from '../src/domains/chat/utils/index.ts';

function captureError(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return undefined;
}

test('is symmetric for sorted, reversed and mixed pairs', () => {
  const pairs = [
    ['alice', 'bob'],
    ['uid2', 'uid1'],
    ['abc123', 'abc124'],
    ['Zed', 'amy'],
    ['x', 'xy'],
  ];
  for (const [a, b] of pairs) {
    expect(buildDirectChatId(a, b)).toBe(buildDirectChatId(b, a));
  }
});

test('output format is sorted[0]_sorted[1]', () => {
  expect(buildDirectChatId('alice', 'bob')).toBe('alice_bob');
  expect(buildDirectChatId('bob', 'alice')).toBe('alice_bob');
  expect(buildDirectChatId('u2', 'u1')).toBe('u1_u2');
});

test('uses code-unit ordering: uppercase before lowercase', () => {
  expect(buildDirectChatId('a', 'B')).toBe('B_a');
  expect(buildDirectChatId('B', 'a')).toBe('B_a');
});

test('uses code-unit ordering: digits before letters', () => {
  expect(buildDirectChatId('a1', '1a')).toBe('1a_a1');
  expect(buildDirectChatId('9', 'A')).toBe('9_A');
});

test('a prefix sorts before the longer id', () => {
  expect(buildDirectChatId('abc', 'ab')).toBe('ab_abc');
  expect(buildDirectChatId('ab', 'abc')).toBe('ab_abc');
});

test('does not follow localeCompare ordering', () => {
  // localeCompare('a','B') < 0 (a before B) but code units give 'B' < 'a'.
  expect('a'.localeCompare('B')).toBeLessThan(0);
  expect(buildDirectChatId('a', 'B')).not.toBe('a_B');
  expect(buildDirectChatId('a', 'B')).toBe('B_a');
});

test('throws CHAT_SELF_NOT_ALLOWED for identical ids', () => {
  const error = captureError(() => buildDirectChatId('same', 'same'));
  expect(error).toBeInstanceOf(Error);
  expect(error.code).toBe('CHAT_SELF_NOT_ALLOWED');
});

test('is deterministic over random ASCII-alphanumeric pairs', () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const rand = (n) => {
    let s = '';
    for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  };
  for (let i = 0; i < 500; i++) {
    const a = rand(1 + Math.floor(Math.random() * 12));
    const b = rand(1 + Math.floor(Math.random() * 12));
    if (a === b) continue;
    const id = buildDirectChatId(a, b);
    expect(id).toBe(buildDirectChatId(b, a));
    const [first, second] = [a, b].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
    expect(id).toBe(`${first}_${second}`);
    expect(first <= second).toBe(true);
  }
});

test('barrel exposes the same function', () => {
  expect(barrel.buildDirectChatId).toBe(buildDirectChatId);
});
