import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

export interface HeaderBannerProps {
  style?: StyleProp<ViewStyle>;
  rowHeight?: number;
}

export function HeaderBanner({ style, rowHeight = 38.25 }: HeaderBannerProps) {
  const dynamicHeight = { height: rowHeight };

  return (
    <View style={[styles.container, style]}>
      {/* Row 1 */}
      <View style={styles.lineContainer}>
        <View style={[styles.topLightRight, dynamicHeight]} />
        <View style={[styles.topLightLeft, dynamicHeight]} />
        <View style={[styles.topLightRight, dynamicHeight]} />
        <View style={[styles.topLightLeft, dynamicHeight]} />
      </View>

      {/* Row 2 */}
      <View style={styles.lineContainer}>
        <View style={[styles.topDarkRight, dynamicHeight]} />
        <View style={[styles.topDarkLeft, dynamicHeight]} />
        <View style={[styles.topDarkRight, dynamicHeight]} />
        <View style={[styles.topDarkLeft, dynamicHeight]} />
      </View>

      {/* Row 3 */}
      <View style={styles.lineContainer}>
        <View style={[styles.bottomLightRight, dynamicHeight]} />
        <View style={[styles.bottomLightLeft, dynamicHeight]} />
        <View style={[styles.bottomLightRight, dynamicHeight]} />
        <View style={[styles.bottomLightLeft, dynamicHeight]} />
      </View>

      {/* Row 4 */}
      <View style={styles.lineContainer}>
        <View style={[styles.bottomDarkRight, dynamicHeight]} />
        <View style={[styles.bottomDarkLeft, dynamicHeight]} />
        <View style={[styles.bottomDarkRight, dynamicHeight]} />
        <View style={[styles.bottomDarkLeft, dynamicHeight]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
  lineContainer: {
    flexDirection: 'row',
    width: '100%',
    margin: 0,
    borderWidth: 0,
  },
  topLightRight: {
    backgroundColor: '#E96E97',
    flex: 1,
    borderTopRightRadius: 74,
  },
  topLightLeft: {
    backgroundColor: '#E96E97',
    flex: 1,
    borderTopLeftRadius: 74,
  },
  topDarkRight: {
    backgroundColor: '#832D51',
    flex: 1,
    borderTopLeftRadius: 74,
    borderBottomRightRadius: 74,
  },
  topDarkLeft: {
    backgroundColor: '#832D51',
    flex: 1,
    borderTopRightRadius: 74,
    borderBottomLeftRadius: 74,
  },
  bottomLightRight: {
    backgroundColor: '#E96E97',
    flex: 1,
    borderBottomRightRadius: 74,
  },
  bottomLightLeft: {
    backgroundColor: '#E96E97',
    flex: 1,
    borderBottomLeftRadius: 74,
  },
  bottomDarkRight: {
    backgroundColor: '#832D51',
    flex: 1,
    borderTopRightRadius: 74,
  },
  bottomDarkLeft: {
    backgroundColor: '#832D51',
    flex: 1,
    borderTopLeftRadius: 74,
  },
});
