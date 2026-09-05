import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, PressFeedback } from "./workforce";
import { font, palette as p, rule } from "@/constants/theme";
import type { ComponentProps, PropsWithChildren } from "react";
export type CheckState = "active" | "pending" | "done" | "failed";
export function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return <View style={sheet.header}><Text style={sheet.title}>{title}</Text><PressFeedback accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={sheet.close}><Feather name="x" size={22} color={p.ink} /></PressFeedback></View>;
}
export function CaptureBox({ children, title, caption, label, done }: PropsWithChildren<{ title: string; caption: string; label: string; done?: boolean }>) {
  return <View style={sheet.box}><View style={[sheet.camera, done && { backgroundColor: p.soft }]}>{children}</View><View style={sheet.boxText}><Text style={sheet.sectionLabel}>{label}</Text><Text style={sheet.boxTitle}>{title}</Text><Text style={sheet.detail}>{caption}</Text></View></View>;
}
export function CheckRow({ icon, label, state, detail, actionLabel, onAction, divider }: { icon: ComponentProps<typeof Feather>["name"]; label: string; state: CheckState; detail: string; actionLabel?: string; onAction?: () => void; divider?: boolean }) {
  return <View style={[sheet.checkRow, divider && { borderTopWidth: rule.thin, borderTopColor: p.ink }]}>
    <View style={sheet.checkIcon}><Feather name={state === "done" ? "check" : icon} size={19} color={p.ink} /></View>
    <View style={sheet.checkText}><Text style={sheet.checkTitle}>{label}</Text><Text style={sheet.detail}>{detail}</Text></View>
    {actionLabel && onAction && <PressFeedback onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel} style={sheet.close}><Text style={sheet.action}>{actionLabel}</Text></PressFeedback>}
  </View>;
}
export function SheetFooter({ note, ...props }: ComponentProps<typeof Button> & { note: string }) {
  const insets = useSafeAreaInsets();
  return <View style={[sheet.footer, { paddingBottom: Math.max(insets.bottom, 16), paddingLeft: 24 + insets.left, paddingRight: 24 + insets.right }]}><Button {...props} /><Text style={sheet.note}>{note}</Text></View>;
}
export const sheet = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingTop: 18, paddingBottom: 12, gap: 12 },
  title: { ...font.bold, flex: 1, fontSize: 24, color: p.ink }, close: { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center" },
  scroll: { flex: 1 }, content: { paddingHorizontal: 24, paddingBottom: 20 }, intro: { ...font.regular, fontSize: 14, lineHeight: 21, color: p.muted, marginBottom: 20 },
  box: { borderWidth: rule.thick, borderColor: p.ink }, camera: { height: 260, backgroundColor: p.ink, overflow: "hidden" }, boxText: { padding: 18, gap: 6 },
  boxTitle: { ...font.bold, fontSize: 20, color: p.ink }, sectionLabel: { ...font.bold, textTransform: "uppercase", fontSize: 12, letterSpacing: 1, color: p.ink },
  checks: { marginTop: 24, gap: 10 }, checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 14 },
  checkIcon: { width: 42, height: 42, borderWidth: rule.thick, borderColor: p.ink, alignItems: "center", justifyContent: "center" }, checkText: { flex: 1, gap: 5 }, checkTitle: { ...font.semibold, fontSize: 15, color: p.ink },
  detail: { ...font.regular, fontSize: 13, lineHeight: 19, color: p.muted }, action: { ...font.bold, color: p.accent },
  footer: { paddingTop: 14, gap: 10, backgroundColor: p.white }, note: { ...font.regular, fontSize: 11, lineHeight: 16, textAlign: "center", color: p.muted }, notice: { marginTop: 18 },
});
