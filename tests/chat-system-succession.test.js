import { describe, expect, test } from 'bun:test';
import { serverTimestamp } from 'firebase/firestore';

import {
  applyAdminSuccession,
  systemMessageData,
} from '../src/domains/chat/services/chat.helpers.ts';

const KINDS = [
  'group_created',
  'member_added',
  'member_removed',
  'member_left',
  'admin_promoted',
  'admin_demoted',
  'group_renamed',
];

// ---- systemMessageData (spec 3.1 ChatSystemEvent/ChatMessage; DB doc 3.9 wire names) ----
describe('systemMessageData', () => {
  test('builds the full wire payload (spec 3.1)', () => {
    const data = systemMessageData('chat1', 'member_added', 'alice', ['bob']);
    expect(data.chat_id).toBe('chat1');
    expect(data.type).toBe('system');
    expect(data.author_id).toBeNull();
    expect(data.author_snapshot).toBeNull();
    expect(data.message).toBeNull();
    expect(data.is_deleted).toBe(false);
    expect(data.system_event).toEqual({ kind: 'member_added', actor_id: 'alice', target_ids: ['bob'] });
  });

  test('created_at and updated_at are serverTimestamp sentinels', () => {
    const data = systemMessageData('chat1', 'group_created', 'alice', []);
    expect(data.created_at.isEqual(serverTimestamp())).toBe(true);
    expect(data.updated_at.isEqual(serverTimestamp())).toBe(true);
  });

  for (const kind of KINDS) {
    test(`supports kind ${kind}`, () => {
      const data = systemMessageData('c', kind, 'actor', ['t1']);
      expect(data.system_event.kind).toBe(kind);
      expect(data.system_event.actor_id).toBe('actor');
      expect(data.type).toBe('system');
    });
  }

  test('empty targetIds (rename/created) yields empty target_ids', () => {
    expect(systemMessageData('c', 'group_renamed', 'a', []).system_event.target_ids).toEqual([]);
    expect(systemMessageData('c', 'group_created', 'a', []).system_event.target_ids).toEqual([]);
  });

  test('several targets preserved in order', () => {
    const data = systemMessageData('c', 'member_added', 'a', ['x', 'y', 'z']);
    expect(data.system_event.target_ids).toEqual(['x', 'y', 'z']);
  });

  test('targetIds is copied, not aliased', () => {
    const targets = ['x', 'y'];
    const data = systemMessageData('c', 'member_added', 'a', targets);
    targets.push('z');
    targets[0] = 'changed';
    expect(data.system_event.target_ids).toEqual(['x', 'y']);
    expect(data.system_event.target_ids).not.toBe(targets);
  });

  test('exact key set, no extras', () => {
    const data = systemMessageData('c', 'member_left', 'a', ['a']);
    expect(Object.keys(data).sort()).toEqual(
      [
        'author_id',
        'author_snapshot',
        'chat_id',
        'created_at',
        'is_deleted',
        'message',
        'system_event',
        'type',
        'updated_at',
      ].sort(),
    );
    expect(Object.keys(data.system_event).sort()).toEqual(['actor_id', 'kind', 'target_ids']);
  });
});

// ---- applyAdminSuccession (spec 3.2 Group behavior notes; Groups AC#7 / AC#8) ----
describe('applyAdminSuccession', () => {
  test('admin still present: unchanged, no promotion', () => {
    expect(applyAdminSuccession(['alice', 'bob', 'carol'], ['alice'])).toEqual({
      adminIds: ['alice'],
      promoted: null,
    });
  });

  test('last admin removed: oldest remaining member (userIds[0]) is promoted, not alphabetical', () => {
    expect(applyAdminSuccession(['zed', 'bob', 'amy'], [])).toEqual({
      adminIds: ['zed'],
      promoted: 'zed',
    });
    // admin 'alice' already filtered out of userIds by the caller
    expect(applyAdminSuccession(['zed', 'bob', 'amy'], ['alice'])).toEqual({
      adminIds: ['zed'],
      promoted: 'zed',
    });
  });

  test('several admins, one removed: remaining admin kept, no promotion', () => {
    expect(applyAdminSuccession(['bob', 'carol'], ['alice', 'bob'])).toEqual({
      adminIds: ['bob'],
      promoted: null,
    });
  });

  test('stale admin ids dropped even when another admin remains, order preserved', () => {
    expect(applyAdminSuccession(['a', 'b', 'c'], ['ghost', 'c', 'x', 'a'])).toEqual({
      adminIds: ['c', 'a'],
      promoted: null,
    });
  });

  test('adminIds already empty with members: promotes userIds[0]', () => {
    expect(applyAdminSuccession(['m1', 'm2'], [])).toEqual({ adminIds: ['m1'], promoted: 'm1' });
  });

  test('empty group: no admins, no promotion', () => {
    expect(applyAdminSuccession([], [])).toEqual({ adminIds: [], promoted: null });
    expect(applyAdminSuccession([], ['ghost'])).toEqual({ adminIds: [], promoted: null });
  });

  test('single remaining member becomes admin', () => {
    expect(applyAdminSuccession(['solo'], ['gone'])).toEqual({ adminIds: ['solo'], promoted: 'solo' });
  });

  test('pure: inputs unchanged and new arrays returned', () => {
    const userIds = ['a', 'b', 'c'];
    const adminIds = ['ghost', 'b'];
    const userClone = structuredClone(userIds);
    const adminClone = structuredClone(adminIds);
    const result = applyAdminSuccession(userIds, adminIds);
    expect(userIds).toEqual(userClone);
    expect(adminIds).toEqual(adminClone);
    expect(result.adminIds).not.toBe(adminIds);
    expect(result.adminIds).not.toBe(userIds);

    const noChange = applyAdminSuccession(userIds, ['a']);
    expect(noChange.adminIds).not.toBe(userIds);

    const promoted = applyAdminSuccession(userIds, []);
    expect(userIds).toEqual(userClone);
    expect(promoted.adminIds).toEqual(['a']);
  });
});
