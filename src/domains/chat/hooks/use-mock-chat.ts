import { useEffect, useRef, useState } from 'react';

import { getMockConversation, getMockReply } from '../mocks/chat.mock';
import type { ConversationMessage } from '../models/chat.types';

/**
 * Local-only conversation used by the chat mock. Sent messages stay in memory
 * and the other person "answers" with lorem ipsum. Replace with the WebSocket
 * implementation keeping the same return shape.
 */
export function useMockChat(otherId: string, myId: string) {
  const [messages, setMessages] = useState<ConversationMessage[]>(() =>
    getMockConversation(otherId, myId)
  );
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setMessages((current) => [
      ...current,
      { id: `local-${Date.now()}`, senderId: myId, text: trimmed, sentAt: new Date() },
    ]);

    setIsOtherTyping(true);
    timers.current.push(
      setTimeout(() => {
        setIsOtherTyping(false);
        setMessages((current) => [
          ...current,
          { id: `reply-${Date.now()}`, senderId: otherId, text: getMockReply(), sentAt: new Date() },
        ]);
      }, 1500)
    );
  };

  return { messages, isOtherTyping, send };
}
