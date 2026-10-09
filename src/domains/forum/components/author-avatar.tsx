import { UserAvatar } from '@/shared/components/ui';

import type { AuthorSnapshot } from '../models/forumTypes';

export function AuthorAvatar({ author, size = 36 }: { author: AuthorSnapshot; size?: number }) {
  return <UserAvatar avatarUrl={author.avatarUrl} name={author.fullName} size={size} />;
}
