export const shapes = [
  "blob",
  "cloud",
  "square",
  "sparkle",
  "clover",
  "heart",
  "flower",
  "teardrop",
  "tablet",
  "wedge",
  "house",
  "star",
  "hex",
];
export const colors: Record<string, string> = {
  black: "#ffffff",
  brown: "#c9915c",
  red: "#ff5265",
  orange: "#ff8a32",
  yellow: "#ffd052",
  green: "#30df8b",
  cyan: "#30d6dc",
  blue: "#4595ff",
  violet: "#b18aff",
  magenta: "#ff58b5",
  gray: "#abb5c2",
};
export function botColor(color?: string, variant = "miles") {
  const aliases: Record<string, string> = {
    cream: "yellow",
    sage: "green",
    clay: "brown",
  };
  const legacy: Record<string, string> = {
    miles: "yellow",
    scout: "green",
    archie: "brown",
    olive: "cyan",
    atlas: "blue",
    luna: "violet",
  };
  return colors[color ?? ""]
    ? color!
    : (aliases[color ?? ""] ?? legacy[variant] ?? "yellow");
}
