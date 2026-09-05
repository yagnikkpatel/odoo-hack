import { useId, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Line,
  Path,
  Stop,
} from "react-native-svg";
import {
  Badge,
  Eyebrow,
  PressFeedback,
  s,
  SegmentControl,
} from "@/components/workforce";
import { palette as p } from "@/constants/theme";

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
export function HoursChart() {
  const [range, setRange] = useState<(typeof ranges)[number]>("Month");
  const [selected, setSelected] = useState(3);
  const gradientId = "hours" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const data = series[range];
  // An explicitly labelled 6–10h domain keeps small differences legible.
  const y = (value: number) => 144 - ((value - 6) / 4) * 128;
  const points = data.values.map((value, index) => ({
    x: 8 + (index * 284) / (data.values.length - 1),
    y: y(value),
  }));
  const curve = points.reduce((path, point, index) => {
    if (!index) return "M " + point.x + " " + point.y;
    const previous = points[index - 1];
    const mid = (previous.x + point.x) / 2;
    return (
      path +
      " C " +
      mid +
      " " +
      previous.y +
      ", " +
      mid +
      " " +
      point.y +
      ", " +
      point.x +
      " " +
      point.y
    );
  }, "");
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
            height={160}
            viewBox="0 0 300 160"
            preserveAspectRatio="none"
            aria-hidden
          >
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={p.accent} stopOpacity={0.16} />
                <Stop offset="1" stopColor={p.accent} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {[16, 80, 144].map((level) => (
              <Line
                key={level}
                x1={0}
                y1={level}
                x2={300}
                y2={level}
                stroke={level === 80 ? p.accentBorder : p.line}
                strokeDasharray="3 5"
              />
            ))}
            <Path
              d={curve + " L 292 144 L 8 144 Z"}
              fill={"url(#" + gradientId + ")"}
            />
            <Line
              x1={active.x}
              x2={active.x}
              y1={active.y}
              y2={144}
              stroke={p.accent}
              strokeOpacity={0.22}
              strokeDasharray="3 4"
            />
            <Path
              d={curve}
              stroke={p.accent}
              strokeWidth={2.6}
              strokeLinecap="round"
              fill="none"
            />
            <Circle cx={active.x} cy={active.y} r={7} fill={p.accentSoft} />
            <Circle
              cx={active.x}
              cy={active.y}
              r={3.5}
              fill={p.accent}
              stroke={p.white}
              strokeWidth={1.5}
            />
          </Svg>
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
            style={[styles.tick, selected === index && { color: p.accentStrong }]}
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
const styles = StyleSheet.create({
  card: { marginTop: 16, padding: 20 },
  totalRow: { marginBottom: 20 },
  total: {
    fontSize: 36,
    fontWeight: "600",
    letterSpacing: -1.2,
    color: p.ink,
    fontVariant: ["tabular-nums"],
  },
  unit: { fontSize: 16, fontWeight: "400", letterSpacing: 0, color: p.muted },
  subtitle: { fontSize: 12, color: p.muted, lineHeight: 18, marginTop: 4 },
  readout: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 4,
  },
  readoutLabel: { fontSize: 12, color: p.muted },
  plotRow: { flexDirection: "row", gap: 12 },
  axis: { justifyContent: "space-between", paddingTop: 9, paddingBottom: 9 },
  tick: { fontSize: 10, lineHeight: 16, color: p.muted },
  plot: { flex: 1, height: 160 },
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
    width: 10,
    borderTopWidth: 1,
    borderColor: p.accentBorder,
    borderStyle: "dashed",
  },
});
