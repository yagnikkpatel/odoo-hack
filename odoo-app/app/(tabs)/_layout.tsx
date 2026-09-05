import { NativeTabs } from "expo-router/unstable-native-tabs";
import { palette as p } from "@/constants/theme";
export default function TabLayout() {
  return (
    <NativeTabs
      backgroundColor={p.white}
      tintColor={p.ink}
      iconColor={{ default: p.muted, selected: p.ink }}
      labelStyle={{ fontSize: 11, fontWeight: "700" }}
      disableIndicator
      rippleColor="transparent"
      labelVisibilityMode="labeled"
      disableTransparentOnScrollEdge
    >
      <NativeTabs.Trigger name="index" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon
          sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }}
          md="dashboard"
        />
        <NativeTabs.Trigger.Label>Dashboard</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="attendance" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_today" />
        <NativeTabs.Trigger.Label>Attendance</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon
          sf={{
            default: "person.crop.square",
            selected: "person.crop.square.fill",
          }}
          md="person"
        />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
