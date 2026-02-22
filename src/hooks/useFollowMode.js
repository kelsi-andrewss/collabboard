import { useState } from 'react';

export function useFollowMode(presentUsers) {
  const [followUserId, setFollowUserId] = useState(null);

  const followedUserPresence = followUserId ? (presentUsers[followUserId] ?? null) : null;
  const isFollowing = followUserId !== null && followedUserPresence !== null;

  return { followUserId, setFollowUserId, followedUserPresence, isFollowing };
}
