export type OptionColor = {
  bg: string;
  fg: string;
};

export type ColorGroupId = "vivid" | "soft" | "cool" | "warm";

export type ColorGroup = {
  id: ColorGroupId;
  label: string;
  /** Empty / unset cell fill */
  empty: OptionColor;
  /** Palette cycled across options in order */
  colors: OptionColor[];
};

/** Saturated fills with white text — matches Stage-style cells. */
const VIVID_COLORS: OptionColor[] = [
  { bg: "#3B82F6", fg: "#ffffff" },
  { bg: "#14B8A6", fg: "#ffffff" },
  { bg: "#8B5CF6", fg: "#ffffff" },
  { bg: "#F43F5E", fg: "#ffffff" },
  { bg: "#F59E0B", fg: "#ffffff" },
  { bg: "#10B981", fg: "#ffffff" },
  { bg: "#6366F1", fg: "#ffffff" },
  { bg: "#EC4899", fg: "#ffffff" },
  { bg: "#0EA5E9", fg: "#ffffff" },
  { bg: "#84CC16", fg: "#ffffff" },
  { bg: "#A855F7", fg: "#ffffff" },
  { bg: "#EF4444", fg: "#ffffff" },
];

/** Soft Stage-style pastels with dark text. */
const SOFT_COLORS: OptionColor[] = [
  { bg: "#F7DCE3", fg: "#A31D31" },
  { bg: "#D5F0EA", fg: "#1A7A68" },
  { bg: "#DDE7FC", fg: "#2F5CF0" },
  { bg: "#F5E6CF", fg: "#9A6B20" },
  { bg: "#E9E0F8", fg: "#6B3DB5" },
  { bg: "#D9F3F1", fg: "#0F766E" },
  { bg: "#ECEEF2", fg: "#5F6775" },
  { bg: "#FCE7F3", fg: "#9D174D" },
  { bg: "#FEF3C7", fg: "#92400E" },
  { bg: "#E0E7FF", fg: "#3730A3" },
  { bg: "#CCFBF1", fg: "#115E59" },
  { bg: "#FEE2E2", fg: "#991B1B" },
];

/** Cool blues / teals — closest to the Stage column screenshot. */
const COOL_COLORS: OptionColor[] = [
  { bg: "#3B7DD8", fg: "#ffffff" },
  { bg: "#5BA8E0", fg: "#ffffff" },
  { bg: "#2FB5A8", fg: "#ffffff" },
  { bg: "#4F8CCF", fg: "#ffffff" },
  { bg: "#1A9B9B", fg: "#ffffff" },
  { bg: "#6B9FD4", fg: "#ffffff" },
  { bg: "#3A8FA8", fg: "#ffffff" },
  { bg: "#5C7CBA", fg: "#ffffff" },
  { bg: "#2A9D8F", fg: "#ffffff" },
  { bg: "#457B9D", fg: "#ffffff" },
  { bg: "#48A9A6", fg: "#ffffff" },
  { bg: "#2B6CB0", fg: "#ffffff" },
];

/** Warm oranges / reds / ambers. */
const WARM_COLORS: OptionColor[] = [
  { bg: "#E85D4C", fg: "#ffffff" },
  { bg: "#F0A202", fg: "#ffffff" },
  { bg: "#D94F70", fg: "#ffffff" },
  { bg: "#E07A3D", fg: "#ffffff" },
  { bg: "#C44536", fg: "#ffffff" },
  { bg: "#F4A261", fg: "#ffffff" },
  { bg: "#E76F51", fg: "#ffffff" },
  { bg: "#BC4749", fg: "#ffffff" },
  { bg: "#D08C45", fg: "#ffffff" },
  { bg: "#E63946", fg: "#ffffff" },
  { bg: "#F77F00", fg: "#ffffff" },
  { bg: "#9B2226", fg: "#ffffff" },
];

const EMPTY_NEUTRAL: OptionColor = { bg: "#C5CAD3", fg: "#ffffff" };
const EMPTY_SOFT: OptionColor = { bg: "#E5E7EB", fg: "#6B7280" };

export const COLOR_GROUPS: ColorGroup[] = [
  { id: "vivid", label: "Vivid", empty: EMPTY_NEUTRAL, colors: VIVID_COLORS },
  { id: "soft", label: "Soft", empty: EMPTY_SOFT, colors: SOFT_COLORS },
  { id: "cool", label: "Cool", empty: EMPTY_NEUTRAL, colors: COOL_COLORS },
  { id: "warm", label: "Warm", empty: EMPTY_NEUTRAL, colors: WARM_COLORS },
];

export const DEFAULT_COLOR_GROUP: ColorGroupId = "vivid";

const GROUP_MAP = Object.fromEntries(COLOR_GROUPS.map((group) => [group.id, group])) as Record<
  ColorGroupId,
  ColorGroup
>;

export function getColorGroup(id: ColorGroupId | undefined): ColorGroup {
  return GROUP_MAP[id ?? DEFAULT_COLOR_GROUP] ?? GROUP_MAP[DEFAULT_COLOR_GROUP];
}

/**
 * Resolve an option's fill color from its field's color group.
 * `optionColors` maps option label → palette index (overrides sequential assignment).
 */
export function resolveOptionColor(
  colorGroupId: ColorGroupId | undefined,
  value: string | null | undefined,
  enumOptions: string[] | undefined,
  optionColors?: Record<string, number>,
): OptionColor {
  const group = getColorGroup(colorGroupId);
  if (value == null || value === "") return group.empty;

  const palette = group.colors;
  if (palette.length === 0) return group.empty;

  const explicit = optionColors?.[value];
  if (typeof explicit === "number" && Number.isFinite(explicit)) {
    return palette[((explicit % palette.length) + palette.length) % palette.length];
  }

  const options = enumOptions ?? [];
  const index = options.indexOf(value);
  if (index >= 0) return palette[index % palette.length];

  // Fallback: stable hash for unknown options
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}
