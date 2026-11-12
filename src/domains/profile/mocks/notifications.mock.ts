/**
 * Placeholder notifications until a real notifications backend exists.
 */
export type NotificationKind = 'chat' | 'forum';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  /** Human-readable relative time, e.g. "5 min". */
  time: string;
  read: boolean;
  /** Who triggered the notification (chat sender or forum author). */
  actorName: string;
  /** Forum topic or region the notification refers to. */
  context?: string;
}

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    kind: 'chat',
    title: 'Nova mensagem',
    actorName: 'Mariana Souza',
    message: 'Oi! Vi que você está pensando em se mudar para Águas Claras, posso te ajudar.',
    time: '2 min',
    read: false,
  },
  {
    id: 'n2',
    kind: 'forum',
    title: 'Nova resposta no seu fórum favorito',
    actorName: 'Lucas Pereira',
    context: 'Segurança à noite na Asa Norte',
    message: 'Respondeu: "Perto da 410 Norte é bem tranquilo, principalmente com o novo policiamento."',
    time: '18 min',
    read: false,
  },
  {
    id: 'n3',
    kind: 'chat',
    title: 'Nova mensagem',
    actorName: 'João Henrique',
    message: 'Combinado, te mando as fotos do apartamento amanhã.',
    time: '1 h',
    read: false,
  },
  {
    id: 'n4',
    kind: 'forum',
    title: 'Novo tópico em região favorita',
    actorName: 'Ana Beatriz',
    context: 'Taguatinga',
    message: 'Criou o tópico "Melhores escolas públicas da região?"',
    time: '3 h',
    read: true,
  },
  {
    id: 'n5',
    kind: 'forum',
    title: 'Nova resposta no seu fórum favorito',
    actorName: 'Carlos Lima',
    context: 'Transporte público no Guará',
    message: 'Respondeu: "O metrô resolve bem, mas os ônibus no fim de semana demoram."',
    time: 'Ontem',
    read: true,
  },
  {
    id: 'n6',
    kind: 'chat',
    title: 'Nova mensagem',
    actorName: 'Fernanda Rocha',
    message: 'Obrigada pelas dicas sobre Sobradinho! 😊',
    time: '2 dias',
    read: true,
  },
];
