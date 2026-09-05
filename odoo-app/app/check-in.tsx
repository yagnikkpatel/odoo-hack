import { CheckInSheet } from "@/components/check-in-sheet";
import { Button, PressFeedback, s } from "@/components/workforce";
import { font, palette as p, rule } from "@/constants/theme";
import { timeLabel, useAttendance } from "@/features/attendance/demo-state";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const checks = [
  ["camera", "Camera verification", "Face verification is not connected"],
  ["map-pin", "Office proximity", "Location access is not connected"],
] as const;

export default function CheckIn() {
  const { checkedIn, record, entries } = useAttendance();
  const [done, setDone] = useState(false);
  const [action] = useState(checkedIn ? "Check-out" : "Check-in");
  const submitted = useRef(false);
  const insets = useSafeAreaInsets();
  const dismiss = () =>
    router.canGoBack() ? router.back() : router.replace("/");
  // The preview inverts once the entry is recorded: black while waiting on
  // the camera, white with a black rule when done.
  const previewInk = done ? p.ink : p.white;

  return (
    <CheckInSheet onDismiss={dismiss}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.title}>
            {done
              ? "You’re all set"
              : action === "Check-in"
                ? "Let’s check you in"
                : "Let’s wrap up"}
          </Text>
        </View>
        <PressFeedback
          accessibilityRole="button"
          accessibilityLabel="Close check-in"
          onPress={dismiss}
          style={styles.close}
        >
          <Feather name="x" size={20} color={p.ink} />
        </PressFeedback>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
      >
        <Text style={styles.intro}>
          {done
            ? "Your demo attendance has been updated."
            : "A quick face and location check, and you’re ready."}
        </Text>
        <View
          style={[styles.preview, done && styles.previewDone]}
          accessibilityLiveRegion="polite"
        >
          <View style={styles.previewTop}>
            <Feather
              name={done ? "check-circle" : "camera"}
              size={14}
              color={previewInk}
            />
            <Text style={[styles.previewLabel, { color: previewInk }]}>
              {done ? "Attendance updated" : "Camera preview"}
            </Text>
          </View>
          <View style={styles.faceFrame}>
            {!done && (
              <>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </>
            )}
            <Feather
              name={done ? "check" : "user"}
              size={48}
              color={previewInk}
            />
          </View>
          <Text style={[styles.previewTitle, { color: previewInk }]}>
            {done ? action + " recorded" : "Your face goes here"}
          </Text>
          <Text
            style={[
              styles.previewCaption,
              { color: done ? p.muted : p.white },
            ]}
          >
            {done && entries[0]
              ? timeLabel(entries[0].at) + " · This session only"
              : "Camera isn’t connected yet"}
          </Text>
        </View>

        {!done ? (
          <View style={styles.checks}>
            <Text style={styles.sectionLabel}>
              Before you {action.toLowerCase()}
            </Text>
            {checks.map(([icon, label, detail], index) => (
              <View
                key={label}
                style={[styles.checkRow, index > 0 && s.rowDivider]}
              >
                <View style={styles.checkIcon}>
                  <Feather name={icon} size={18} color={p.ink} />
                </View>
                <View style={styles.checkCopy}>
                  <Text style={styles.checkLabel}>{label}</Text>
                  <Text style={styles.pending}>{detail}</Text>
                </View>
                <Feather name="minus-circle" size={17} color={p.muted} />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.successNote}>
            <Feather name="check-circle" size={18} color={p.ink} />
            <Text style={[s.body, { flex: 1 }]}>
              You’ll find this entry in your dashboard and attendance history.
            </Text>
          </View>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 16),
            paddingLeft: 24 + insets.left,
            paddingRight: 24 + insets.right,
          },
        ]}
      >
        <Button
          label={
            done ? "Back to dashboard" : "Confirm demo " + action.toLowerCase()
          }
          icon={done ? "arrow-right" : "check"}
          onPress={() => {
            if (done) router.dismissTo("/");
            else if (!submitted.current) {
              submitted.current = true;
              record();
              setDone(true);
              if (Platform.OS !== "web")
                void Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                ).catch(() => {});
            }
          }}
        />
        <Text style={styles.disclaimer}>
          Demo only · No face or location verified. Nothing is sent to HR.
          Entries reset on reload.
        </Text>
      </View>
    </CheckInSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 12,
  },
  heading: { flex: 1, gap: 6 },
  title: {
    ...font.bold,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.6,
    color: p.ink,
  },
  close: {
    height: 44,
    width: 44,
    borderWidth: rule.thick,
    borderColor: p.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 20 },
  intro: {
    ...font.regular,
    fontSize: 13,
    lineHeight: 20,
    color: p.muted,
    marginBottom: 22,
  },
  preview: {
    backgroundColor: p.ink,
    borderWidth: rule.thick,
    borderColor: p.ink,
    minHeight: 240,
    alignItems: "center",
    padding: 20,
    overflow: "hidden",
  },
  previewDone: { backgroundColor: p.white },
  previewTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
  },
  previewLabel: {
    ...font.bold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  faceFrame: {
    width: 116,
    height: 106,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 17,
  },
  corner: {
    position: "absolute",
    width: 24,
    height: 24,
    borderColor: p.white,
  },
  topLeft: { top: 0, left: 0, borderLeftWidth: 2, borderTopWidth: 2 },
  topRight: { top: 0, right: 0, borderRightWidth: 2, borderTopWidth: 2 },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderRightWidth: 2,
    borderBottomWidth: 2,
  },
  previewTitle: {
    ...font.semibold,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 6,
  },
  previewCaption: {
    ...font.regular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  checks: { marginTop: 24 },
  sectionLabel: {
    ...font.bold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: p.ink,
    marginBottom: 4,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
  },
  checkIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: rule.thick,
    borderColor: p.ink,
  },
  checkCopy: { flex: 1, minWidth: 0, gap: 4 },
  checkLabel: { ...font.semibold, fontSize: 14, lineHeight: 20, color: p.ink },
  pending: { ...font.regular, fontSize: 12, lineHeight: 18, color: p.muted },
  footer: {
    paddingTop: 16,
    gap: 12,
    borderTopWidth: rule.thick,
    borderTopColor: p.ink,
    backgroundColor: p.white,
  },
  disclaimer: {
    ...font.regular,
    fontSize: 11,
    lineHeight: 17,
    color: p.muted,
    textAlign: "center",
  },
  successNote: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginTop: 24,
  },
});
