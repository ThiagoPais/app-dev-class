import { StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import { BrandColors } from '@/shared/constants/colors';

import { useLayoutWidth } from '../hooks/use-layout-width';
import type { IncomeInfo } from '../models/region.types';
import { InfoCard, infoCardStyles } from './info-card';

const CHART_HEIGHT = 64;
const BAR_GAP = 2;
const LABEL_WIDTH = 80;
const LABEL_HEIGHT = 16;
const OTHER_BAR_COLOR = '#CCCCCC';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Every RA's income as a descending bar strip, with this region's bar highlighted. */
export function IncomeCard({ income, regionName }: { income: IncomeInfo; regionName: string }) {
  const { width, onLayout } = useLayoutWidth();
  const ranking = [...income.ranking].sort((a, b) => b.value - a.value);
  const regionIndex = ranking.findIndex((entry) => entry.region === regionName);

  const barWidth = ranking.length
    ? Math.max(1, (width - BAR_GAP * (ranking.length - 1)) / ranking.length)
    : 0;
  const barLeft = regionIndex * (barWidth + BAR_GAP);
  // Keep the label inside the chart when the highlighted bar sits at either edge.
  const labelOffset = Math.min(
    Math.max((barWidth - LABEL_WIDTH) / 2, -barLeft),
    width - barLeft - LABEL_WIDTH
  );

  const data = ranking.map((entry, index) => {
    const isRegion = index === regionIndex;
    return {
      value: entry.value,
      frontColor: isRegion ? BrandColors.primary : OTHER_BAR_COLOR,
      ...(isRegion && {
        topLabelComponent: () => (
          <Text numberOfLines={1} style={styles.barLabel}>
            {regionName}
          </Text>
        ),
        topLabelContainerStyle: {
          width: LABEL_WIDTH,
          height: LABEL_HEIGHT,
          top: -LABEL_HEIGHT - 2,
          left: labelOffset,
        },
      }),
    };
  });

  const position = regionIndex >= 0 ? regionIndex + 1 : null;
  const chartSummary = position
    ? `${regionName} tem a ${position}ª maior renda entre ${ranking.length} regiões: ${currency.format(ranking[regionIndex].value)}.`
    : undefined;

  return (
    <InfoCard source={income.source} title={income.title}>
      <Text style={styles.description}>{income.description}</Text>
      <View accessibilityLabel={chartSummary} accessible onLayout={onLayout} style={styles.chart}>
        {width > 0 ? (
          <BarChart
            barWidth={barWidth}
            data={data}
            disablePress
            disableScroll
            endSpacing={0}
            height={CHART_HEIGHT}
            hideRules
            hideYAxisText
            initialSpacing={0}
            maxValue={ranking[0]?.value || 1}
            overflowTop={LABEL_HEIGHT + 4}
            spacing={BAR_GAP}
            width={width}
            xAxisThickness={0}
            yAxisLabelWidth={0}
            yAxisThickness={0}
          />
        ) : null}
      </View>
    </InfoCard>
  );
}

const styles = StyleSheet.create({
  description: {
    ...infoCardStyles.footnote,
    color: BrandColors.textPrimary,
    lineHeight: 16,
  },
  // Fixed height crops the empty x-axis label band gifted-charts reserves under the bars.
  chart: {
    height: CHART_HEIGHT + LABEL_HEIGHT + 6,
    paddingTop: LABEL_HEIGHT + 4,
    overflow: 'hidden',
  },
  barLabel: {
    color: BrandColors.primary,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
});
