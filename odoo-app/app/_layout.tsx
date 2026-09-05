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
import * as SystemUI from "expo-system-ui";
import { useEffect, type ComponentProps } from "react";
import { Platform } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { AttendanceProvider } from "@/features/attendance/store";
import { SessionProvider, useSession } from "@/features/auth/session";
import { palette } from "@/constants/theme";

// Hold the splash screen until the typeface and the stored session are ready,
// so neither the system font nor the wrong screen flashes first.
void SplashScreen.preventAutoHideAsync().catch(() => {});

// Android draws its own system navigation bar below the tab bar. Left
// unset, it defaults to black, which reads as a dark gap under the (white)
// bottom navigation on gesture-nav and 3-button devices. Match the page.
if (Platform.OS === "android") void SystemUI.setBackgroundColorAsync(palette.paper).catch(() => {});

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

// Check-in and face set-up share one bottom sheet treatment.
const sheetOptions: ComponentProps<typeof Stack.Screen>["options"] = {
  presentation: Platform.OS === "web" ? "transparentModal" : "formSheet",
  animation: Platform.OS === "web" ? "none" : "slide_from_bottom",
  contentStyle: {
    backgroundColor: Platform.OS === "web" ? "transparent" : palette.white,
  },
  // Full height on open: at 90% the "Before you check in" checklist sat just
  // below the fold on common phone heights, needing a scroll to see at all.
  sheetAllowedDetents: [0.9, 1],
  sheetInitialDetentIndex: 1,
  sheetCornerRadius: 0,
  sheetGrabberVisible: true,
  sheetLargestUndimmedDetentIndex: "none",
  sheetExpandsWhenScrolledToEdge: true,
};

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { status } = useSession();
  const ready = fontsReady && status !== "loading";
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return null;
  const signedIn = status === "signedIn";
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.paper },
      }}
    >
      {/* Route guards: the workspace needs a session, sign-in needs none. */}
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="check-in" options={sheetOptions} />
        <Stack.Screen name="enroll-face" options={sheetOptions} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  // A failed download still renders, in the system font, rather than a blank app.
  const fontsReady = fontsLoaded || fontError !== null;
  return (
    <KeyboardProvider>
      <SessionProvider>
        <AttendanceProvider>
          <ThemeProvider value={theme}>
            <RootNavigator fontsReady={fontsReady} />
            <StatusBar style="dark" />
          </ThemeProvider>
        </AttendanceProvider>
      </SessionProvider>
    </KeyboardProvider>
  );
}
