// Neo-brutalist, monochrome. Black rules on white, square corners, no
// elevation. Hierarchy comes from weight, size, fill and line thickness
// instead of colour or shadow. The pinned header's frosted, gradient-masked
// backdrop is the one soft edge kept from the previous design.
export const palette = {
  paper: "#FFFFFF",
  white: "#FFFFFF",
  ink: "#000000",
  // Secondary text. 7.5:1 on white.
  muted: "#595959",
  // Decorative marks only, never running text.
  faint: "#8A8A8A",
  soft: "#EFEFEF",
  line: "#000000",
  frost: "rgba(255, 255, 255, 0.84)",
};

// Rule weights. Boxes and controls use thick; list separators use thin.
export const rule = { thin: 1, thick: 2 };

// Space Grotesk, loaded in app/_layout.tsx. Every weight is registered as its
// own family, so text styles spread one of these and never set fontWeight.
export const font = {
  regular: { fontFamily: "SpaceGrotesk_400Regular" },
  medium: { fontFamily: "SpaceGrotesk_500Medium" },
  semibold: { fontFamily: "SpaceGrotesk_600SemiBold" },
  bold: { fontFamily: "SpaceGrotesk_700Bold" },
} as const;

// A white surface boxed by a thick black rule.
export const box = {
  borderWidth: rule.thick,
  borderColor: palette.ink,
  backgroundColor: palette.white,
} as const;
