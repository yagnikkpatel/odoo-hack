import { type ComponentProps, type RefObject } from "react";
import { type View } from "react-native";
import Animated from "react-native-reanimated";
import { palette } from "@/constants/theme";

// The mask and backdrop filter must share an element. Masking their parent
// would isolate the backdrop and prevent it sampling the scrolling page.
export function HeaderFrost({
  style,
}: {
  target: RefObject<View | null>;
  style: ComponentProps<typeof Animated.View>["style"];
}) {
  return <Animated.View style={[frost, style]} />;
}

const frost = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: -48,
  pointerEvents: "none" as const,
  backgroundColor: palette.frost,
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  maskImage:
    "linear-gradient(to bottom, black 0%, black 40%, transparent 100%)",
  WebkitMaskImage:
    "linear-gradient(to bottom, black 0%, black 40%, transparent 100%)",
};
