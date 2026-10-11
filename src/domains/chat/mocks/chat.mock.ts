/**
 * Placeholder data for the mini profile until the real profile fields exist.
 */
import type { ChatContact, MiniProfile } from '../models/chat.types';

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

export function getMockMiniProfile(participant: ChatContact): MiniProfile {
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
