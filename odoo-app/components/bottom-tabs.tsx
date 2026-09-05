import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { PlatformPressable } from "expo-router/react-navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tabBarHeight } from "@/constants/navigation";
import { font, palette as p, rule } from "@/constants/theme";
import { Platform } from "react-native";

// Reserve a compact bottom bar in normal layout on Android/web, never over content.
export default function BottomTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarLabelPosition: "below-icon",
        tabBarActiveTintColor: p.accent,
        tabBarInactiveTintColor: p.muted,
        tabBarButton: (props) => (
          <PlatformPressable
            {...props}
            hoverEffect={undefined}
            pressColor="transparent"
            android_ripple={{ color: "transparent", borderless: false }}
            pressOpacity={0.85}
          />
        ),
        tabBarStyle: {
          position: "relative",
          height: tabBarHeight + insets.bottom,
          backgroundColor: p.white,
          borderTopWidth: Platform.OS === "web" ? rule.thick : 0,
          borderTopColor: p.ink,
          paddingBottom: 6 + insets.bottom,
          paddingTop: 6,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          letterSpacing: 0.6,
          textTransform: Platform.OS === "web" ? "uppercase" : "none",
          ...font.bold,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => (
            <Feather name="grid" color={color} size={20} />
          ),
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: "Attendance",
          tabBarIcon: ({ color }) => (
            <Feather name="calendar" color={color} size={20} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <Feather name="user" color={color} size={20} />
          ),
        }}
      />
    </Tabs>
  );
}
