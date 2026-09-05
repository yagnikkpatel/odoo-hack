import { Image, type ImageStyle } from "expo-image";
import { type StyleProp, View, type ViewStyle } from "react-native";
import { Circle, G, Line, Path, Rect, Svg } from "react-native-svg";

const grays = {
  background: ["#171717", "#262626", "#404040", "#525252"],
  face: ["#a3a3a3", "#b8b8b8", "#d4d4d4", "#e5e5e5"],
  hair: ["#0a0a0a", "#171717", "#404040", "#737373"],
  shirt: ["#404040", "#525252", "#737373", "#a3a3a3"],
} as const;

function hashSeed(seed: string) {
  let result = 0;

  for (let index = 0; index < seed.length; index += 1) {
    result = (result * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return result;
}

function pick<T>(values: readonly T[], value: number) {
  return values[value % values.length];
}

type ProfileAvatarProps = {
  seed: string;
  size?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

export function ProfileAvatar({
  seed,
  size = 44,
  radius = 0,
  style,
}: ProfileAvatarProps) {
  const hash = hashSeed(seed);
  const background = pick(grays.background, hash);
  const face = pick(grays.face, hash >>> 2);
  const hair = pick(grays.hair, hash >>> 4);
  const shirt = pick(grays.shirt, hash >>> 6);
  const hairStyle = (hash >>> 8) % 3;
  const eyeStyle = (hash >>> 10) % 3;
  const hasGlasses = (hash >>> 12) % 4 === 0;
  const outline = "#0a0a0a";

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Rect width="100" height="100" fill={background} />

        {hairStyle === 2 ? (
          <Path
            d="M22 43C22 19 34 10 50 10s28 9 28 33v37H22V43Z"
            fill={hair}
            stroke={outline}
            strokeWidth="4"
            strokeLinejoin="round"
          />
        ) : null}

        <Path
          d="M4 102c2-23 19-35 46-35s44 12 46 35H4Z"
          fill={shirt}
          stroke={outline}
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <Path
          d="m32 72 18 14 18-14"
          fill="none"
          stroke="#d4d4d4"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Rect
          x="42"
          y="60"
          width="16"
          height="17"
          rx="7"
          fill={face}
          stroke={outline}
          strokeWidth="4"
        />
        <Circle cx="23" cy="47" r="8" fill={face} stroke={outline} strokeWidth="4" />
        <Circle cx="77" cy="47" r="8" fill={face} stroke={outline} strokeWidth="4" />
        <Path
          d="M25 35c0-15 10-24 25-24s25 9 25 24v17c0 16-11 26-25 26S25 68 25 52V35Z"
          fill={face}
          stroke={outline}
          strokeWidth="4"
          strokeLinejoin="round"
        />

        {hairStyle === 0 ? (
          <Path
            d="M25 38C23 19 33 9 50 9c16 0 26 9 26 26-9-1-16-6-20-13-5 8-15 13-31 16Z"
            fill={hair}
            stroke={outline}
            strokeWidth="4"
            strokeLinejoin="round"
          />
        ) : null}
        {hairStyle === 1 ? (
          <Path
            d="M25 36C24 19 34 10 50 10s25 9 25 25c-8-1-14-4-19-10-7 6-17 10-31 11Z"
            fill={hair}
            stroke={outline}
            strokeWidth="4"
            strokeLinejoin="round"
          />
        ) : null}
        {hairStyle === 2 ? (
          <Path
            d="M25 37c-1-18 9-28 25-28 17 0 27 10 26 29-7-2-13-7-17-14-8 8-19 12-34 13Z"
            fill={hair}
            stroke={outline}
            strokeWidth="4"
            strokeLinejoin="round"
          />
        ) : null}

        <Path
          d="m33 39 10-2M57 37l10 2"
          fill="none"
          stroke={outline}
          strokeWidth="3"
          strokeLinecap="round"
        />
        {eyeStyle === 0 ? (
          <G fill={outline}>
            <Circle cx="38" cy="47" r="3" />
            <Circle cx="62" cy="47" r="3" />
          </G>
        ) : null}
        {eyeStyle === 1 ? (
          <G fill={outline}>
            <Path d="M33 47c3-5 8-5 11 0-3 3-8 3-11 0Z" />
            <Path d="M56 47c3-5 8-5 11 0-3 3-8 3-11 0Z" />
          </G>
        ) : null}
        {eyeStyle === 2 ? (
          <G
            fill="none"
            stroke={outline}
            strokeWidth="3"
            strokeLinecap="round"
          >
            <Path d="M33 48c3-4 8-4 11 0" />
            <Path d="M56 48c3-4 8-4 11 0" />
          </G>
        ) : null}

        {hasGlasses ? (
          <G fill="none" stroke={outline} strokeWidth="3">
            <Circle cx="38" cy="47" r="8" />
            <Circle cx="62" cy="47" r="8" />
            <Line x1="46" y1="47" x2="54" y2="47" />
          </G>
        ) : null}

        <Path
          d="m50 48-2 9 5 1"
          fill="none"
          stroke={outline}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d={hash % 2 === 0 ? "M41 64c5 5 13 5 18 0" : "M41 63c6 3 12 3 18 0"}
          fill="none"
          stroke={outline}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

/**
 * The account's real HR photo when it has one, the generated placeholder
 * otherwise. Used everywhere a person's picture appears — the pinned header
 * and the Profile screen — so a set photo shows up consistently rather than
 * only on Profile.
 */
export function EmployeeAvatar({
  imageUrl,
  seed,
  size = 44,
  radius = 0,
  style,
}: ProfileAvatarProps & { imageUrl?: string | null }) {
  if (!imageUrl) return <ProfileAvatar seed={seed} size={size} radius={radius} style={style} />;
  return (
    <Image
      source={{ uri: imageUrl }}
      style={[
        { width: size, height: size, borderRadius: radius },
        style as StyleProp<ImageStyle>,
      ]}
      contentFit="cover"
      accessibilityLabel="Your photo"
    />
  );
}
