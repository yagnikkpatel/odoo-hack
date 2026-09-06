import { Feather } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from "react-native";
import { font } from "@/constants/theme";

export type CaptureResult = { status: "success" | "error"; label: string };

/** Feedback sits over the captured photo, never blocks controls, and is only
 * green after the server accepts the face. Persistent details live below it. */
export function CaptureFeedback({ result }: { result: CaptureResult | null }) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) setReduceMotion(value);
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    opacity.setValue(0);
    if (!result) return;
    AccessibilityInfo.announceForAccessibility(result.label);
    const animation = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: reduceMotion ? 0 : 180, useNativeDriver: true }),
      Animated.delay(1200),
      Animated.timing(opacity, { toValue: 0, duration: reduceMotion ? 0 : 500, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [opacity, reduceMotion, result]);
  if (!result) return null;
  const success = result.status === "success";
  return <Animated.View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={[styles.overlay, { opacity, backgroundColor: success ? "rgba(13, 118, 73, 0.72)" : "rgba(175, 35, 46, 0.72)" }]}>
    <View style={styles.symbol}><Feather name={success ? "check" : "x"} size={48} color="#fff" /></View>
    <Text style={styles.label}>{result.label}</Text>
  </Animated.View>;
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  symbol: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.15)" },
  label: { ...font.semibold, color: "#fff", fontSize: 18, textAlign: "center" },
});
