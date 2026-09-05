import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import {
  Badge,
  Notice,
  Page,
  PressFeedback,
  s,
  Title,
  TopBar,
} from "@/components/workforce";
import { HoursChart } from "@/components/hours-chart";
import { font, palette as p, rule } from "@/constants/theme";
import { monthOverview, monthSeries, weekSeries } from "@/features/attendance/stats";
import { useAttendance } from "@/features/attendance/store";
import {
  DAILY_TARGET_HOURS,
  dayLabel,
  hoursLabel,
  monthLabel,
  STATUS_LABELS,
  timeLabel,
  TIMEZONE_LABEL,
  type Attendance,
} from "@/features/attendance/types";

function todayCopy(today: Attendance | null, loading: boolean) {
  if (loading && !today) return ["Loading attendance", "Getting your latest status…"];
  if (today?.checkOut)
    return [
      "You’re checked out",
      `${timeLabel(today.checkIn)} – ${timeLabel(today.checkOut)} · ${hoursLabel(today.workedHours)}`,
    ];
  if (today?.checkIn)
    return ["You’re checked in", `Since ${timeLabel(today.checkIn)}. Check out when you finish.`];
  if (today)
    return ["No check-in recorded", "A record already exists for today. Contact HR to correct it."];
  return ["Ready when you are", "Check in to start your day."];
}

const markers = { present: "filled", incomplete: "hollow", absent: "faint" } as const;

export default function Dashboard() {
  const { today, todayDate, records, loading, refreshing, error, refresh, checkedIn } =
    useAttendance();
  const overview = monthOverview(records, todayDate);
  const [headline, caption] = todayCopy(today, loading);
  const recent = records.filter((record) => record.checkIn).slice(0, 3);
  const rate = overview.attendanceRate;
  const average = overview.averageHours;
  return (
    <Page header={<TopBar />} refreshing={refreshing} onRefresh={refresh}>
      <Title
        title="Your workday"
        subtitle={new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      />
      {error ? (
        <View style={styles.notice}>
          <Notice actionLabel="Retry" onAction={refresh}>
            {error}
          </Notice>
        </View>
      ) : null}
      <View style={[s.card, styles.today]} accessibilityLiveRegion="polite">
        <View style={[styles.todayIcon, checkedIn && styles.todayIconActive]}>
          <Feather
            name={checkedIn ? "check" : today?.checkOut ? "moon" : "sun"}
            size={20}
            color={checkedIn ? p.white : p.ink}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.todayTitle}>{headline}</Text>
          <Text style={s.caption}>{caption}</Text>
        </View>
      </View>

      <View style={[s.section, { marginTop: 28 }]}>
        <Text style={s.sectionTitle}>{monthLabel(todayDate)} overview</Text>
      </View>
      <View style={s.row}>
        <View style={[s.card, styles.stat]}>
          <View style={styles.statTop}>
            <Text style={styles.statLabel}>Days present</Text>
            <Feather name="calendar" color={p.ink} size={15} />
          </View>
          <Text style={styles.statValue}>
            {loading && !records.length ? "—" : overview.presentDays}
            <Text style={styles.statUnit}> / {overview.workdaysSoFar}</Text>
          </Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round((rate ?? 0) * 100)}%` }]} />
          </View>
          <Text style={styles.statNote}>
            {rate === null ? "No workdays yet this month" : `${Math.round(rate * 100)}% of workdays so far`}
          </Text>
        </View>
        <View style={[s.card, styles.stat]}>
          <View style={styles.statTop}>
            <Text style={styles.statLabel}>Daily average</Text>
            <Feather name="clock" color={p.ink} size={15} />
          </View>
          <Text style={styles.statValue}>
            {average === null ? "—" : average.toFixed(1)}
            <Text style={styles.statUnit}> hrs</Text>
          </Text>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${Math.round(Math.min(1, (average ?? 0) / DAILY_TARGET_HOURS) * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.statNote}>of an {DAILY_TARGET_HOURS}h daily target</Text>
        </View>
      </View>

      <HoursChart
        week={weekSeries(records, todayDate)}
        month={monthSeries(records, todayDate)}
      />
      <View style={[s.card, styles.summary]}>
        {(["present", "incomplete", "absent"] as const).map((status, index) => (
          <View
            key={status}
            style={[styles.summaryCell, index > 0 && styles.summaryDivider]}
          >
            <Text style={styles.summaryValue}>{overview.counts[status]}</Text>
            <View style={styles.summaryLabelRow}>
              <View style={[styles.marker, markerStyles[markers[status]]]} />
              <Text style={styles.summaryLabel}>{STATUS_LABELS[status]}</Text>
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
      <View style={[s.card, styles.activityCard]}>
        {recent.length ? (
          recent.map((record, index) => (
            <View
              key={record.id}
              style={[styles.activity, index > 0 && s.rowDivider]}
            >
              <View style={styles.activityIcon}>
                <Feather
                  name={record.checkOut ? "log-out" : "log-in"}
                  size={16}
                  color={p.ink}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.activityTitle}>{dayLabel(record.attendanceDate)}</Text>
                <Text style={s.caption}>
                  {timeLabel(record.checkIn)} – {timeLabel(record.checkOut)}
                </Text>
              </View>
              {record.checkOut ? (
                <Text style={styles.activityTime}>{hoursLabel(record.workedHours)}</Text>
              ) : (
                <Badge tone="warning">Open</Badge>
              )}
            </View>
          ))
        ) : (
          <View style={styles.activity}>
            <View style={styles.activityIcon}>
              <Feather name="clock" size={16} color={p.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.activityTitle}>
                {loading ? "Loading…" : "No check-ins yet this month"}
              </Text>
              <Text style={s.caption}>
                {loading ? "Fetching your records." : "Your first check-in will appear here."}
              </Text>
            </View>
          </View>
        )}
      </View>
      <Text style={styles.note}>
        Times are shown in {TIMEZONE_LABEL}, the company attendance clock.
        Pull down to refresh.
      </Text>
    </Page>
  );
}
const markerStyles = StyleSheet.create({
  filled: { backgroundColor: p.accent },
  hollow: { backgroundColor: p.white },
  faint: { backgroundColor: p.faint, borderColor: p.faint },
});
const styles = StyleSheet.create({
  notice: { marginBottom: 16 },
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
  todayIconActive: { backgroundColor: p.accent },
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
  track: {
    height: 10,
    borderWidth: rule.thick,
    borderColor: p.ink,
    backgroundColor: p.white,
    marginTop: 16,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: p.accent },
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
  activityCard: { padding: 0 },
  activity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
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
