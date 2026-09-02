import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

export function EmphasizedCopy({ children }: { children: ReactNode }) {
  return <Text style={styles.text}>{children}</Text>;
}

const styles = StyleSheet.create({
  text: {
    color: '#323232',
    fontWeight: '800',
  },
});
