import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Page, PressFeedback, s, Title, TopBar } from "@/components/workforce";
import { HoursChart } from "@/components/hours-chart";
import { font, palette as p, rule } from "@/constants/theme";
import { timeLabel, useAttendance } from "@/features/attendance/demo-state";

const summary = [
  { value: "18", label: "On time", marker: "filled" },
  { value: "2", label: "Late arrivals", marker: "hollow" },
  { value: "1", label: "Absent", marker: "faint" },
] as const;

export default function Dashboard() {
  const { checkedIn, entries } = useAttendance();
  const lastEntry = entries[0];
  return (
    <Page header={<TopBar />}>
      <Title
        title="Your workday"
        subtitle={new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      />
      <View style={[s.card, styles.today]} accessibilityLiveRegion="polite">
        <View style={[styles.todayIcon, checkedIn && styles.todayIconActive]}>
          <Feather
            name={checkedIn ? "check" : lastEntry ? "moon" : "sun"}
            size={20}
            color={checkedIn ? p.white : p.ink}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.todayTitle}>
            {checkedIn
              ? "You’re checked in"
              : lastEntry
                ? "That’s a wrap"
                : "Ready when you are"}
          </Text>
          <Text style={s.caption}>
            {lastEntry
              ? lastEntry.kind + " at " + timeLabel(lastEntry.at)
              : "Check in to start your day."}
          </Text>
        </View>
      </View>

      <View style={[s.section, { marginTop: 28 }]}>
        <Text style={s.sectionTitle}>August overview</Text>
      </View>
      <View style={s.row}>
        <View style={[s.card, styles.stat]}>
          <View style={styles.statTop}>
            <Text style={styles.statLabel}>Days present</Text>
            <Feather name="calendar" color={p.ink} size={15} />
          </View>
          <Text style={styles.statValue}>
            20<Text style={styles.statUnit}> / 21</Text>
          </Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: "95.2%" }]} />
          </View>
          <Text style={styles.statNote}>95.2% attendance</Text>
        </View>
        <View style={[s.card, styles.stat]}>
          <View style={styles.statTop}>
            <Text style={styles.statLabel}>Daily average</Text>
            <Feather name="clock" color={p.ink} size={15} />
          </View>
          <Text style={styles.statValue}>
            7.9<Text style={styles.statUnit}> hrs</Text>
          </Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: "98.75%" }]} />
          </View>
          <Text style={styles.statNote}>of an 8h daily target</Text>
        </View>
      </View>

      <HoursChart />
      <View style={[s.card, styles.summary]}>
        {summary.map(({ value, label, marker }, index) => (
          <View
            key={label}
            style={[styles.summaryCell, index > 0 && styles.summaryDivider]}
          >
            <Text style={styles.summaryValue}>{value}</Text>
            <View style={styles.summaryLabelRow}>
              <View style={[styles.marker, markers[marker]]} />
              <Text style={styles.summaryLabel}>{label}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={[s.section, { marginTop: 24, marginBottom: 8 }]}>
        <Text style={s.sectionTitle}>Recent activity</Text>
        <PressFeedback
          accessibilityRole="button"
          accessibilityLabel="View attendance history"
          onPress={() => router.navigate("/attendance")}
          style={styles.link}
        >
          <Text style={styles.linkText}>View all</Text>
          <Feather name="arrow-right" size={14} color={p.ink} />
        </PressFeedback>
      </View>
      <View style={[s.card, styles.activity]}>
        <View style={styles.activityIcon}>
          <Feather
            name={checkedIn ? "log-in" : "log-out"}
            size={16}
            color={p.ink}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.activityTitle}>
            {lastEntry?.kind ?? "Check-out"}
          </Text>
          <Text style={s.caption}>
            {lastEntry ? "This session · Demo" : "28 Aug · Sample record"}
          </Text>
        </View>
        <Text style={styles.activityTime}>
          {lastEntry ? timeLabel(lastEntry.at) : "06:10 PM"}
        </Text>
      </View>
      <Text style={styles.note}>
        Historical stats are sample data. Demo check-ins only update this
        session.
      </Text>
    </Page>
  );
}
const markers = StyleSheet.create({
  filled: { backgroundColor: p.ink },
  hollow: { backgroundColor: p.white },
  faint: { backgroundColor: p.faint, borderColor: p.faint },
});
const styles = StyleSheet.create({
  today: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
  todayIcon: {
    height: 42,
    width: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: rule.thick,
    borderColor: p.ink,
    backgroundColor: p.white,
  },
  todayIconActive: { backgroundColor: p.ink },
  todayTitle: { ...font.bold, fontSize: 15, lineHeight: 20, color: p.ink },
  stat: { flex: 1, minWidth: 0, padding: 16 },
  statTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 5,
    marginBottom: 16,
  },
  statLabel: {
    ...font.bold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: p.muted,
    flexShrink: 1,
  },
  statValue: {
    ...font.bold,
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -1.4,
    color: p.ink,
    fontVariant: ["tabular-nums"],
  },
  statUnit: { ...font.regular, fontSize: 15, letterSpacing: 0, color: p.muted },
  // A boxed track with a solid black fill instead of a tinted bar.
  track: {
    height: 10,
    borderWidth: rule.thick,
    borderColor: p.ink,
    backgroundColor: p.white,
    marginTop: 16,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: p.ink },
  statNote: {
    ...font.regular,
    fontSize: 11,
    lineHeight: 16,
    color: p.muted,
    marginTop: 10,
  },
  summary: { flexDirection: "row", padding: 0, marginTop: 16 },
  summaryCell: { flex: 1, alignItems: "center", gap: 8, paddingVertical: 18 },
  summaryDivider: { borderLeftWidth: rule.thick, borderLeftColor: p.ink },
  summaryValue: {
    ...font.bold,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.6,
    color: p.ink,
    fontVariant: ["tabular-nums"],
  },
  summaryLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  marker: {
    width: 8,
    height: 8,
    borderWidth: rule.thin,
    borderColor: p.ink,
  },
  summaryLabel: { ...font.medium, fontSize: 11, color: p.muted },
  link: {
    minHeight: 44,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    paddingLeft: 12,
  },
  linkText: {
    ...font.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: p.ink,
  },
  activity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
  },
  activityIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: rule.thick,
    borderColor: p.ink,
  },
  activityTitle: { ...font.semibold, fontSize: 14, lineHeight: 20, color: p.ink },
  activityTime: {
    ...font.medium,
    fontSize: 12,
    color: p.ink,
    fontVariant: ["tabular-nums"],
  },
  note: {
    ...font.regular,
    fontSize: 12,
    lineHeight: 19,
    color: p.muted,
    marginTop: 18,
    paddingHorizontal: 4,
  },
});
