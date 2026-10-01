import type { ForumCategory } from '../constants/categories';

export type VoteType = 'up' | 'down';

export type TopicFeedSort = 'recent' | 'top';

export interface AuthorSnapshot {
  fullName: string;
  avatarUrl: string | null;
}

export interface ForumTopic {
  id: string;
  authorId: string;
  authorSnapshot: AuthorSnapshot;
  title: string;
  content: string;
  region: string;
  city: string;
  cityNormalized: string;
  category: ForumCategory;
  upvotesCount: number;
  downvotesCount: number;
  netVotes: number;
  repliesCount: number;
  isPinned: boolean;
  isLocked: boolean;
  isDeleted: boolean;
  lastReplyAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ForumMessage {
  id: string;
  topicId: string;
  authorId: string;
  authorSnapshot: AuthorSnapshot;
  content: string;
  upvotesCount: number;
  downvotesCount: number;
  netVotes: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ForumVote {
  userId: string;
  voteType: VoteType;
  createdAt: Date;
}

export interface MessageVote {
  userId: string;
  voteType: VoteType;
  createdAt: Date;
}

export interface CreateForumTopicDTO {
  authorId: string;
  authorSnapshot: AuthorSnapshot;
  title: string;
  content: string;
  region: string;
  city: string;
  category: ForumCategory;
}

export interface UpdateForumTopicDTO {
  title?: string;
  content?: string;
}

export interface CreateForumMessageDTO {
  topicId: string;
  authorId: string;
  authorSnapshot: AuthorSnapshot;
  content: string;
}

export interface UpdateForumMessageDTO {
  content: string;
}
