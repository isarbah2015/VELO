import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Svg, Rect } from 'react-native-svg';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CHART_HEIGHT = 80;

// Simple SVG bar chart, matching the abstract-map SVG style already used
// elsewhere in this app rather than pulling in a charting library.
export default function EarningsChart({ values, highlightIndex }: { values: number[]; highlightIndex?: number }) {
  const max = Math.max(...values, 1);
  const barWidth = 100 / values.length;

  return (
    <View>
      <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 100 ${CHART_HEIGHT}`} preserveAspectRatio="none">
        {values.map((v, i) => {
          const h = Math.max((v / max) * (CHART_HEIGHT - 6), 3);
          return (
            <Rect
              key={i}
              x={i * barWidth + barWidth * 0.2}
              y={CHART_HEIGHT - h}
              width={barWidth * 0.6}
              height={h}
              rx={2}
              fill={i === highlightIndex ? '#FFD000' : '#3F3F46'}
            />
          );
        })}
      </Svg>
      <View style={styles.labelRow}>
        {DAYS.map((d, i) => (
          <Text key={i} style={[styles.dayLabel, i === highlightIndex && styles.dayLabelActive]}>{d}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', marginTop: 8 },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: 11, color: '#52525B', fontWeight: '600' },
  dayLabelActive: { color: '#FFD000' },
});
