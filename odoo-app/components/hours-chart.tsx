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

const ranges = ["Week", "Month"] as const;
const series = {
  Week: {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    values: [8.02, 8.22, 8.27, 8.1, 8.13],
    total: "40.7",
    period: "24–28 Aug",
    description: "Hours worked",
  },
  Month: {
    labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
    values: [7.4, 8.2, 7.8, 8.1],
    total: "158",
    period: "August 2026",
    description: "Hours worked · daily averages below",
  },
};
const PLOT = { width: 300, height: 160, floor: 144 };
export function HoursChart() {
  const [range, setRange] = useState<(typeof ranges)[number]>("Month");
  const [selected, setSelected] = useState(3);
  const data = series[range];
  // An explicitly labelled 6–10h domain keeps small differences legible.
  const y = (value: number) => PLOT.floor - ((value - 6) / 4) * 128;
  const points = data.values.map((value, index) => ({
    x: 8 + (index * 284) / (data.values.length - 1),
    y: y(value),
  }));
  // Straight segments: the plot joins readings, it does not smooth them.
  const line = points
    .map((point, index) => (index ? "L" : "M") + point.x + " " + point.y)
    .join(" ");
  const active = points[selected];
  return (
    <View style={[s.card, styles.card]}>
      <View style={s.section}>
        <Text style={s.sectionTitle}>Working rhythm</Text>
        <Eyebrow>{data.period}</Eyebrow>
      </View>
      <View style={styles.totalRow}>
        <View>
          <Text style={styles.total}>
            {data.total}
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
          setSelected(series[value].values.length - 1);
        }}
      />
      <View style={styles.readout} accessibilityLiveRegion="polite">
        <Text style={styles.readoutLabel}>
          {data.labels[selected]}
          {range === "Month" ? " average" : ""}
        </Text>
        <Badge tone="accent">
          {data.values[selected].toFixed(2).replace(/0$/, "")}h
        </Badge>
      </View>
      <View style={styles.plotRow}>
        <View style={styles.axis} accessible={false}>
          <Text style={styles.tick}>10h</Text>
          <Text style={styles.tick}>8h</Text>
          <Text style={styles.tick}>6h</Text>
        </View>
        <View style={styles.plot}>
          <Svg
            width="100%"
            height={PLOT.height}
            viewBox={"0 0 " + PLOT.width + " " + PLOT.height}
            preserveAspectRatio="none"
            aria-hidden
          >
            {[16, 144].map((level) => (
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
              y1={80}
              x2={PLOT.width}
              y2={80}
              stroke={p.ink}
              strokeDasharray="4 4"
            />
            <Path
              d={line + " L 292 " + PLOT.floor + " L 8 " + PLOT.floor + " Z"}
              fill={p.ink}
              fillOpacity={0.06}
            />
            <Line
              x1={active.x}
              x2={active.x}
              y1={active.y}
              y2={PLOT.floor}
              stroke={p.ink}
              strokeDasharray="2 3"
            />
            <Path
              d={line}
              stroke={p.ink}
              strokeWidth={2.5}
              strokeLinecap="square"
              strokeLinejoin="miter"
              fill="none"
            />
          </Svg>
          {/* Drawn outside the stretched SVG so the marker stays a true square. */}
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
          <View style={styles.touchLayer}>
            {data.values.map((value, index) => (
              <PressFeedback
                key={index}
                accessibilityRole="button"
                accessibilityLabel={
                  data.labels[index] +
                  ": " +
                  value +
                  " hours" +
                  (range === "Month" ? " daily average" : "")
                }
                accessibilityState={{ selected: index === selected }}
                onPress={() => setSelected(index)}
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
        <Text style={styles.tick}>8h daily target</Text>
        <Text style={[styles.tick, { marginLeft: "auto" }]}>
          Tap to explore
        </Text>
      </View>
    </View>
  );
}
const MARKER = 14;
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
    borderColor: p.ink,
    backgroundColor: p.white,
    alignItems: "center",
    justifyContent: "center",
  },
  markerCore: { width: 6, height: 6, backgroundColor: p.ink },
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
