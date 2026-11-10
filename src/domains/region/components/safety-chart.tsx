import { Text, View, useWindowDimensions } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import { BrandColors } from '@/shared/constants/colors';

/** Screen width cap, side padding (16 + 16) and card padding (12 + 12). */
const MAX_SCREEN_WIDTH = 430;
const HORIZONTAL_INSET = 56;
const Y_AXIS_WIDTH = 28;

interface SafetyChartProps {
  series: { label: string; value: number }[];
}

/** Occurrences by type, with the count printed above each bar. */
export function SafetyChart({ series }: SafetyChartProps) {
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(screenWidth, MAX_SCREEN_WIDTH) - HORIZONTAL_INSET - Y_AXIS_WIDTH;
  const spacing = 10;
  const barWidth = Math.floor((width - spacing * (series.length + 1)) / series.length);
  const peak = Math.max(...series.map((item) => item.value));

  return (
    <BarChart
      barBorderRadius={barWidth / 2}
      barWidth={barWidth}
      data={series.map((item) => ({
        value: item.value,
        label: item.label,
        frontColor: item.value === peak ? BrandColors.primary : BrandColors.secondary,
        topLabelComponent: () => (
          <View style={{ marginBottom: 2 }}>
            <Text style={{ color: '#6B6B6B', fontSize: 8 }}>{item.value}</Text>
          </View>
        ),
      }))}
      disableScroll
      height={120}
      initialSpacing={spacing}
      isAnimated
      maxValue={Math.ceil(peak / 40) * 40}
      noOfSections={3}
      rulesColor="#EFEFEF"
      rulesType="dashed"
      spacing={spacing}
      width={width}
      xAxisColor="#E6E6E6"
      xAxisLabelTextStyle={{ color: '#8A8A8A', fontSize: 7, textAlign: 'center' }}
      yAxisLabelWidth={Y_AXIS_WIDTH}
      yAxisTextStyle={{ color: '#8A8A8A', fontSize: 8 }}
      yAxisThickness={0}
    />
  );
}
