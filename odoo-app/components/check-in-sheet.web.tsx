import type { PropsWithChildren } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  SlideInDown,
  useReducedMotion,
} from "react-native-reanimated";
import { corners, palette } from "@/constants/theme";

export function CheckInSheet({
  children,
  onDismiss,
}: PropsWithChildren<{ onDismiss: () => void }>) {
  const { height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  return (
    <Modal transparent animationType="none" visible onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Animated.View
          entering={reducedMotion ? undefined : FadeIn.duration(180)}
          style={styles.backdrop}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss check-in"
            onPress={onDismiss}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View
          entering={
            reducedMotion
              ? undefined
              : SlideInDown.duration(320).easing(Easing.bezier(0.22, 1, 0.36, 1))
          }
          style={[styles.sheet, { height: Math.min(760, height - 24) }]}
          accessibilityViewIsModal
        >
          <View style={styles.handle} />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", alignItems: "center" },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(17, 24, 39, 0.38)",
  },
  sheet: {
    width: "100%",
    maxWidth: 560,
    backgroundColor: palette.white,
    ...corners(32),
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: "hidden",
    boxShadow: "0 -8px 48px rgba(17, 24, 39, 0.12)",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.line,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 2,
  },
});
