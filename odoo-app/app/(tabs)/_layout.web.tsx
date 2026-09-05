import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { PlatformPressable } from "expo-router/react-navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tabBarHeight } from "@/constants/navigation";
import { palette as p } from "@/constants/theme";

// NativeTabs uses a top menu on web. Keep the employee workspace bottom-aligned here.
export default function WebTabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: p.accentStrong,
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
          position: "absolute",
          height: tabBarHeight + insets.bottom,
          backgroundColor: p.white,
          borderTopWidth: 0,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
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
