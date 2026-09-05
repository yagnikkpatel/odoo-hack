import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  Badge,
  Notice,
  Page,
  s,
  SegmentControl,
  Title,
  TopBar,
} from "@/components/workforce";
import { font, palette as p, rule } from "@/constants/theme";
import { useAttendance } from "@/features/attendance/store";
import {
  dayLabel,
  hoursLabel,
  monthLabel,
  monthStart,
  STATUS_LABELS,
  timeLabel,
  TIMEZONE_LABEL,
  type AttendanceStatus,
} from "@/features/attendance/types";

const filters = ["All", "Present", "Incomplete", "Absent"] as const;
const filterStatus: Record<(typeof filters)[number], AttendanceStatus | null> = {
  All: null,
  Present: "present",
  Incomplete: "incomplete",
  Absent: "absent",
};
const tones = { present: "success", incomplete: "warning", absent: "neutral" } as const;

export default function Attendance() {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const { today, todayDate, records, loading, refreshing, error, refresh } =
    useAttendance();
  const wanted = filterStatus[filter];
  const month = records.filter(
    (record) =>
      record.attendanceDate >= monthStart(todayDate) &&
      (wanted === null || record.status === wanted),
  );
  const session = today
    ? [
        today.checkIn ? { kind: "Check-in", at: today.checkIn } : null,
        today.checkOut ? { kind: "Check-out", at: today.checkOut } : null,
      ].filter((entry): entry is { kind: string; at: string } => entry !== null)
    : [];

  return (
    <Page header={<TopBar />} refreshing={refreshing} onRefresh={refresh}>
      <Title
        title="Attendance"
        subtitle="Your working days, all in one place."
      />
      {error ? (
        <View style={styles.notice}>
          <Notice actionLabel="Retry" onAction={refresh}>
            {error}
          </Notice>
        </View>
      ) : null}
      <View style={[s.card, styles.today]}>
        <View style={[s.section, styles.todayHeading]}>
          <Text style={s.sectionTitle}>Today</Text>
          {today ? <Badge tone={tones[today.status]}>{STATUS_LABELS[today.status]}</Badge> : null}
        </View>
        {session.length ? (
          session.map((entry, index) => (
            <View
              key={entry.kind}
              style={[styles.sessionRow, index > 0 && s.rowDivider]}
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
              <Text style={styles.eventTitle}>
                {loading && !today ? "Loading…" : today ? "No check-in recorded" : "Your day starts here"}
              </Text>
              <Text style={styles.secondary}>
                {loading && !today
                  ? "Fetching today’s record."
                  : today
                    ? "A record exists for today without a check-in. Contact HR to correct it."
                    : "Check in to record your arrival."}
              </Text>
            </View>
          </View>
        )}
      </View>
      <View style={[s.section, styles.historyHeading]}>
        <Text style={s.sectionTitle}>{monthLabel(todayDate)}</Text>
        <Text style={styles.count}>
          {month.length} {month.length === 1 ? "day" : "days"}
        </Text>
      </View>
      <SegmentControl options={filters} value={filter} onChange={setFilter} />
      <View style={[s.card, styles.recordGroup]}>
        {month.length ? (
          month.map((day, index) => (
            <View
              key={day.id}
              style={[styles.record, index > 0 && s.rowDivider]}
            >
              <View style={styles.recordHeading}>
                <Text style={styles.day}>{dayLabel(day.attendanceDate)}</Text>
                <Badge tone={tones[day.status]}>{STATUS_LABELS[day.status]}</Badge>
              </View>
              <View style={styles.recordDetails}>
                <View style={styles.timeRange}>
                  <Feather name="clock" size={13} color={p.muted} />
                  <Text style={styles.secondary}>
                    {day.checkIn ? `${timeLabel(day.checkIn)} – ${timeLabel(day.checkOut)}` : "No times recorded"}
                  </Text>
                </View>
                <Text style={styles.duration}>
                  {day.checkOut ? hoursLabel(day.workedHours) : "—"}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.record}>
            <Text style={styles.day}>
              {loading && !records.length ? "Loading…" : "Nothing here yet"}
            </Text>
            <Text style={styles.secondary}>
              {loading && !records.length
                ? "Fetching this month’s records."
                : filter === "All"
                  ? "No attendance has been recorded this month."
                  : `No ${filter.toLowerCase()} days this month.`}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.note}>
        <Feather
          name="info"
          size={14}
          color={p.muted}
          style={{ marginTop: 2 }}
        />
        <Text style={[styles.secondary, { flex: 1 }]}>
          Times are shown in {TIMEZONE_LABEL}, the company attendance clock.
          Corrections go through HR.
        </Text>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  notice: { marginBottom: 16 },
  today: { marginTop: 2, paddingHorizontal: 0, paddingVertical: 16 },
  todayHeading: { marginBottom: 4, paddingHorizontal: 20 },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
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
  eventIconActive: { backgroundColor: p.accent },
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 3,
  },
  secondary: { ...font.regular, fontSize: 12, lineHeight: 19, color: p.muted },
  historyHeading: { marginTop: 30, marginBottom: 16 },
  count: {
    ...font.medium,
    fontSize: 12,
    color: p.muted,
    fontVariant: ["tabular-nums"],
  },
  recordGroup: { marginTop: 16, padding: 0 },
  record: { paddingHorizontal: 20, paddingVertical: 18, gap: 12 },
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
  timeRange: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  duration: {
    ...font.semibold,
    fontSize: 13,
    color: p.ink,
    fontVariant: ["tabular-nums"],
  },
  note: { flexDirection: "row", gap: 8, marginTop: 18, paddingHorizontal: 3 },
});
