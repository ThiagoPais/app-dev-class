import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

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

  return (
    <View style={[styles.contentCard, { backgroundColor }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.title, { color: textColor }]}>{title}</Text>
        <View style={[styles.badge, { backgroundColor: badgeBackground }]}>
          <Text style={[styles.badgeText, { color: badgeColor }]} numberOfLines={1}>
            {conversations} {conversations === 1 ? 'conversa' : 'conversas'}
          </Text>
        </View>
      </View>

      <Text style={[styles.description, { color: mutedColor, borderBottomColor: borderColor }]}>
        {description}
      </Text>

      <View style={styles.cardFooter}>
        <View style={styles.status}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.footerText, { color: mutedColor }]}>
            {statusLabel}
            {lastActivity ? ` - ${lastActivity}` : ''}
          </Text>
        </View>

        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Image
              source={require('@/icones/msg.svg')}
              style={styles.icon}
              tintColor={mutedColor}
              contentFit="contain"
            />
            <Text style={[styles.footerText, { color: mutedColor }]}>{messages}</Text>
          </View>

          <View style={styles.metric}>
            <Image
              source={require('@/icones/like.svg')}
              style={styles.icon}
              tintColor={mutedColor}
              contentFit="contain"
            />
            <Text style={[styles.footerText, { color: mutedColor }]}>{likes}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contentCard: {
    alignSelf: 'stretch',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  title: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  badge: {
    flexShrink: 0,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  description: {
    marginBottom: 16,
    fontSize: 16,
    borderBottomWidth: 1,
    paddingBottom: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  footerText: {
    fontSize: 14,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    flexShrink: 0,
  },
  metrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  icon: {
    width: 18,
    height: 18,
  },
});
