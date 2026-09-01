import { StyleSheet, Text, View } from 'react-native';

import { landingColors } from './colors';

type SectionHeadingProps = {
  subtitle: string;
  title: string;
};

export function SectionHeading({ subtitle, title }: SectionHeadingProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 28,
    paddingHorizontal: 10,
  },
  title: {
    color: landingColors.ink,
    fontSize: 29,
    fontWeight: '800',
    lineHeight: 32,
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 1,
    color: '#B2B2B2',
    fontSize: 12,
    lineHeight: 15,
  },
});
