import { Text, View, type ViewProps } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { WEB_CONTENT_MAX_WIDTH } from "@/lib/layout";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { cn } from "@/lib/utils";

export interface ScreenContainerProps extends ViewProps {
  /** Reading-focused screens can cap line length without duplicating a container. */
  contentMaxWidth?: number;
  /**
   * SafeArea edges to apply. Defaults to ["top", "left", "right"].
   * Bottom is typically handled by Tab Bar.
   */
  edges?: Edge[];
  /**
   * Tailwind className for the content area.
   */
  className?: string;
  /**
   * Additional className for the outer container (background layer).
   */
  containerClassName?: string;
  /**
   * Additional className for the SafeAreaView (content layer).
   */
  safeAreaClassName?: string;
}

/**
 * A container component that properly handles SafeArea and background colors.
 *
 * The outer View extends to full screen (including status bar area) with the background color,
 * while the inner SafeAreaView ensures content is within safe bounds.
 *
 * Usage:
 * ```tsx
 * <ScreenContainer className="p-4">
 *   <Text className="text-2xl font-bold text-foreground">
 *     Welcome
 *   </Text>
 * </ScreenContainer>
 * ```
 */
export function ScreenContainer({
  children,
  edges = ["top", "left", "right"],
  className,
  containerClassName,
  safeAreaClassName,
  style,
  contentMaxWidth = WEB_CONTENT_MAX_WIDTH,
  ...props
}: ScreenContainerProps) {
  const colors = useColors();
  return (
    <View
      className={cn(
        "flex-1",
        "bg-background",
        containerClassName
      )}
      style={{ minHeight: 0, minWidth: 0 }}
      {...props}
    >
      <SafeAreaView
        edges={edges}
        className={cn("flex-1", safeAreaClassName)}
        style={[{ minHeight: 0, minWidth: 0 }, style]}
      >
        <View
          className={cn("flex-1", className)}
          style={{ width: "100%", maxWidth: contentMaxWidth, alignSelf: "center", minHeight: 0, minWidth: 0 }}
        >{children}</View>
        {/* In normal flow, never over a question, scroll area, or navigation button. */}
        <View pointerEvents="none" style={{ flexShrink: 0, alignItems: "center", paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text testID="content-watermark" numberOfLines={1} style={{ color: colors.muted, fontSize: 10, lineHeight: 14, textAlign: "center" }}>
            FINETUNE · 개인 학습용 · 무단 복제·재배포 금지
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}
