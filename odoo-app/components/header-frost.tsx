import MaskedView from "@react-native-masked-view/masked-view";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { type ComponentProps, type RefObject } from "react";
import { StyleSheet, type View } from "react-native";
import Animated from "react-native-reanimated";

export function HeaderFrost({
  target,
  style,
}: {
  target: RefObject<View | null>;
  style: ComponentProps<typeof Animated.View>["style"];
}) {
  return (
    <Animated.View style={[styles.layer, style]}>
      <MaskedView
        style={styles.fill}
        maskElement={
          <LinearGradient
            colors={["#000000", "#000000", "#00000000"]}
            locations={[0, 0.4, 1]}
            style={styles.fill}
          />
        }
      >
        <BlurView
          blurTarget={target}
          blurMethod="dimezisBlurViewSdk31Plus"
          intensity={70}
          tint="light"
          style={styles.fill}
        />
      </MaskedView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: -48,
    pointerEvents: "none",
  },
  fill: { flex: 1 },
});
