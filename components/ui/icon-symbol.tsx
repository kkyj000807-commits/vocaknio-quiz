// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  "chart.bar.fill": "bar-chart",
  "bookmark.fill": "bookmark",
  "bookmark": "bookmark-border",
  "checkmark.circle.fill": "check-circle",
  "xmark.circle.fill": "cancel",
  "arrow.clockwise": "refresh",
  "arrow.left": "arrow-back",
  "star.fill": "star",
  "flame.fill": "local-fire-department",
  "trophy.fill": "emoji-events",
  "book.fill": "menu-book",
  "pencil": "edit",
  "xmark": "close",
  "checkmark": "check",
  "play.fill": "play-arrow",
  "eye.fill": "visibility",
  "eye.slash.fill": "visibility-off",
  "lightbulb.fill": "lightbulb",
  "gear": "settings",
  "square.and.arrow.up": "share",
  "person.fill": "person",
  "person.crop.circle": "account-circle",
  "icloud.and.arrow.up": "cloud-upload",
  "icloud.and.arrow.down": "cloud-download",
  "icloud.fill": "cloud",
  "moon.fill": "dark-mode",
  "sun.max.fill": "light-mode",
  "circle.lefthalf.filled": "contrast",
  "arrow.triangle.2.circlepath": "sync",
  "text.book.closed.fill": "import-contacts",
  "list.bullet": "format-list-bulleted",
  "graduationcap.fill": "school",
  "doc.text.fill": "description",
  "calendar": "event",
  "plus": "add",
  "trash.fill": "delete",
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
