export type ChatErrorCode =
  | 'CHAT_SELF_NOT_ALLOWED'
  | 'CHAT_MESSAGE_EMPTY'
  | 'CHAT_MESSAGE_TOO_LONG'
  | 'CHAT_NOT_FOUND'
  | 'CHAT_NOT_PARTICIPANT'
  | 'CHAT_NOT_ADMIN'
  | 'CHAT_NOT_GROUP'
  | 'CHAT_GROUP_FULL'
  | 'CHAT_GROUP_TOO_SMALL'
  | 'CHAT_GROUP_NAME_INVALID'
  | 'CHAT_LAST_ADMIN';

/** Error with a stable `code` so hooks can branch without parsing messages. */
export class ChatError extends Error {
  readonly code: ChatErrorCode;

  constructor(code: ChatErrorCode, message: string = code) {
    super(message);
    this.name = 'ChatError';
    this.code = code;
  }
}
