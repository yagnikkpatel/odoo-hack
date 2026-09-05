import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  useFonts,
} from "@expo-google-fonts/space-grotesk";
import { Stack } from "expo-router";
import { DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import { AttendanceProvider } from "@/features/attendance/demo-state";
import { palette } from "@/constants/theme";

// Hold the splash screen until the typeface is ready so no screen flashes in
// the system font first.
void SplashScreen.preventAutoHideAsync().catch(() => {});

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: palette.paper,
    card: palette.paper,
    text: palette.ink,
    primary: palette.ink,
    border: palette.ink,
  },
};
export const unstable_settings = { anchor: "(tabs)" };
export default function RootLayout() {
  const [fontsReady, fontError] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  useEffect(() => {
    if (fontsReady || fontError) void SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady, fontError]);
  // A failed download still renders, in the system font, rather than a blank app.
  if (!fontsReady && !fontError) return null;
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
              sheetCornerRadius: 0,
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
