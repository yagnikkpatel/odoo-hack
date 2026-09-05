import { EmployeeAvatar } from "@/components/profile-avatar";
import { Button, Notice, Page, s } from "@/components/workforce";
import { font, palette as p, rule } from "@/constants/theme";
import { useVerificationStatus } from "@/features/attendance/use-verification";
import { useSession } from "@/features/auth/session";
import { useEmployeeProfile } from "@/features/employee/use-profile";
import { officeLabel, templateLabel } from "@/features/attendance/verification-labels";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

type Row = {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string | null;
};

const AVATAR = 84;

export default function Profile() {
  const { user, signOut } = useSession();
  const { status, profile, error, reload } = useEmployeeProfile();
  const setup = useVerificationStatus();
  const [signingOut, setSigningOut] = useState(false);
  const enrolled = setup.status === "ready" && setup.data.face.enrolled;
  const name = profile?.name || user?.name?.trim() || user?.email || "Employee";
  const subtitle =
    profile?.jobPosition && profile.department
      ? `${profile.jobPosition} · ${profile.department}`
      : profile?.jobPosition || user?.email || "";
  const work: Row[] = profile
    ? [
        { icon: "briefcase", label: "Job position", value: profile.jobPosition },
        { icon: "users", label: "Department", value: profile.department },
        { icon: "user-check", label: "Manager", value: profile.managerName },
        { icon: "calendar", label: "Working schedule", value: profile.workingSchedule },
        { icon: "map-pin", label: "Work location", value: profile.workLocation },
        { icon: "home", label: "Company", value: profile.company },
        { icon: "phone", label: "Contact", value: profile.contact },
      ]
    : [];
  return (
    <Page>
      <View style={styles.heading} />
      <View style={styles.profile}>
        <EmployeeAvatar
          imageUrl={profile?.imageUrl}
          seed={user?.id ?? "employee"}
          size={AVATAR}
          style={styles.avatar}
        />
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.role} selectable>
          {subtitle}
        </Text>
      </View>
      <View style={[s.section, styles.sectionHeading]}>
        <Text style={s.sectionTitle}>Account</Text>
        <Feather name="user" size={16} color={p.ink} />
      </View>
      <View style={[s.card, { padding: 0 }]}>
        <Detail icon="shield" label="Role" value="Employee" />
        <Detail icon="mail" label="Email" value={user?.email ?? null} divider />
      </View>
      <View style={[s.section, styles.sectionHeading]}>
        <Text style={s.sectionTitle}>Work details</Text>
        <Feather name="briefcase" size={16} color={p.ink} />
      </View>
      {status === "ready" && profile ? (
        <View style={[s.card, { padding: 0 }]}>
          {work.map((row, index) => (
            <Detail key={row.label} {...row} divider={index > 0} />
          ))}
        </View>
      ) : status === "loading" ? (
        <View style={[s.card, { padding: 0 }]}>
          <Detail icon="clock" label="Loading" value="Fetching your HR profile…" />
        </View>
      ) : status === "missing" ? (
        <Notice>
          HR has not created your employee profile yet. Your job, schedule and
          location will appear here once they do.
        </Notice>
      ) : (
        <Notice actionLabel="Retry" onAction={() => void reload()}>
          {error}
        </Notice>
      )}
      <View style={[s.section, styles.sectionHeading]}>
        <Text style={s.sectionTitle}>Check-in verification</Text>
        <Feather name="shield" size={16} color={p.ink} />
      </View>
      <View style={[s.card, { padding: 0 }]}>
        <Detail
          icon="camera"
          label="Face template"
          value={
            setup.status === "ready"
              ? templateLabel(setup.data.face)
              : setup.status === "error"
                ? setup.error
                : "Checking…"
          }
        />
        <Detail
          icon="map-pin"
          label="Office geofence"
          value={
            setup.status === "ready"
              ? officeLabel(setup.data.office)
              : setup.status === "error"
                ? setup.error
                : "Checking…"
          }
          divider
        />
      </View>
      <View style={styles.setup}>
        <Button
          label={enrolled ? "Update my face" : "Set up face check-in"}
          icon="camera"
          outline
          onPress={() => router.push("/enroll-face")}
        />
      </View>
      <View style={styles.signOut}>
        <Button
          label={signingOut ? "Signing out…" : "Sign out"}
          icon="log-out"
          outline
          disabled={signingOut}
          onPress={() => {
            if (signingOut) return;
            setSigningOut(true);
            // The route guard flips and this screen unmounts on success.
            void signOut().finally(() => setSigningOut(false));
          }}
        />
      </View>
    </Page>
  );
}

function Detail({ icon, label, value, divider = false }: Row & { divider?: boolean }) {
  return (
    <View style={[styles.detail, divider && s.rowDivider]}>
      <View style={styles.detailIcon}>
        <Feather name={icon} size={16} color={p.ink} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, !value && styles.unset]} selectable>
          {value || "Not set"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { paddingTop: 22 },
  profile: { alignItems: "center", paddingTop: 16, paddingBottom: 24 },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    marginBottom: 18,
    borderWidth: rule.thick,
    borderColor: p.ink,
    backgroundColor: p.soft,
  },
  name: {
    ...font.bold,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.6,
    color: p.ink,
    textAlign: "center",
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
    paddingHorizontal: 20,
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
  unset: { color: p.muted },
  setup: { marginTop: 12 },
  signOut: { marginTop: 28, marginBottom: 16 },
});
