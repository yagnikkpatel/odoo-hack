import { Platform } from "react-native";

// Native continuous corners, with progressive squircle support on the web.
export function corners(radius: number) {
  return {
    borderRadius: radius,
    borderCurve: "continuous" as const,
    ...(Platform.OS === "web" ? { cornerShape: "squircle" } : {}),
  };
}

// sRGB equivalents of odoo-client's Modern Minimal light preset.
// The mobile canvas uses its muted surface to separate white cards.
export const palette = {
  paper: "#F8F8F8",
  white: "#FFFFFF",
  ink: "#333333",
  muted: "#6C727E",
  line: "#E4E8EF",
  soft: "#F5F5F5",
  accent: "#3981F6",
  accentSoft: "#DCF2FF",
  accentText: "#1E3A8B",
  // The preset's second chart blue gives small white button labels more contrast.
  accentStrong: "#2463EF",
  accentBorder: "#AFCDFB",
  frost: "rgba(248, 248, 248, 0.78)",
  success: "#33785D",
  successSoft: "#EDF5F0",
  warning: "#966827",
  warningSoft: "#F9F2E5",
};
