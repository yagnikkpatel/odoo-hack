import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import {
  Badge,
  Eyebrow,
  PressFeedback,
  s,
  SegmentControl,
} from "@/components/workforce";
import { font, palette as p, rule } from "@/constants/theme";
import type { Series } from "@/features/attendance/stats";
import { compactHours, DAILY_TARGET_HOURS } from "@/features/attendance/types";

const ranges = ["Week", "Month"] as const;
const PLOT = { width: 300, height: 160, floor: 144, top: 16 };
const MARKER = 14;

const lastRecorded = (values: (number | null)[]) => {
  for (let index = values.length - 1; index >= 0; index -= 1)
    if (values[index] !== null) return index;
  return -1;
};

export function HoursChart({ week, month }: { week: Series; month: Series }) {
  const [range, setRange] = useState<(typeof ranges)[number]>("Month");
  const [picked, setPicked] = useState<number | null>(null);
  const data = range === "Week" ? week : month;
  const last = lastRecorded(data.values);
  // A tap sticks only while that period still has a value; otherwise the
  // latest recorded period is shown.
  const selected =
    picked !== null && data.values[picked] !== null ? picked : last;
  const recorded = data.values.filter((value): value is number => value !== null);
  // The axis grows with the data but never below the 8h target's headroom.
  const ceiling = Math.max(10, Math.ceil(Math.max(0, ...recorded)));
  const y = (value: number) =>
    PLOT.floor - (Math.min(value, ceiling) / ceiling) * (PLOT.floor - PLOT.top);
  const x = (index: number) =>
    data.values.length > 1
      ? 8 + (index * 284) / (data.values.length - 1)
      : PLOT.width / 2;
  // One straight run per stretch of recorded periods; gaps stay gaps.
  const runs: { x: number; y: number }[][] = [];
  data.values.forEach((value, index) => {
    if (value === null) {
      if (runs[runs.length - 1]?.length) runs.push([]);
      return;
    }
    (runs[runs.length - 1] ??= runs[runs.push([]) - 1]).push({
      x: x(index),
      y: y(value),
    });
  });
  const line = (points: { x: number; y: number }[]) =>
    points
      .map((point, index) => (index ? "L" : "M") + point.x + " " + point.y)
      .join(" ");
  const active = selected >= 0 ? { x: x(selected), y: y(data.values[selected] ?? 0) } : null;

  return (
    <View style={[s.card, styles.card]}>
      <View style={s.section}>
        <Text style={s.sectionTitle}>Working rhythm</Text>
        <Eyebrow>{data.period}</Eyebrow>
      </View>
      <View style={styles.totalRow}>
        <View>
          <Text style={styles.total}>
            {compactHours(data.total)}
            <Text style={styles.unit}> hrs</Text>
          </Text>
          <Text style={styles.subtitle}>{data.description}</Text>
        </View>
      </View>
      <SegmentControl
        options={ranges}
        value={range}
        onChange={(value) => {
          setRange(value);
          setPicked(null);
        }}
      />
      <View style={styles.readout} accessibilityLiveRegion="polite">
        <Text style={styles.readoutLabel}>
          {selected >= 0
            ? data.labels[selected] + (range === "Month" ? " average" : "")
            : "No hours recorded yet"}
        </Text>
        {selected >= 0 ? (
          <Badge tone="accent">
            {compactHours(data.values[selected] ?? 0)}h
          </Badge>
        ) : null}
      </View>
      <View style={styles.plotRow}>
        <View style={styles.axis} accessible={false}>
          <Text style={styles.tick}>{ceiling}h</Text>
          <Text style={styles.tick}>{ceiling / 2}h</Text>
          <Text style={styles.tick}>0h</Text>
        </View>
        <View style={styles.plot}>
          <Svg
            width="100%"
            height={PLOT.height}
            viewBox={"0 0 " + PLOT.width + " " + PLOT.height}
            preserveAspectRatio="none"
            aria-hidden
          >
            {[PLOT.top, PLOT.floor].map((level) => (
              <Line
                key={level}
                x1={0}
                y1={level}
                x2={PLOT.width}
                y2={level}
                stroke={p.ink}
                strokeOpacity={0.18}
              />
            ))}
            <Line
              x1={0}
              y1={y(DAILY_TARGET_HOURS)}
              x2={PLOT.width}
              y2={y(DAILY_TARGET_HOURS)}
              stroke={p.ink}
              strokeDasharray="4 4"
            />
            {runs
              .filter((points) => points.length > 1)
              .map((points, index) => (
                <Path
                  key={"area" + index}
                  d={
                    line(points) +
                    ` L ${points[points.length - 1].x} ${PLOT.floor} L ${points[0].x} ${PLOT.floor} Z`
                  }
                  fill={p.accent}
                  fillOpacity={0.1}
                />
              ))}
            {active ? (
              <Line
                x1={active.x}
                x2={active.x}
                y1={active.y}
                y2={PLOT.floor}
                stroke={p.accent}
                strokeDasharray="2 3"
              />
            ) : null}
            {runs
              .filter((points) => points.length > 1)
              .map((points, index) => (
                <Path
                  key={"line" + index}
                  d={line(points)}
                  stroke={p.accent}
                  strokeWidth={2.5}
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  fill="none"
                />
              ))}
          </Svg>
          {/* Drawn outside the stretched SVG so the marker stays a true square. */}
          {active ? (
            <View
              pointerEvents="none"
              style={[
                styles.marker,
                {
                  left: `${(active.x / PLOT.width) * 100}%`,
                  top: `${(active.y / PLOT.height) * 100}%`,
                },
              ]}
            >
              <View style={styles.markerCore} />
            </View>
          ) : (
            <View style={styles.empty} pointerEvents="none">
              <Text style={styles.emptyText}>Nothing recorded for this period</Text>
            </View>
          )}
          <View style={styles.touchLayer}>
            {data.values.map((value, index) => (
              <PressFeedback
                key={index}
                accessibilityRole="button"
                accessibilityLabel={
                  data.labels[index] +
                  ": " +
                  (value === null
                    ? "no hours recorded"
                    : compactHours(value) +
                      " hours" +
                      (range === "Month" ? " daily average" : ""))
                }
                accessibilityState={{ selected: index === selected }}
                disabled={value === null}
                onPress={() => setPicked(index)}
                style={{ flex: 1 }}
              />
            ))}
          </View>
        </View>
      </View>
      <View style={styles.labels}>
        {data.labels.map((label, index) => (
          <Text
            key={label}
            style={[styles.tick, selected === index && styles.tickActive]}
          >
            {label}
          </Text>
        ))}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendDash} />
        <Text style={styles.tick}>{DAILY_TARGET_HOURS}h daily target</Text>
        <Text style={[styles.tick, { marginLeft: "auto" }]}>
          Tap to explore
        </Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  card: { marginTop: 16, padding: 20 },
  totalRow: { marginBottom: 20 },
  total: {
    ...font.bold,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -1,
    color: p.ink,
    fontVariant: ["tabular-nums"],
  },
  unit: { ...font.regular, fontSize: 16, letterSpacing: 0, color: p.muted },
  subtitle: {
    ...font.regular,
    fontSize: 12,
    color: p.muted,
    lineHeight: 18,
    marginTop: 4,
  },
  readout: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 24,
    marginTop: 18,
    marginBottom: 4,
  },
  readoutLabel: { ...font.medium, fontSize: 12, color: p.muted },
  plotRow: { flexDirection: "row", gap: 12 },
  axis: { justifyContent: "space-between", paddingTop: 9, paddingBottom: 9 },
  tick: { ...font.medium, fontSize: 10, lineHeight: 16, color: p.muted },
  tickActive: { ...font.bold, color: p.ink },
  plot: { flex: 1, height: PLOT.height },
  marker: {
    position: "absolute",
    width: MARKER,
    height: MARKER,
    marginLeft: -MARKER / 2,
    marginTop: -MARKER / 2,
    borderWidth: rule.thick,
    borderColor: p.accent,
    backgroundColor: p.white,
    alignItems: "center",
    justifyContent: "center",
  },
  markerCore: { width: 6, height: 6, backgroundColor: p.accent },
  empty: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    ...font.bold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: p.muted,
    backgroundColor: p.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  touchLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: "row",
  },
  labels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingLeft: 34,
    marginTop: 2,
  },
  legend: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 20 },
  legendDash: {
    width: 12,
    borderTopWidth: rule.thin,
    borderColor: p.ink,
    borderStyle: "dashed",
  },
});
