import type { Ionicons } from '@expo/vector-icons';

type IoniconName = keyof typeof Ionicons.glyphMap;

export interface RegionDetails {
  tags: string[];
  description: string;
  extraPhotos: number;
  mobility: {
    text: string;
    modes: { icon: IoniconName; label: string }[];
    source: string;
  };
  leisure: { label: string; percent: number }[];
  residents: { title: string; items: string[] };
  income: {
    summary: string;
    /** Bars of the income distribution; `highlighted` marks this region. */
    bars: { label: string; value: number; highlighted?: boolean }[];
    source: string;
  };
  safety: {
    series: { label: string; value: number }[];
    note: string;
  };
}

/** Static data while the region endpoint does not exist; every RA shares it. */
export const REGION_DETAILS_MOCK: RegionDetails = {
  tags: ['Bem-localizado', 'Custo-benefício'],
  description:
    'O Núcleo Bandeirante fica entre o Plano Piloto, o Park Way, o Riacho Fundo e o Aeroporto, com acesso direto pela EPTG e EPIA. O custo de vida é mais baixo que no Plano Piloto, apesar da proximidade. A região é conhecida como "Cidade Livre" antes da construção de Brasília, e ainda mantém ruas estreitas e ritmo tranquilo.',
  extraPhotos: 4,
  mobility: {
    text: 'A obra de ligação entre o Guará, o Park Way e o Núcleo Bandeirante foi duplicada e entregue recentemente.',
    modes: [
      { icon: 'train-outline', label: 'Metrô' },
      { icon: 'bus-outline', label: 'Ônibus' },
      { icon: 'bicycle-outline', label: 'Ciclovia' },
    ],
    source: 'STPG/DF 2025',
  },
  leisure: [
    { label: 'Ponto de ônibus', percent: 95 },
    { label: 'Ruas arborizadas', percent: 92.3 },
    { label: 'Quadras esportivas', percent: 92.1 },
    { label: 'Praça', percent: 90.5 },
    { label: 'Academia/PEC', percent: 89.7 },
    { label: 'Travessia sinalizada', percent: 87 },
    { label: 'Jardins/Parques', percent: 81.4 },
    { label: 'Ciclovia/Ciclofaixa', percent: 70.3 },
    { label: 'Espaço cultural', percent: 67.5 },
  ],
  residents: {
    title: 'Moradores afirmaram ter na rua ou nas proximidades',
    items: ['Rua asfaltada', 'Rua iluminada', 'Rua com calçada', 'Drenagem de chuva'],
  },
  income: {
    summary:
      'Comparado às demais RAs do DF, o Núcleo Bandeirante está na faixa de renda média-alta. A renda domiciliar média mensal gira em torno de R$ 5.486,00 (maior parte dos domicílios concentram mais de 2 a 5 salários mínimos).',
    bars: [
      { label: 'Até 1', value: 48 },
      { label: '1–2', value: 52 },
      { label: '2–3', value: 50 },
      { label: '3–4', value: 58 },
      { label: '4–5', value: 60 },
      { label: '5–6', value: 64 },
      { label: '6–8', value: 68 },
      { label: '8–10', value: 74, highlighted: true },
      { label: '10–12', value: 80 },
      { label: '12–15', value: 86 },
      { label: '15–20', value: 92 },
      { label: '20+', value: 100 },
    ],
    source: 'PDAD 2024',
  },
  safety: {
    series: [
      { label: 'Homicídio', value: 4 },
      { label: 'Roubo a transeunte', value: 12 },
      { label: 'Furto em veículo', value: 112 },
      { label: 'Roubo de veículo', value: 8 },
      { label: 'Roubo em comércio', value: 10 },
      { label: 'Furto de veículo', value: 90 },
      { label: 'Furto a pedestre', value: 22 },
    ],
    note: 'Total de ocorrências e abaixo da média do DF',
  },
};

export interface ForumHighlight {
  id: string;
  authorName: string;
  avatarUrl: string | null;
  votes: number;
  title: string;
  content: string;
}

/** Shown while a region has no real topics, so the screen can be demoed (e.g. Sobradinho). */
export const FORUM_HIGHLIGHTS_MOCK: ForumHighlight[] = [
  {
    id: 'mock-1',
    authorName: 'Ana Beatriz',
    avatarUrl: null,
    votes: 18,
    title: 'Vale a pena morar aqui?',
    content:
      'Moro aqui há 3 anos e o que mais gosto é a facilidade de ir pro Plano sem pegar trânsito.',
  },
  {
    id: 'mock-2',
    authorName: 'Clara Leão',
    avatarUrl: null,
    votes: 14,
    title: 'Comércio e vida noturna',
    content:
      'O comércio tem de tudo, mas depois das 22h fecha quase tudo. Se você trabalha até tarde, precisa se programar.',
  },
  {
    id: 'mock-3',
    authorName: 'Rafael Souza',
    avatarUrl: null,
    votes: 9,
    title: 'Opções de lazer no fim de semana',
    content:
      'Tem bastante praça e quadra pra quem gosta de ficar ao ar livre, e feira aos domingos.',
  },
];
