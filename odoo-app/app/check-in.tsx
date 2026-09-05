import { CheckInSheet } from "@/components/check-in-sheet";
import { Button, PressFeedback, s } from "@/components/workforce";
import { corners, palette as p } from "@/constants/theme";
import { timeLabel, useAttendance } from "@/features/attendance/demo-state";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CheckIn() {
    const { checkedIn, record, entries } = useAttendance();
    const [done, setDone] = useState(false);
    const [action] = useState(checkedIn ? "Check-out" : "Check-in");
    const submitted = useRef(false);
    const insets = useSafeAreaInsets();
    const dismiss = () =>
        router.canGoBack() ? router.back() : router.replace("/");

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
                    <Feather name="x" size={20} color={p.muted} />
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
                            size={15}
                            color={done ? p.success : p.accentBorder}
                        />
                        <Text
                            style={[
                                styles.previewLabel,
                                done && { color: p.success },
                            ]}
                        >
                            {done ? "ATTENDANCE UPDATED" : "CAMERA PREVIEW"}
                        </Text>
                    </View>
                    <View style={styles.faceFrame}>
                        {!done && (
                            <>
                                <View style={[styles.corner, styles.topLeft]} />
                                <View
                                    style={[styles.corner, styles.topRight]}
                                />
                                <View
                                    style={[styles.corner, styles.bottomLeft]}
                                />
                                <View
                                    style={[styles.corner, styles.bottomRight]}
                                />
                            </>
                        )}
                        <Feather
                            name={done ? "check" : "user"}
                            size={48}
                            color={done ? p.success : p.accentBorder}
                        />
                    </View>
                    <Text
                        style={[styles.previewTitle, done && { color: p.ink }]}
                    >
                        {done ? action + " recorded" : "Your face goes here"}
                    </Text>
                    <Text
                        style={[
                            styles.previewCaption,
                            done && { color: p.muted },
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
                        {(
                            [
                                [
                                    "camera",
                                    "Camera verification",
                                    "Face verification is not connected",
                                ],
                                [
                                    "map-pin",
                                    "Office proximity",
                                    "Location access is not connected",
                                ],
                            ] as const
                        ).map(([icon, label, detail]) => (
                            <View
                                key={label}
                                style={styles.checkRow}
                            >
                                <View style={styles.checkIcon}>
                                    <Feather
                                        name={icon}
                                        size={20}
                                        color={p.muted}
                                    />
                                </View>
                                <View style={styles.checkCopy}>
                                    <Text style={styles.checkLabel}>
                                        {label}
                                    </Text>
                                    <Text style={styles.pending}>{detail}</Text>
                                </View>
                                <Feather
                                    name="minus-circle"
                                    size={17}
                                    color={p.muted}
                                />
                            </View>
                        ))}
                    </View>
                ) : (
                    <View style={styles.successNote}>
                        <Feather
                            name="check-circle"
                            size={18}
                            color={p.success}
                        />
                        <Text style={[s.body, { flex: 1 }]}>
                            You’ll find this entry in your dashboard and
                            attendance history.
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
                        done
                            ? "Back to dashboard"
                            : "Confirm demo " + action.toLowerCase()
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
                    Demo only · No face or location verified. Nothing is sent to
                    HR. Entries reset on reload.
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
    eyebrow: {
        fontSize: 10,
        fontWeight: "600",
        letterSpacing: 1.3,
        color: p.muted,
    },
    title: {
        fontSize: 26,
        fontWeight: "600",
        letterSpacing: -0.9,
        color: p.ink,
    },
    close: {
        height: 44,
        width: 44,
        ...corners(14),
        alignItems: "center",
        justifyContent: "center",
    },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 24, paddingBottom: 20 },
    intro: { fontSize: 13, lineHeight: 20, color: p.muted, marginBottom: 22 },
    preview: {
        backgroundColor: "#111827",
        ...corners(26),
        minHeight: 240,
        alignItems: "center",
        padding: 20,
        overflow: "hidden",
    },
    previewDone: { backgroundColor: p.paper },
    previewTop: {
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        alignSelf: "flex-start",
    },
    previewLabel: {
        fontSize: 10,
        fontWeight: "500",
        letterSpacing: 1,
        color: p.accentBorder,
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
        borderColor: p.accentBorder,
        borderCurve: "continuous",
    },
    topLeft: {
        top: 0,
        left: 0,
        borderLeftWidth: 2,
        borderTopWidth: 2,
        borderTopLeftRadius: 16,
    },
    topRight: {
        top: 0,
        right: 0,
        borderRightWidth: 2,
        borderTopWidth: 2,
        borderTopRightRadius: 16,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderLeftWidth: 2,
        borderBottomWidth: 2,
        borderBottomLeftRadius: 16,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderRightWidth: 2,
        borderBottomWidth: 2,
        borderBottomRightRadius: 16,
    },
    previewTitle: {
        fontSize: 16,
        fontWeight: "500",
        color: p.white,
        marginBottom: 6,
    },
    previewCaption: {
        fontSize: 12,
        lineHeight: 18,
        color: p.accentBorder,
        textAlign: "center",
    },
    checks: { marginTop: 24 },
    sectionLabel: {
        fontSize: 12,
        fontWeight: "500",
        color: p.muted,
        marginBottom: 6,
    },
    checkRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 16,
    },
    checkIcon: { width: 24, alignItems: "center" },
    checkCopy: { flex: 1, minWidth: 0, gap: 5 },
    checkLabel: { fontSize: 14, fontWeight: "500", color: p.ink },
    pending: { fontSize: 12, lineHeight: 18, color: p.muted },
    footer: {
        paddingTop: 16,
        gap: 12,
        backgroundColor: p.white,
    },
    disclaimer: {
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
