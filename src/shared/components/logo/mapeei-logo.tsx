import React from 'react';
import {
  Image,
  ImageStyle,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

const LOGO_SOURCE = require('@/shared/assets/images/logo_mapeei.png');
const DEFAULT_WIDTH = 96;
const DEFAULT_HEIGHT = 54;
const ASPECT_RATIO = DEFAULT_WIDTH / DEFAULT_HEIGHT;

export interface MapeeiLogoProps {
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  height?: number;
  width?: number;
}

export function MapeeiLogo({
  style,
  imageStyle,
  height,
  width,
}: MapeeiLogoProps) {
  let calculatedWidth = DEFAULT_WIDTH;
  let calculatedHeight = DEFAULT_HEIGHT;

  if (width !== undefined && height !== undefined) {
    calculatedWidth = width;
    calculatedHeight = height;
  } else if (width !== undefined) {
    calculatedWidth = width;
    calculatedHeight = width / ASPECT_RATIO;
  } else if (height !== undefined) {
    calculatedHeight = height;
    calculatedWidth = height * ASPECT_RATIO;
  }

  return (
    <View style={[styles.container, style]}>
      <Image
        source={LOGO_SOURCE}
        style={[
          {
            width: calculatedWidth,
            height: calculatedHeight,
          },
          imageStyle,
        ]}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel="Logo Mapeei"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
