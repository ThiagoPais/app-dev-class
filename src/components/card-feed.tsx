import { Image } from 'expo-image';
import { CSSProperties } from 'react';
import { StyleSheet } from 'react-native';

export type CardFeedProps = {
  /** Conteudo */
  title: string;
  description: string;
  conversations: number;
  messages: number;
  likes: number;
  /** Estado: controla o ponto, o texto e as cores do selo */
  active?: boolean;
  lastActivity?: string;
  /** Cores (todas opcionais) */
  backgroundColor?: string;
  textColor?: string;
  mutedColor?: string;
  accentColor?: string;
  accentBackground?: string;
  borderColor?: string;
};

const InactiveColor = '#9AA0A6';
const InactiveBackground = '#F0F0F3';
const ActiveColor = '#2E9E5B';

export function CardFeed({
  title,
  description,
  conversations,
  messages,
  likes,
  active = false,
  lastActivity,
  backgroundColor = '#FFFFFF',
  textColor = '#000000',
  mutedColor = '#60646C',
  accentColor = '#C0355F',
  accentBackground = '#FCE4EF',
  borderColor = '#E0E1E6',
}: CardFeedProps) {

  const badgeColor = active ? accentColor : InactiveColor;
  const badgeBackground = active ? accentBackground : InactiveBackground;
  const statusColor = active ? ActiveColor : InactiveColor;
  const statusLabel = active ? 'Ativa agora' : 'Inativa';

  const contentCard: CSSProperties = {
    alignSelf: 'stretch',
    backgroundColor,
    color: textColor,
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
  }

  const cardHeader: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  }

  const titleStyle: CSSProperties = {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
  }

  const badge: CSSProperties = {
    flexShrink: 0,
    fontSize: 13,
    fontWeight: 600,
    color: badgeColor,
    backgroundColor: badgeBackground,
    padding: '4px 10px',
    borderRadius: 999,
    whiteSpace: 'nowrap',
  }

  const descriptionStyle: CSSProperties = {
    margin: 0,
    marginBottom: 16,
    fontSize: 16,
    color: mutedColor,
    borderBottom: `1px solid ${borderColor}`,
    paddingBottom: 16,
  }

  const cardFooter: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    fontSize: 14,
    color: mutedColor,
  }

  const status: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  }

  const statusDot: CSSProperties = {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: statusColor,
    flexShrink: 0,
  }

  const metrics: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  }

  const metric: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  }

  return (
    <div style={contentCard}>
      <div style={cardHeader}>
        <p style={titleStyle}>{title}</p>
        <div style={badge}>
          {conversations} {conversations === 1 ? 'conversa' : 'conversas'}
        </div>
      </div>

      <p style={descriptionStyle}>{description}</p>

      <div style={cardFooter}>
        <span style={status}>
          <span style={statusDot} />
          {statusLabel}
          {lastActivity ? ` - ${lastActivity}` : ''}
        </span>

        <div style={metrics}>
          <span style={metric}>
            <Image
              source={require('@/icones/msg.svg')}
              style={styles.icon}
              tintColor={mutedColor}
              contentFit="contain"
            />
            {messages}
          </span>

          <span style={metric}>
            <Image
              source={require('@/icones/like.svg')}
              style={styles.icon}
              tintColor={mutedColor}
              contentFit="contain"
            />
            {likes}
          </span>
        </div>
      </div>
    </div>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 18,
    height: 18,
  },
});
