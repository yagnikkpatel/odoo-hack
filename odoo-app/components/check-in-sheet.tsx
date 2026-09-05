import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { palette, rule } from "@/constants/theme";

// Native navigation owns the animation, drag gestures and backdrop.
export function CheckInSheet({
  children,
}: PropsWithChildren<{ onDismiss: () => void }>) {
  return <View style={styles.sheet}>{children}</View>;
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: palette.white,
    borderTopWidth: rule.thick,
    borderTopColor: palette.ink,
    overflow: "hidden",
  },
});
