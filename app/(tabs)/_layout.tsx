import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { getTabMetrics } from "@/lib/layout";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const metrics = getTabMetrics(Platform.OS === "web", insets.bottom);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.dim,
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarButton: HapticTab,
        tabBarLabelPosition: Platform.OS === "web" ? "below-icon" : undefined,
        tabBarStyle: {
          paddingTop: metrics.paddingTop,
          paddingBottom: metrics.paddingBottom,
          height: metrics.height,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
        tabBarLabelStyle: {
          fontSize: metrics.labelSize,
          fontWeight: "600",
          marginTop: metrics.labelMarginTop,
        },
        tabBarItemStyle: {
          minHeight: metrics.minTouchHeight,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "문풀",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={metrics.iconSize} name="book.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="wordbook"
        options={{
          title: "단어장",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={metrics.iconSize} name="text.book.closed.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="wrong"
        options={{
          title: "오답",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={metrics.iconSize} name="xmark.circle.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "통계",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={metrics.iconSize} name="chart.bar.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "설정",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={metrics.iconSize} name="gear" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookmarks"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="exam"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
