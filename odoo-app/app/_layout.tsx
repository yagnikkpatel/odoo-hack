import { Stack } from "expo-router";
import { DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";
import { AttendanceProvider } from "@/features/attendance/demo-state";
import { palette } from "@/constants/theme";
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: palette.paper,
    card: palette.paper,
    text: palette.ink,
    primary: palette.accentStrong,
    border: "transparent",
  },
};
export const unstable_settings = { anchor: "(tabs)" };
export default function RootLayout() {
  return (
    <AttendanceProvider>
      <ThemeProvider value={theme}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palette.paper },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="check-in"
            options={{
              presentation:
                Platform.OS === "web" ? "transparentModal" : "formSheet",
              animation: Platform.OS === "web" ? "none" : "slide_from_bottom",
              contentStyle: {
                backgroundColor:
                  Platform.OS === "web" ? "transparent" : palette.white,
              },
              sheetAllowedDetents: [0.9, 1],
              sheetInitialDetentIndex: 0,
              sheetCornerRadius: 32,
              sheetGrabberVisible: true,
              sheetLargestUndimmedDetentIndex: "none",
              sheetExpandsWhenScrolledToEdge: true,
            }}
          />
        </Stack>
        <StatusBar style="dark" />
      </ThemeProvider>
    </AttendanceProvider>
  );
}
