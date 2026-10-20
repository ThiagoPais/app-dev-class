import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';

import { BrandColors } from '@/shared/constants/colors';

const HEIGHT = 170;
const TOP = 10;
const BOTTOM = 42;
const LEFT = 26;
const TICKS = [0, 25, 50, 75, 100, 125, 150];

/** Lollipop chart: one stem per occurrence type. */
export function SafetyChart({ series }: { series: { label: string; value: number }[] }) {
  const [width, setWidth] = useState(0);
  const max = TICKS[TICKS.length - 1];
  const plotHeight = HEIGHT - TOP - BOTTOM;
  const step = width > LEFT ? (width - LEFT) / series.length : 0;
  const y = (value: number) => TOP + plotHeight * (1 - value / max);

  return (
    <View
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      style={styles.container}>
      {width > 0 ? (
        <Svg height={HEIGHT} width={width}>
          {TICKS.map((tick) => (
            <SvgText
              fill="#8A8A8A"
              fontSize={7}
              key={tick}
              textAnchor="end"
              x={LEFT - 6}
              y={y(tick) + 2}>
              {tick}
            </SvgText>
          ))}
          <Line stroke="#E6E6E6" x1={LEFT} x2={width} y1={y(0)} y2={y(0)} />
          {series.map((item, index) => {
            const x = LEFT + step * index + step / 2;
            return (
              <G key={item.label}>
                <Line
                  stroke={BrandColors.primary}
                  strokeWidth={1}
                  x1={x}
                  x2={x}
                  y1={y(0)}
                  y2={y(item.value)}
                />
                <Circle cx={x} cy={y(item.value)} fill={BrandColors.primary} r={2.5} />
                <SvgText fill="#8A8A8A" fontSize={6} textAnchor="middle" x={x} y={y(0) + 12}>
                  {item.label.split(' ')[0]}
                </SvgText>
                <SvgText fill="#8A8A8A" fontSize={6} textAnchor="middle" x={x} y={y(0) + 20}>
                  {item.label.split(' ').slice(1).join(' ')}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: HEIGHT,
    width: '100%',
  },
});
