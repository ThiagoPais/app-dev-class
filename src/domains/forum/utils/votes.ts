import type { VoteType } from '../models/forumTypes';

interface VoteCounts {
  upvotesCount: number;
  downvotesCount: number;
  netVotes: number;
}

/**
 * Mirrors the toggle logic of the vote transaction in forum.service so the UI can
 * update optimistically: voting the same way again removes the vote, voting the
 * other way switches it.
 */
export function applyVote<T extends VoteCounts>(
  item: T,
  previous: VoteType | null,
  voteType: VoteType
): { item: T; vote: VoteType | null } {
  let { upvotesCount, downvotesCount } = item;

  if (previous === 'up') upvotesCount -= 1;
  if (previous === 'down') downvotesCount -= 1;

  const vote = previous === voteType ? null : voteType;

  if (vote === 'up') upvotesCount += 1;
  if (vote === 'down') downvotesCount += 1;

  return {
    item: {
      ...item,
      upvotesCount,
      downvotesCount,
      netVotes: item.netVotes + (upvotesCount - item.upvotesCount) - (downvotesCount - item.downvotesCount),
    },
    vote,
  };
}
