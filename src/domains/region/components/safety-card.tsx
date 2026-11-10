import { StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import { BrandColors } from '@/shared/constants/colors';

import { useLayoutWidth } from '../hooks/use-layout-width';
import type { SafetyInfo } from '../models/region.types';
import { toTickUnits } from '../utils/piecewise-scale';
import { InfoCard, infoCardStyles } from './info-card';

const CHART_HEIGHT = 200;
const Y_LABEL_WIDTH = 32;
const STEM_WIDTH = 2;
const DOT_SIZE = 12;
const AXIS_COLOR = '#E5E7EB';
const AXIS_TEXT_COLOR = '#9CA3AF';

/** Lollipop chart of occurrences per crime type, on the ticks given by the data. */
export function SafetyCard({ safety }: { safety: SafetyInfo }) {
  const { width, onLayout } = useLayoutWidth();
  const { axisTicks, occurrences } = safety;

  const values = occurrences.map(({ count }) => toTickUnits(count, axisTicks));
  // One unlabeled section on top leaves room for values past the last tick.
  const tickSections = axisTicks.length - 1;
  const sections = Math.max(tickSections, Math.ceil(Math.max(0, ...values)));
  const yAxisLabels = [
    ...axisTicks.map(String),
    ...Array.from({ length: sections - tickSections }, () => ''),
  ];

  const chartWidth = Math.max(0, width - Y_LABEL_WIDTH);
  const slot = occurrences.length ? chartWidth / occurrences.length : 0;
  // Centers each stem in its slot. gifted-charts pads the bars by initialSpacing twice
  // (scroll content and bar row), hence the halving.
  const initialSpacing = (slot / 2 - STEM_WIDTH / 2) / 2;

  const data = occurrences.map(({ label }, index) => ({
    value: values[index],
    label,
    topLabelComponent: () => <View style={styles.dot} />,
    topLabelContainerStyle: {
      width: DOT_SIZE,
      height: DOT_SIZE,
      top: -DOT_SIZE / 2,
      left: (STEM_WIDTH - DOT_SIZE) / 2,
    },
  }));

  const chartSummary = occurrences.map(({ label, count }) => `${label}: ${count}`).join(', ');

  return (
    <InfoCard title={safety.title}>
      <View accessibilityLabel={chartSummary} accessible onLayout={onLayout} style={styles.chart}>
        {width > 0 ? (
          <BarChart
            barWidth={STEM_WIDTH}
            data={data}
            disablePress
            disableScroll
            endSpacing={0}
            frontColor={BrandColors.primary}
            height={CHART_HEIGHT}
            initialSpacing={initialSpacing}
            maxValue={sections}
            noOfSections={sections}
            overflowTop={DOT_SIZE}
            rulesColor={AXIS_COLOR}
            rulesType="solid"
            spacing={slot - STEM_WIDTH}
            stepValue={1}
            width={chartWidth}
            xAxisColor={AXIS_COLOR}
            xAxisLabelTextStyle={styles.xAxisLabel}
            xAxisTextNumberOfLines={2}
            yAxisLabelTexts={yAxisLabels}
            yAxisLabelWidth={Y_LABEL_WIDTH}
            yAxisTextStyle={styles.yAxisLabel}
            yAxisThickness={0}
          />
        ) : null}
      </View>
      <View style={styles.footer}>
        <Text style={styles.summary}>{safety.summary}</Text>
        <Text style={infoCardStyles.footnote}>{safety.source}</Text>
        {safety.warning ? <Text style={styles.warning}>{safety.warning}</Text> : null}
      </View>
    </InfoCard>
  );
}

const styles = StyleSheet.create({
  chart: {
    minHeight: CHART_HEIGHT + 56,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: BrandColors.primary,
  },
  xAxisLabel: {
    color: AXIS_TEXT_COLOR,
    fontSize: 9,
    lineHeight: 11,
  },
  yAxisLabel: {
    color: '#6B7280',
    fontSize: 11,
  },
  footer: {
    gap: 2,
  },
  summary: {
    color: BrandColors.textPrimary,
    fontSize: 13,
    marginBottom: 2,
  },
  warning: {
    ...infoCardStyles.footnote,
    color: BrandColors.primary,
  },
});
