import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { corners, palette } from "@/constants/theme";

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
    ...corners(32),
    overflow: "hidden",
  },
});
