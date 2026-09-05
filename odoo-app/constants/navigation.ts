import { Platform } from "react-native";

// Native bars are system-owned; reserve their standard footprint plus the
// device's bottom inset. Web uses this exact height in its tab-bar layout.
export const tabBarHeight = Platform.select({
  ios: 64,
  android: 80,
  default: 66,
});
export const tabContentGap = 20;
