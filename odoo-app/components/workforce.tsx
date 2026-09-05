import { Feather } from "@expo/vector-icons";
import { BlurTargetView } from "expo-blur";
import { HeaderFrost } from "@/components/header-frost";
import { router } from "expo-router";
import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  useSharedValue,
  useReducedMotion,
  withTiming,
} from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { tabBarHeight, tabContentGap } from "@/constants/navigation";
import { corners, palette as p } from "@/constants/theme";
import { useAttendance } from "@/features/attendance/demo-state";
import { ProfileAvatar } from "@/components/profile-avatar";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const motion = {
  duration: 180,
  easing: Easing.out(Easing.cubic),
  reduceMotion: ReduceMotion.System,
};

// A small response to touch, not an entrance animation users wait through daily.
export function PressFeedback({
  style,
  onPressIn,
  onPressOut,
  ...props
}: Omit<PressableProps, "style"> & { style?: StyleProp<ViewStyle> }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const reducedMotion = useReducedMotion();
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
    opacity: opacity.get(),
  }));
  return (
    <AnimatedPressable
      {...props}
      onPressIn={(event) => {
        scale.set(
          withTiming(reducedMotion ? 1 : 0.97, { ...motion, duration: 100 }),
        );
        opacity.set(0.85);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withTiming(1, motion));
        opacity.set(1);
        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    />
  );
}

export function Page({
  children,
  tabbed = true,
  header,
}: PropsWithChildren<{ tabbed?: boolean; header?: ReactNode }>) {
  const insets = useSafeAreaInsets();
  const blurTarget = useRef<View | null>(null);
  const [headerHeight, setHeaderHeight] = useState(84);
  const scrollY = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(Math.max(0, event.contentOffset.y));
  });
  const backdropStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, scrollY.get() / 160);
    // Smoothstep eases both ends, avoiding a sudden appearance or cutoff.
    const opacity = progress * progress * (3 - 2 * progress);
    return { opacity: reducedMotion ? (scrollY.get() > 0 ? 1 : 0) : opacity };
  });
  const bottomPadding =
    insets.bottom + (tabbed ? tabBarHeight + tabContentGap : 28);
  const content = (
    <Animated.ScrollView
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
      scrollIndicatorInsets={{ top: header ? headerHeight + insets.top : 0 }}
      contentContainerStyle={[
        s.page,
        {
          paddingTop: header ? headerHeight + insets.top : 0,
          paddingBottom: bottomPadding,
        },
      ]}
    >
      {children}
    </Animated.ScrollView>
  );
  return (
    <SafeAreaView
      edges={header ? ["left", "right"] : ["top", "left", "right"]}
      style={s.safe}
    >
      {/* Clearance belongs to the scroll content, never a fixed strip above tabs. */}
      {header ? (
        <BlurTargetView ref={blurTarget} style={s.scrollTarget}>
          {content}
        </BlurTargetView>
      ) : (
        content
      )}
      {header && (
        <View style={[s.stickyHeader, { paddingTop: insets.top }]}>
          {/* Render the backdrop after its target so Android captures scrolling content.
              The controls are siblings, so they never get blurred or faded. */}
          <HeaderFrost target={blurTarget} style={backdropStyle} />
          <View
            style={[
              s.page,
              {
                paddingLeft: 20 + insets.left,
                paddingRight: 20 + insets.right,
              },
            ]}
            onLayout={(event) =>
              setHeaderHeight(event.nativeEvent.layout.height)
            }
          >
            {header}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

export function Eyebrow({ children }: PropsWithChildren) {
  return <Text style={s.eyebrow}>{children}</Text>;
}
export function Title({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View style={s.titleBlock}>
      <Text accessibilityRole="header" style={s.title}>
        {title}
      </Text>
      <Text style={s.body}>{subtitle}</Text>
    </View>
  );
}

const badgeColors = {
  neutral: [p.soft, p.muted],
  accent: [p.accentSoft, p.accentText],
  success: [p.successSoft, p.success],
  warning: [p.warningSoft, p.warning],
};
export function Badge({
  children,
  tone = "neutral",
}: PropsWithChildren<{ tone?: keyof typeof badgeColors }>) {
  const [backgroundColor, color] = badgeColors[tone];
  return (
    <View style={[s.pill, { backgroundColor }]}>
      <Text style={[s.badgeText, { color }]}>{children}</Text>
    </View>
  );
}

export function SegmentControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  const [width, setWidth] = useState(0);
  const offset = useSharedValue(0);
  const itemWidth = Math.max(0, (width - 8) / options.length);
  useEffect(() => {
    offset.set(withTiming(options.indexOf(value) * itemWidth, motion));
  }, [value, itemWidth, options, offset]);
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.get() }],
  }));
  return (
    <View
      style={s.segments}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Animated.View
          style={[
            s.segmentIndicator,
            { width: itemWidth, pointerEvents: "none" },
            indicatorStyle,
          ]}
        />
      )}
      {options.map((option) => (
        <PressFeedback
          key={option}
          accessibilityRole="button"
          accessibilityState={{ selected: value === option }}
          onPress={() => onChange(option)}
          style={s.segment}
        >
          <Text
            style={[
              s.segmentText,
              value === option && { color: p.accentText, fontWeight: "600" },
            ]}
          >
            {option}
          </Text>
        </PressFeedback>
      ))}
    </View>
  );
}

export function Button({
  label,
  onPress,
  outline = false,
  icon = "arrow-up-right",
}: {
  label: string;
  onPress: () => void;
  outline?: boolean;
  icon?: ComponentProps<typeof Feather>["name"];
}) {
  return (
    <PressFeedback
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[s.button, outline && s.outline]}
    >
      <Text style={[s.buttonText, outline && { color: p.ink }]}>{label}</Text>
      <Feather name={icon} size={17} color={outline ? p.ink : p.white} />
    </PressFeedback>
  );
}
export function TopBar() {
  const { checkedIn } = useAttendance();
  return (
    <View style={s.topBar}>
      <PressFeedback
        accessibilityRole="button"
        accessibilityLabel="Open profile"
        onPress={() => router.navigate("/profile")}
        style={s.identity}
      >
        <ProfileAvatar seed="alex-morgan" />
      </PressFeedback>
      <Button
        label={checkedIn ? "Check out" : "Check in"}
        onPress={() => router.push("/check-in")}
        icon={checkedIn ? "log-out" : "arrow-up-right"}
      />
    </View>
  );
}

export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.paper },
  scrollTarget: { flex: 1 },
  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    pointerEvents: "box-none",
  },
  page: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: 20,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    paddingVertical: 20,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
    minHeight: 44,
  },
  caption: { fontSize: 12, lineHeight: 18, color: p.muted, marginTop: 3 },
  titleBlock: { gap: 7, marginTop: 12, marginBottom: 24 },
  title: {
    fontSize: 30,
    fontWeight: "600",
    letterSpacing: -1.15,
    color: p.ink,
  },
  body: { fontSize: 14, lineHeight: 22, color: p.muted },
  eyebrow: { fontSize: 12, lineHeight: 18, fontWeight: "500", color: p.muted },
  section: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.35,
    color: p.ink,
  },
  row: { flexDirection: "row", gap: 12 },
  card: {
    ...corners(22),
    padding: 20,
    backgroundColor: p.white,
    boxShadow:
      "0 2px 6px rgba(25, 25, 40, 0.025), 0 8px 24px rgba(25, 25, 40, 0.015)",
  },
  button: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: p.accentStrong,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...corners(14),
  },
  buttonText: { fontSize: 13, fontWeight: "600", color: p.white },
  outline: { backgroundColor: p.soft },
  divider: { marginVertical: 24 },
  pill: {
    alignSelf: "flex-start",
    overflow: "hidden",
    ...corners(8),
    backgroundColor: p.soft,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  badgeText: { fontSize: 11, fontWeight: "500" },
  segments: {
    flexDirection: "row",
    padding: 4,
    backgroundColor: p.soft,
    ...corners(14),
    position: "relative",
  },
  segment: {
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  segmentText: { fontSize: 13, color: p.muted },
  segmentIndicator: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 4,
    ...corners(10),
    backgroundColor: p.white,
    boxShadow: "0 2px 5px rgba(25,25,40,0.07)",
  },
});
