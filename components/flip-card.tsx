import React, { useEffect } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";

interface FlipCardProps {
  flipped: boolean;
  front: React.ReactNode;
  back: React.ReactNode;
  style?: ViewStyle;
  duration?: number;
}

/**
 * 3D 카드 뒤집기 컴포넌트
 * - flipped=false: 앞면(front) 표시
 * - flipped=true:  뒷면(back) 표시
 * - Y축 회전으로 자연스러운 카드 뒤집기 효과
 */
export function FlipCard({
  flipped,
  front,
  back,
  style,
  duration = 420,
}: FlipCardProps) {
  const rotate = useSharedValue(0); // 0 = 앞면, 1 = 뒷면

  useEffect(() => {
    rotate.value = withTiming(flipped ? 1 : 0, { duration });
  }, [flipped, duration]);

  // 앞면: 0→90도 회전 (사라짐)
  const frontStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(
      rotate.value,
      [0, 0.5, 1],
      [0, 90, 90],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      rotate.value,
      [0, 0.45, 0.5],
      [1, 1, 0],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotateY}deg` }],
      opacity,
      backfaceVisibility: "hidden",
    };
  });

  // 뒷면: 90→0도 회전 (나타남), 초기 90도 오프셋
  const backStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(
      rotate.value,
      [0, 0.5, 1],
      [-90, -90, 0],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      rotate.value,
      [0.5, 0.55, 1],
      [0, 1, 1],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotateY}deg` }],
      opacity,
      backfaceVisibility: "hidden",
    };
  });

  return (
    <View style={[styles.container, style]}>
      {/* 앞면 */}
      <Animated.View style={[StyleSheet.absoluteFill, frontStyle]}>
        {front}
      </Animated.View>
      {/* 뒷면 */}
      <Animated.View style={[StyleSheet.absoluteFill, backStyle]}>
        {back}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
});
