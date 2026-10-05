/**
 * Placeholder data for the mini profile and chat screens until the real
 * profile fields and the WebSocket conversation backend exist.
 */
import type { ChatMessage, ChatParticipant, MiniProfile } from '../models/chat.types';

const LOREM = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  'Ut enim ad minim veniam, quis nostrud exercitation ullamco.',
  'Duis aute irure dolor in reprehenderit in voluptate velit esse.',
  'Excepteur sint occaecat cupidatat non proident.',
  'Curabitur pretium tincidunt lacus, nulla gravida orci a odio.',
  'Nullam varius, turpis et commodo pharetra.',
];

const CITIES = ['Asa Norte', 'Águas Claras', 'Taguatinga', 'Guará', 'Sobradinho', 'Ceilândia'];

/** Stable pseudo-random number per user, so the same person always gets the same mock. */
function seedFrom(id: string): number {
  return [...id].reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 7);
}

export function getMockMiniProfile(participant: ChatParticipant): MiniProfile {
  const seed = seedFrom(participant.id);
  return {
    ...participant,
    city: CITIES[seed % CITIES.length],
    bio: `${LOREM[seed % LOREM.length]} ${LOREM[(seed + 3) % LOREM.length]}`,
    memberSince: `${['jan', 'mar', 'mai', 'ago', 'out'][seed % 5]} de 2026`,
    topicsCount: seed % 12,
    repliesCount: (seed % 40) + 3,
  };
}

export function getMockConversation(otherId: string, myId: string): ChatMessage[] {
  const start = Date.now() - 1000 * 60 * 90;
  const lines = [
    { from: otherId, text: 'Oi! Lorem ipsum dolor sit amet?' },
    { from: myId, text: 'Oi, tudo bem? Consectetur adipiscing elit, sed do eiusmod.' },
    { from: otherId, text: LOREM[1] },
    { from: otherId, text: LOREM[2] },
    { from: myId, text: 'Duis aute irure dolor in reprehenderit 😄' },
    { from: otherId, text: LOREM[4] },
  ];

  return lines.map((line, index) => ({
    id: `mock-${index}`,
    senderId: line.from,
    text: line.text,
    sentAt: new Date(start + index * 1000 * 60 * 7),
  }));
}

export function getMockReply(): string {
  return LOREM[Math.floor(Math.random() * LOREM.length)];
}
