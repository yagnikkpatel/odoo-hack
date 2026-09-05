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
  Platform,
  Pressable,
  type PressableProps,
  RefreshControl,
  type StyleProp,
  type ViewStyle,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
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
import { SafeAreaView as NativeScreenSafeAreaView } from "react-native-screens/experimental";
import { tabContentGap } from "@/constants/navigation";
import { box, font, palette as p, rule } from "@/constants/theme";
import { useAttendance } from "@/features/attendance/store";
import { useSession } from "@/features/auth/session";
import { useEmployeeProfile } from "@/features/employee/use-profile";
import { EmployeeAvatar } from "@/components/profile-avatar";

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
  refreshing = false,
  onRefresh,
}: PropsWithChildren<{
  tabbed?: boolean;
  header?: ReactNode;
  refreshing?: boolean;
  /** Enables pull-to-refresh. */
  onRefresh?: () => void;
}>) {
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
  const bottomPadding = tabbed ? tabContentGap : insets.bottom + 28;
  const content = (
    <Animated.ScrollView
      style={s.scrollTarget}
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
      scrollIndicatorInsets={{ top: header ? headerHeight + insets.top : 0 }}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={p.accent}
            colors={[p.accent]}
            progressViewOffset={header ? headerHeight + insets.top : 0}
          />
        ) : undefined
      }
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
  const page = (
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
  // Android/web bars occupy their own layout space. Only native iOS tabs
  // overlay their screen; account for their measured bottom safe area once.
  return tabbed && Platform.OS === "ios" ? (
    <NativeScreenSafeAreaView collapsable={false} edges={{ bottom: true }} style={s.safe}>
      {page}
    </NativeScreenSafeAreaView>
  ) : page;
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

// Monochrome status language: filled black is positive or selected, a
// dashed outline is a caution, a grey fill is neutral.
const badgeTones = {
  neutral: { surface: { backgroundColor: p.soft }, ink: p.ink },
  accent: { surface: { backgroundColor: p.accent }, ink: p.accentForeground },
  success: { surface: { backgroundColor: p.accent }, ink: p.accentForeground },
  warning: {
    surface: { backgroundColor: p.white, borderStyle: "dashed" as const },
    ink: p.ink,
  },
};
export function Badge({
  children,
  tone = "neutral",
}: PropsWithChildren<{ tone?: keyof typeof badgeTones }>) {
  const { surface, ink } = badgeTones[tone];
  return (
    <View style={[s.pill, surface]}>
      <Text style={[s.badgeText, { color: ink }]}>{children}</Text>
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
  // onLayout reports the border-box; the indicator slides inside the rule.
  const itemWidth = Math.max(0, (width - rule.thick * 2) / options.length);
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
      {options.map((option, index) => (
        <PressFeedback
          key={option}
          accessibilityRole="button"
          accessibilityState={{ selected: value === option }}
          onPress={() => onChange(option)}
          style={[s.segment, index > 0 && s.segmentDivider]}
        >
          <Text
            style={[s.segmentText, value === option && s.segmentTextActive]}
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
  disabled = false,
  icon = "arrow-up-right",
}: {
  label: string;
  onPress: () => void;
  outline?: boolean;
  disabled?: boolean;
  icon?: ComponentProps<typeof Feather>["name"];
}) {
  return (
    <PressFeedback
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.button, outline && s.outline, disabled && s.buttonDisabled]}
    >
      <Text style={[s.buttonText, outline && { color: p.ink }]}>{label}</Text>
      <Feather name={icon} size={16} color={outline ? p.ink : p.white} />
    </PressFeedback>
  );
}
export function TextField({
  label,
  style,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & { label: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label}
        placeholderTextColor={p.faint}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[s.input, focused && s.inputFocused, style]}
      />
    </View>
  );
}
// A dashed box for a problem the visitor can act on.
export function Notice({
  children,
  actionLabel,
  onAction,
}: PropsWithChildren<{ actionLabel?: string; onAction?: () => void }>) {
  return (
    <View style={s.notice} accessibilityLiveRegion="polite">
      <Feather name="alert-triangle" size={16} color={p.ink} />
      <Text style={s.noticeText}>{children}</Text>
      {actionLabel && onAction ? (
        <PressFeedback
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          style={s.noticeAction}
        >
          <Text style={s.noticeActionText}>{actionLabel}</Text>
        </PressFeedback>
      ) : null}
    </View>
  );
}
export function TopBar() {
  const { checkedIn, dayComplete, loading } = useAttendance();
  const { user } = useSession();
  // Shows the employee's real HR photo once it loads, matching the Profile
  // screen, instead of always falling back to the generated placeholder.
  const { profile } = useEmployeeProfile();
  return (
    <View style={s.topBar}>
      <PressFeedback
        accessibilityRole="button"
        accessibilityLabel="Open profile"
        onPress={() => router.navigate("/profile")}
        style={s.identity}
      >
        <EmployeeAvatar
          imageUrl={profile?.imageUrl}
          seed={user?.id ?? "employee"}
          style={s.avatarFrame}
        />
      </PressFeedback>
      <Button
        label={dayComplete ? "Done today" : checkedIn ? "Check out" : "Check in"}
        disabled={dayComplete || loading}
        onPress={() => router.push("/check-in")}
        icon={dayComplete ? "check" : checkedIn ? "log-out" : "arrow-up-right"}
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
  avatarFrame: { borderWidth: rule.thick, borderColor: p.ink },
  caption: {
    ...font.regular,
    fontSize: 12,
    lineHeight: 18,
    color: p.muted,
    marginTop: 3,
  },
  titleBlock: { gap: 8, marginTop: 12, marginBottom: 24 },
  title: {
    ...font.bold,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.8,
    color: p.ink,
  },
  body: { ...font.regular, fontSize: 14, lineHeight: 22, color: p.muted },
  eyebrow: {
    ...font.medium,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: p.muted,
  },
  section: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    ...font.bold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: p.ink,
  },
  row: { flexDirection: "row", gap: 12 },
  card: { ...box, padding: 20 },
  // A thin rule between rows inside a card.
  rowDivider: { borderTopWidth: rule.thin, borderTopColor: p.ink },
  button: {
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: p.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonText: {
    ...font.bold,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: p.white,
  },
  // Only the outline (secondary) variant needs a rule to read as a button.
  outline: {
    backgroundColor: p.white,
    borderWidth: rule.thick,
    borderColor: p.ink,
  },
  buttonDisabled: { opacity: 0.4 },
  field: { gap: 6 },
  fieldLabel: {
    ...font.bold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: p.muted,
  },
  input: {
    ...font.medium,
    height: 48,
    borderWidth: rule.thick,
    borderColor: p.ink,
    backgroundColor: p.white,
    paddingHorizontal: 14,
    fontSize: 15,
    color: p.ink,
    outlineWidth: 0,
  },
  inputFocused: { backgroundColor: p.soft },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: rule.thick,
    borderColor: p.ink,
    borderStyle: "dashed",
    padding: 12,
  },
  noticeText: {
    ...font.medium,
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: p.ink,
  },
  noticeAction: {
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: rule.thick,
    borderColor: p.ink,
  },
  noticeActionText: {
    ...font.bold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: p.ink,
  },
  divider: { height: rule.thin, backgroundColor: p.ink, marginVertical: 24 },
  pill: {
    alignSelf: "flex-start",
    borderWidth: rule.thin,
    borderColor: p.ink,
    backgroundColor: p.soft,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    ...font.bold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  segments: {
    flexDirection: "row",
    borderWidth: rule.thick,
    borderColor: p.ink,
    backgroundColor: p.white,
    position: "relative",
  },
  segment: {
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  segmentDivider: { borderLeftWidth: rule.thin, borderLeftColor: p.ink },
  segmentText: { ...font.medium, fontSize: 13, color: p.ink },
  segmentTextActive: { ...font.bold, color: p.white },
  segmentIndicator: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: p.accent,
  },
});
