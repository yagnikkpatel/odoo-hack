import { ProfileAvatar } from "@/components/profile-avatar";
import { Page, s } from "@/components/workforce";
import { font, palette as p, rule } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

const details = [
  { icon: "hash", label: "Employee ID", value: "PP360–042" },
  { icon: "users", label: "Team", value: "Product & Design" },
  {
    icon: "calendar",
    label: "Work schedule",
    value: "Mon–Fri · 09:00–18:00",
  },
  { icon: "clock", label: "Daily target", value: "8 hours + 1 hour break" },
  { icon: "map-pin", label: "Work location", value: "Head office" },
] as const;

export default function Profile() {
  return (
    <Page>
      <View style={styles.heading} />
      <View style={styles.profile}>
        <ProfileAvatar seed="alex-morgan" size={84} style={styles.avatar} />
        <Text style={styles.name}>Alex Morgan</Text>
        <Text style={styles.role}>Product designer · Design</Text>
      </View>
      <View style={[s.section, styles.sectionHeading]}>
        <Text style={s.sectionTitle}>Work details</Text>
        <Feather name="briefcase" size={16} color={p.ink} />
      </View>
      <View style={[s.card, { paddingVertical: 0 }]}>
        {details.map(({ icon, label, value }, index) => (
          <View key={label} style={[styles.detail, index > 0 && s.rowDivider]}>
            <View style={styles.detailIcon}>
              <Feather name={icon} size={16} color={p.ink} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.value}>{value}</Text>
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
        <Text style={styles.noteText}>
          You’re viewing a sample employee. Account details will appear here
          once sign-in is connected.
        </Text>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  heading: { paddingTop: 22 },
  profile: { alignItems: "center", paddingTop: 16, paddingBottom: 24 },
  avatar: {
    marginBottom: 18,
    borderWidth: rule.thick,
    borderColor: p.ink,
  },
  name: {
    ...font.bold,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.6,
    color: p.ink,
  },
  role: {
    ...font.regular,
    fontSize: 13,
    color: p.muted,
    marginTop: 7,
    lineHeight: 20,
    textAlign: "center",
  },
  sectionHeading: { marginTop: 30, marginBottom: 16 },
  detail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
  },
  detailIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: rule.thick,
    borderColor: p.ink,
  },
  label: {
    ...font.bold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: p.muted,
  },
  value: { ...font.medium, fontSize: 14, color: p.ink, lineHeight: 20 },
  note: { flexDirection: "row", gap: 8, marginTop: 18, paddingHorizontal: 3 },
  noteText: {
    ...font.regular,
    flex: 1,
    fontSize: 12,
    lineHeight: 19,
    color: p.muted,
  },
});
