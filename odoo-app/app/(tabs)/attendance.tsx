import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  Badge,
  Page,
  s,
  SegmentControl,
  Title,
  TopBar,
} from "@/components/workforce";
import { font, palette as p, rule } from "@/constants/theme";
import {
  sampleDays,
  timeLabel,
  useAttendance,
} from "@/features/attendance/demo-state";

const filters = ["All", "On time", "Late"] as const;

export default function Attendance() {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const { entries } = useAttendance();
  const days = sampleDays.filter(
    (day) => filter === "All" || filter === day.status,
  );

  return (
    <Page header={<TopBar />}>
      <Title
        title="Attendance"
        subtitle="Your working days, all in one place."
      />
      <View style={[s.card, styles.today]}>
        <View style={[s.section, styles.todayHeading]}>
          <Text style={s.sectionTitle}>Today</Text>
        </View>
        {entries.length ? (
          entries.map((entry, i) => (
            <View
              key={`${entry.at.getTime()}-${i}`}
              style={[styles.sessionRow, i > 0 && s.rowDivider]}
            >
              <View
                style={[
                  styles.eventIcon,
                  entry.kind === "Check-in" && styles.eventIconActive,
                ]}
              >
                <Feather
                  name={entry.kind === "Check-in" ? "log-in" : "log-out"}
                  size={16}
                  color={entry.kind === "Check-in" ? p.white : p.ink}
                />
              </View>
              <Text style={styles.eventTitle}>{entry.kind}</Text>
              <Text style={styles.time}>{timeLabel(entry.at)}</Text>
            </View>
          ))
        ) : (
          <View style={styles.emptySession}>
            <View style={styles.eventIcon}>
              <Feather name="clock" size={17} color={p.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eventTitle}>Your day starts here</Text>
              <Text style={styles.secondary}>
                Check in to add your first demo entry.
              </Text>
            </View>
          </View>
        )}
      </View>
      <View style={[s.section, styles.historyHeading]}>
        <Text style={s.sectionTitle}>August 2026</Text>
      </View>
      <SegmentControl options={filters} value={filter} onChange={setFilter} />
      <View style={[s.card, styles.recordGroup]}>
        {days.map((day, index) => (
          <View
            key={day.day}
            style={[styles.record, index > 0 && s.rowDivider]}
          >
            <View style={styles.recordHeading}>
              <Text style={styles.day}>{day.day}</Text>
              <Badge tone={day.status === "Late" ? "warning" : "success"}>
                {day.status}
              </Badge>
            </View>
            <View style={styles.recordDetails}>
              <View style={styles.timeRange}>
                <Feather name="clock" size={13} color={p.muted} />
                <Text style={styles.secondary}>
                  {day.start} – {day.end}
                </Text>
              </View>
              <Text style={styles.duration}>{day.hours}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.note}>
        <Feather
          name="info"
          size={14}
          color={p.muted}
          style={{ marginTop: 2 }}
        />
        <Text style={[styles.secondary, { flex: 1 }]}>
          These are sample records. Today’s demo entries stay in this session
          and reset when you reload.
        </Text>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  today: { marginTop: 2, paddingVertical: 16 },
  todayHeading: { marginBottom: 4 },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  eventIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: rule.thick,
    borderColor: p.ink,
    backgroundColor: p.white,
  },
  eventIconActive: { backgroundColor: p.ink },
  eventTitle: {
    ...font.bold,
    fontSize: 14,
    lineHeight: 20,
    color: p.ink,
    flexShrink: 1,
  },
  time: {
    ...font.medium,
    marginLeft: "auto",
    fontSize: 13,
    color: p.ink,
    fontVariant: ["tabular-nums"],
  },
  emptySession: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 16,
    paddingBottom: 3,
  },
  secondary: { ...font.regular, fontSize: 12, lineHeight: 19, color: p.muted },
  historyHeading: { marginTop: 30, marginBottom: 16 },
  recordGroup: { marginTop: 16, paddingVertical: 0 },
  record: { paddingVertical: 18, gap: 12 },
  recordHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  day: { ...font.bold, fontSize: 15, lineHeight: 20, color: p.ink },
  recordDetails: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  timeRange: { flexDirection: "row", alignItems: "center", gap: 6 },
  duration: {
    ...font.semibold,
    fontSize: 13,
    color: p.ink,
    fontVariant: ["tabular-nums"],
  },
  note: { flexDirection: "row", gap: 8, marginTop: 18, paddingHorizontal: 3 },
});
