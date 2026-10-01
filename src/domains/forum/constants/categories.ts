import type { Ionicons } from '@expo/vector-icons';

/** Topic areas inside each RA forum; the same themes as the landing page tiles. */
export const FORUM_CATEGORIES = [
  { id: 'seguranca', label: 'Segurança', icon: 'shield-checkmark-outline' },
  { id: 'transporte', label: 'Transporte', icon: 'bus-outline' },
  { id: 'lazer', label: 'Lazer', icon: 'location-outline' },
  { id: 'mercado', label: 'Mercado', icon: 'cart-outline' },
  { id: 'geral', label: 'Geral', icon: 'chatbubbles-outline' },
] as const satisfies readonly {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[];

export type ForumCategory = (typeof FORUM_CATEGORIES)[number]['id'];

/** Topics created before areas existed have no category and are shown as "Geral". */
export const DEFAULT_FORUM_CATEGORY: ForumCategory = 'geral';

export function isForumCategory(value: unknown): value is ForumCategory {
  return FORUM_CATEGORIES.some((category) => category.id === value);
}

export function getCategoryLabel(category: ForumCategory): string {
  return FORUM_CATEGORIES.find((item) => item.id === category)?.label ?? 'Geral';
}
