// Neo-brutalist structure — black-boxed rules, square corners, no elevation —
// with the web workspace's own color tokens (odoo-client/app/globals.css,
// light theme), converted from OKLCH to sRGB. Hierarchy still comes from
// weight, size, fill and line thickness; color marks brand and active state,
// it does not decorate every surface.
export const palette = {
  paper: "#FFFFFF",
  white: "#FFFFFF",
  // Site foreground, oklch(0.3211 0 0). Was pure black.
  ink: "#333333",
  // Site muted-foreground, oklch(0.5103 0 0). 6:1 on white.
  muted: "#666666",
  // Site ring, oklch(0.665 0.015 286.067). Decorative marks only, never running text.
  faint: "#93939D",
  // Site secondary/muted surface, oklch(0.9581 0 0).
  soft: "#F1F1F1",
  line: "#333333",
  // Site brand, oklch(0.5436 0.1913 267.08). The one accent color: selected
  // and active state, primary actions, chart lines and progress fill —
  // mirroring how the web dashboard uses it for charts and highlights.
  accent: "#3E63DD",
  accentForeground: "#FFFFFF",
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

// A white surface boxed by a thick rule.
export const box = {
  borderWidth: rule.thick,
  borderColor: palette.ink,
  backgroundColor: palette.white,
} as const;
