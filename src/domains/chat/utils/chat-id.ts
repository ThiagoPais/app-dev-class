import { ChatError } from './chat-error';

/**
 * Canonical direct-chat ID: the two user IDs ordered with plain `<` (code-unit
 * order, never `localeCompare`, so it matches the security rules) and joined by `_`.
 */
export function buildDirectChatId(uidA: string, uidB: string): string {
  if (uidA === uidB) throw new ChatError('CHAT_SELF_NOT_ALLOWED');
  return uidA < uidB ? `${uidA}_${uidB}` : `${uidB}_${uidA}`;
}
