import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Page, PressFeedback, s, Title, TopBar } from "@/components/workforce";
import { HoursChart } from "@/components/hours-chart";
import { corners, palette as p } from "@/constants/theme";
import { timeLabel, useAttendance } from "@/features/attendance/demo-state";

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
        <View style={styles.todayIcon}>
          <Feather
            name={checkedIn ? "check" : lastEntry ? "moon" : "sun"}
            size={21}
            color={checkedIn ? p.success : p.accent}
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
            <Feather name="calendar" color={p.muted} size={15} />
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
            <Feather name="clock" color={p.muted} size={15} />
          </View>
          <Text style={styles.statValue}>
            7.9<Text style={styles.statUnit}> hrs</Text>
          </Text>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: "98.75%", backgroundColor: p.accentStrong },
              ]}
            />
          </View>
          <Text style={styles.statNote}>of an 8h daily target</Text>
        </View>
      </View>

      <HoursChart />
      <View style={[s.card, styles.summary]}>
        {[
          ["18", "On time", p.success],
          ["2", "Late arrivals", p.warning],
          ["1", "Absent", p.muted],
        ].map(([value, label, color]) => (
          <View key={label} style={styles.summaryCell}>
            <Text style={styles.summaryValue}>{value}</Text>
            <View style={styles.summaryLabelRow}>
              <View style={[styles.dot, { backgroundColor: color }]} />
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
          <Feather name="arrow-right" size={14} color={p.accentStrong} />
        </PressFeedback>
      </View>
      <View style={[s.card, styles.activity]}>
        <View style={styles.activityIcon}>
          <Feather
            name={checkedIn ? "log-in" : "log-out"}
            size={17}
            color={p.muted}
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
const styles = StyleSheet.create({
  today: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  todayIcon: {
    height: 42,
    width: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  todayTitle: {
    fontSize: 14,
    color: p.ink,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  stat: { flex: 1, minWidth: 0, padding: 16 },
  statTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 5,
    marginBottom: 16,
  },
  statLabel: { fontSize: 12, fontWeight: "500", color: p.muted, flexShrink: 1 },
  statValue: {
    fontSize: 38,
    fontWeight: "600",
    letterSpacing: -1.8,
    color: p.ink,
    fontVariant: ["tabular-nums"],
  },
  statUnit: {
    fontSize: 15,
    fontWeight: "400",
    letterSpacing: -0.3,
    color: p.muted,
  },
  track: {
    height: 4,
    backgroundColor: p.soft,
    ...corners(2),
    marginTop: 16,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: p.accent, ...corners(2) },
  statNote: { fontSize: 11, lineHeight: 16, color: p.muted, marginTop: 10 },
  summary: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 20,
    marginTop: 16,
  },
  summaryCell: { flex: 1, alignItems: "center", gap: 9 },
  summaryValue: {
    fontSize: 25,
    fontWeight: "600",
    letterSpacing: -0.7,
    color: p.ink,
  },
  summaryLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  summaryLabel: { fontSize: 11, color: p.muted },
  link: {
    minHeight: 44,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    paddingLeft: 12,
  },
  linkText: { fontSize: 12, color: p.accentStrong, fontWeight: "500" },
  activity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  activityIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  activityTitle: { fontSize: 14, fontWeight: "500", color: p.ink },
  activityTime: { fontSize: 12, color: p.ink, fontVariant: ["tabular-nums"] },
  note: {
    fontSize: 12,
    lineHeight: 19,
    color: p.muted,
    marginTop: 18,
    paddingHorizontal: 4,
  },
});
