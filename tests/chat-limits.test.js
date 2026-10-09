import { expect, test } from 'bun:test';
import * as limits from '../src/domains/chat/constants/limits.ts';
import * as barrel from '../src/domains/chat/constants/index.ts';

const expected = {
  MAX_GROUP_MEMBERS: 100,
  MIN_GROUP_MEMBERS: 2,
  MAX_GROUP_NAME_LENGTH: 60,
  MAX_MESSAGE_LENGTH: 2000,
  LAST_MESSAGE_PREVIEW_LENGTH: 200,
  DEFAULT_CHAT_PAGE_SIZE: 20,
  DEFAULT_MESSAGE_PAGE_SIZE: 50,
  SUBSCRIBED_CHATS_LIMIT: 50,
};

for (const [name, value] of Object.entries(expected)) {
  test(`limits.ts exports ${name} = ${value}`, () => {
    expect(limits[name]).toBe(value);
  });

  test(`constants barrel re-exports ${name}`, () => {
    expect(barrel[name]).toBe(value);
  });
}
