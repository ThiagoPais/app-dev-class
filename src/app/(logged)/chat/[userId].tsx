import { useLocalSearchParams } from 'expo-router';

import { ChatScreen } from '@/domains/chat';

export default function ChatRoute() {
  const { userId, name, avatarUrl } = useLocalSearchParams<{
    userId: string;
    name?: string;
    avatarUrl?: string;
  }>();

  return (
    <ChatScreen
      key={userId}
      participant={{ id: userId, fullName: name ?? '', avatarUrl: avatarUrl ?? null }}
    />
  );
}
