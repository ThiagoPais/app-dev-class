import { BarChart } from 'react-native-gifted-charts';
import { useWindowDimensions } from 'react-native';

import { BrandColors } from '@/shared/constants/colors';

/** Screen width cap, side padding (16 + 16) and card padding (12 + 12). */
const MAX_SCREEN_WIDTH = 430;
const HORIZONTAL_INSET = 56;

interface IncomeChartProps {
  bars: { label: string; value: number; highlighted?: boolean }[];
}

/** Income distribution by bracket; the bar for this RA is drawn in the brand colour. */
export function IncomeChart({ bars }: IncomeChartProps) {
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(screenWidth, MAX_SCREEN_WIDTH) - HORIZONTAL_INSET;
  const spacing = 6;
  const barWidth = Math.floor((width - spacing * (bars.length + 1)) / bars.length);

  return (
    <BarChart
      adjustToWidth
      barBorderRadius={4}
      barWidth={barWidth}
      data={bars.map((bar) => ({
        value: bar.value,
        label: bar.label,
        frontColor: bar.highlighted ? BrandColors.primary : '#EBD3DD',
        gradientColor: bar.highlighted ? BrandColors.secondary : '#F7ECF1',
        showGradient: true,
      }))}
      disableScroll
      height={110}
      hideRules
      hideYAxisText
      initialSpacing={spacing}
      isAnimated
      noOfSections={3}
      spacing={spacing}
      width={width}
      xAxisColor="#E6E6E6"
      xAxisLabelTextStyle={{ color: '#8A8A8A', fontSize: 7 }}
      yAxisThickness={0}
    />
  );
}
