import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Rect, Circle, Path } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Stylized dark city-grid map used as a full-screen background (matches the
// Replit reference): a block/road grid, the rider's current location as a
// glowing blue dot with a pulsing accuracy ring, yellow dots for nearby
// riders, and — in route mode — a dashed line to a red destination pin.
// Pure react-native-svg so it renders identically on web and native with no
// native map module required.
export default function CityMap({
  width,
  height,
  showRoute = true,
  nearby = DEFAULT_NEARBY,
}: {
  width: number;
  height: number;
  showRoute?: boolean;
  nearby?: [number, number][];
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 2600, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const bw = width / 5;
  const bh = height / 9;
  const rw = 13;

  // POIs sit in the upper portion of the screen so they stay visible above
  // the bottom sheet that covers the lower ~half on the rider home.
  const meX = width * 0.46;
  const meY = height * 0.34;
  const destX = width * 0.8;
  const destY = height * 0.16;

  const ringMax = Math.min(width, height) * 0.22;
  const ringR = pulse.interpolate({ inputRange: [0, 1], outputRange: [18, ringMax] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.35, 0.08, 0] });

  return (
    <View style={[styles.wrap, { width, height }]}>
      <Svg width={width} height={height}>
        <Rect fill="#0C0D10" width={width} height={height} />

        {/* city blocks */}
        {Array.from({ length: 5 }).map((_, col) =>
          Array.from({ length: 9 }).map((_, row) => (
            <Rect
              key={`b-${col}-${row}`}
              x={col * bw + rw / 2}
              y={row * bh + rw / 2}
              width={bw - rw}
              height={bh - rw}
              fill="#141419"
              rx={4}
            />
          ))
        )}
        {/* roads */}
        {Array.from({ length: 10 }).map((_, i) => (
          <Rect key={`hr-${i}`} x={0} y={i * bh - rw / 2} width={width} height={rw} fill="#1A1B22" />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <Rect key={`vr-${i}`} x={i * bw - rw / 2} y={0} width={rw} height={height} fill="#1A1B22" />
        ))}

        {/* nearby riders */}
        {nearby.map(([fx, fy], i) => (
          <React.Fragment key={i}>
            <Circle cx={width * fx} cy={height * fy} r={14} fill="#FFD000" opacity={0.14} />
            <Circle cx={width * fx} cy={height * fy} r={6} fill="#FFD000" />
            <Circle cx={width * fx} cy={height * fy} r={2.5} fill="#0C0D10" />
          </React.Fragment>
        ))}

        {showRoute && (
          <>
            <Path
              d={`M ${meX} ${meY} L ${destX * 0.78} ${meY} L ${destX} ${destY}`}
              stroke="#FFD000"
              strokeWidth={3}
              strokeDasharray="2 9"
              fill="none"
              strokeLinecap="round"
            />
            <Circle cx={destX} cy={destY} r={13} fill="#EF4444" opacity={0.2} />
            <Circle cx={destX} cy={destY} r={8} fill="#EF4444" />
            <Circle cx={destX} cy={destY} r={3} fill="#FFFFFF" />
          </>
        )}

        {/* current location — pulsing accuracy ring + blue dot */}
        <AnimatedCircle cx={meX} cy={meY} r={ringR} fill="#4DB8FF" opacity={ringOpacity} />
        <Circle cx={meX} cy={meY} r={16} fill="#4DB8FF" opacity={0.25} />
        <Circle cx={meX} cy={meY} r={9} fill="#4DB8FF" />
        <Circle cx={meX} cy={meY} r={9} fill="none" stroke="#FFFFFF" strokeWidth={2.5} />
      </Svg>
    </View>
  );
}

const DEFAULT_NEARBY: [number, number][] = [
  [0.24, 0.24],
  [0.7, 0.3],
  [0.16, 0.4],
  [0.8, 0.42],
  [0.5, 0.44],
  [0.62, 0.12],
];

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#0C0D10' },
});
