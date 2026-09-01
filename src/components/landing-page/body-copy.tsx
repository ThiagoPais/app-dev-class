import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

export function BodyCopy({ children }: { children: ReactNode }) {
  return <Text style={styles.text}>{children}</Text>;
}

const styles = StyleSheet.create({
  text: {
    color: '#505050',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 15,
  },
});
