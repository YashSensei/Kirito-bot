import { botColor, colors } from "./appearance";

export type MascotMood =
  | "idle"
  | "working"
  | "thinking"
  | "typing"
  | "writing"
  | "searching"
  | "connecting"
  | "updating"
  | "success"
  | "error"
  | "sleeping"
  | "waiting"
  | "offline"
  | "launch";
export type MascotMotion = "full" | "screen" | "none";

// Sidebar metadata is optional on older workspace snapshots.
export function sidebarNotifications(snapshot: unknown): Set<string> {
  const agents =
    (
      snapshot as {
        sidebar?: { agents?: { agent_id: string; unread?: boolean }[] };
      } | null
    )?.sidebar?.agents ?? [];
  return new Set(
    agents.filter((agent) => agent.unread).map((agent) => agent.agent_id),
  );
}
export type MascotBody =
  | "classic"
  | "tilted"
  | "outline"
  | "compact"
  | "cd"
  | "cassette"
  | "radio"
  | "chat"
  | "handheld"
  | "pager"
  | "camera"
  | "turntable"
  | "floppy";
export type MascotExpression =
  | "open"
  | "sleepy"
  | "curious"
  | "determined"
  | "happy"
  | "sleeping";

export type MascotFrame = {
  id: string;
  file: string;
  alt: string;
};

export type ComputerAvatarTheme = {
  id: string;
  shape: string;
  label: string;
  frame: number;
  body: MascotBody;
  expression: MascotExpression;
};

export const mascotFrames: MascotFrame[] = [
  {
    id: "classic-front",
    file: "01_classic-front.png",
    alt: "Kirito-bot mascot looking ahead",
  },
  {
    id: "sleepy-orange",
    file: "02_sleepy-orange.png",
    alt: "Kirito-bot mascot looking sleepy",
  },
  {
    id: "outline-retro",
    file: "03_outline-retro.png",
    alt: "Kirito-bot mascot in a retro outline",
  },
  {
    id: "blue-peek",
    file: "04_blue-peek.png",
    alt: "Kirito-bot mascot peeking over a blue wave",
  },
  {
    id: "surprised-cream",
    file: "05_surprised-cream.png",
    alt: "Kirito-bot mascot looking surprised",
  },
  {
    id: "angry-purple",
    file: "06_angry-purple.png",
    alt: "Kirito-bot mascot looking determined",
  },
  {
    id: "cloud-floating",
    file: "07_cloud-floating.png",
    alt: "Kirito-bot mascot floating in a cloud",
  },
  {
    id: "x-eyes-yellow",
    file: "08_x-eyes-yellow.png",
    alt: "Kirito-bot mascot with playful crossed eyes",
  },
  {
    id: "sleeping-pink",
    file: "09_sleeping-pink.png",
    alt: "Kirito-bot mascot asleep",
  },
  {
    id: "geometric-green",
    file: "10_geometric-green.png",
    alt: "Kirito-bot mascot in a geometric green pose",
  },
  {
    id: "excited-green",
    file: "11_excited-green.png",
    alt: "Kirito-bot mascot celebrating",
  },
  {
    id: "minimal-cream",
    file: "12_minimal-cream.png",
    alt: "Kirito-bot mascot in a minimal cream pose",
  },
  {
    id: "blue-night",
    file: "13_blue-night.png",
    alt: "Kirito-bot mascot resting in a blue night scene",
  },
  {
    id: "happy-cream",
    file: "14_happy-cream.png",
    alt: "Kirito-bot mascot smiling",
  },
  {
    id: "classic-orange",
    file: "15_classic-orange.png",
    alt: "Kirito-bot mascot ready to go",
  },
  {
    id: "classic-dark",
    file: "16_classic-dark.png",
    alt: "Kirito-bot mascot on a dark background",
  },
  {
    id: "floating-lilac",
    file: "17_floating-lilac.png",
    alt: "Kirito-bot mascot hovering",
  },
  {
    id: "blue-wave",
    file: "18_blue-wave.png",
    alt: "Kirito-bot mascot riding a blue wave",
  },
  {
    id: "pink-alert",
    file: "19_pink-alert.png",
    alt: "Kirito-bot mascot raising an alert",
  },
  {
    id: "outline-dark",
    file: "20_outline-dark.png",
    alt: "Kirito-bot mascot in a dark outline",
  },
];

// These IDs intentionally mirror the server's existing shape keys. They are
// compatibility values only; every visible avatar is now a retro device mascot.
// The frame field identifies the original illustration, never a playback frame.
export const computerAvatarThemes: ComputerAvatarTheme[] = [
  {
    id: "classic",
    shape: "blob",
    label: "Classic CRT",
    frame: 0,
    body: "classic",
    expression: "open",
  },
  {
    id: "compact",
    shape: "cloud",
    label: "Compact PC",
    frame: 1,
    body: "compact",
    expression: "open",
  },
  {
    id: "outline",
    shape: "square",
    label: "Outline terminal",
    frame: 2,
    body: "outline",
    expression: "open",
  },
  {
    id: "cd",
    shape: "sparkle",
    label: "CD player",
    frame: 3,
    body: "cd",
    expression: "open",
  },
  {
    id: "cassette",
    shape: "clover",
    label: "Cassette player",
    frame: 4,
    body: "cassette",
    expression: "open",
  },
  {
    id: "radio",
    shape: "heart",
    label: "Retro radio",
    frame: 5,
    body: "radio",
    expression: "open",
  },
  {
    id: "chat",
    shape: "flower",
    label: "Chat terminal",
    frame: 6,
    body: "chat",
    expression: "open",
  },
  {
    id: "handheld",
    shape: "teardrop",
    label: "Handheld console",
    frame: 7,
    body: "handheld",
    expression: "open",
  },
  {
    id: "pager",
    shape: "tablet",
    label: "Pocket pager",
    frame: 8,
    body: "pager",
    expression: "open",
  },
  {
    id: "camera",
    shape: "wedge",
    label: "Compact camera",
    frame: 9,
    body: "camera",
    expression: "open",
  },
  {
    id: "turntable",
    shape: "house",
    label: "Record player",
    frame: 10,
    body: "turntable",
    expression: "open",
  },
  {
    id: "floppy",
    shape: "star",
    label: "Floppy disk",
    frame: 11,
    body: "floppy",
    expression: "open",
  },
  {
    id: "tilted",
    shape: "hex",
    label: "Tilted CRT",
    frame: 12,
    body: "tilted",
    expression: "open",
  },
];

export function computerTheme(shape?: string): ComputerAvatarTheme {
  return (
    computerAvatarThemes.find((theme) => theme.shape === shape) ??
    computerAvatarThemes[0]
  );
}

export function mascotAccent(color?: string, variant = "miles"): string {
  return colors[botColor(color, variant)];
}

export function mascotUrl(frame: MascotFrame): string {
  return `/mascot/${frame.file}`;
}

type Control = { x: number; y: number; r: number };
type DeviceBody = {
  file: string;
  face: string;
  buttons: Control[];
  disc?: { x: number; y: number; rx: number; ry: number; angle: number };
  reels?: Control[];
  dial?: Control;
  lens?: Control;
};
export const mascotBodies: Record<MascotBody, DeviceBody> = {
  classic: {
    file: "/mascot/rig/classic-body.webp",
    face: "translate(60.5 43.5) rotate(-3) skewX(7)",
    buttons: [
      { x: 48, y: 68, r: 1.6 },
      { x: 80, y: 67.5, r: 1.6 },
    ],
  },
  compact: {
    file: "/mascot/rig/compact-body.webp",
    face: "translate(57.5 41.5) scale(.9)",
    buttons: [
      { x: 44, y: 76, r: 1.3 },
      { x: 56, y: 75.5, r: 1.3 },
      { x: 69, y: 76, r: 1.3 },
    ],
  },
  tilted: {
    file: "/mascot/rig/tilted-body.webp",
    face: "translate(59.5 42.7) rotate(-21) skewX(7)",
    buttons: [],
  },
  outline: {
    file: "/mascot/rig/outline-body.webp",
    face: "translate(61.5 43) rotate(-4) skewX(7)",
    buttons: [],
  },
  cd: {
    file: "/mascot/rig/cd-body.webp",
    face: "translate(79 61.5) rotate(-13) scale(.32 .4)",
    buttons: [
      { x: 57, y: 67, r: 1.8 },
      { x: 65, y: 66, r: 1.8 },
    ],
    disc: { x: 50.3, y: 40.5, rx: 23.6, ry: 14.6, angle: 8 },
  },
  cassette: {
    file: "/mascot/rig/cassette-body.webp",
    face: "translate(58 32.5) rotate(2) scale(.83 .75)",
    buttons: [
      { x: 46, y: 76, r: 1.6 },
      { x: 74, y: 75.5, r: 1.6 },
    ],
    reels: [
      { x: 48.5, y: 57.3, r: 4.4 },
      { x: 69.1, y: 57.3, r: 4.4 },
    ],
  },
  radio: {
    file: "/mascot/rig/radio-body.webp",
    face: "translate(76 42) scale(.56 .7)",
    buttons: [],
    dial: { x: 79, y: 62.2, r: 6.1 },
  },
  chat: {
    file: "/mascot/rig/chat-body.webp",
    face: "translate(62.5 41.5) rotate(-2) scale(.92)",
    buttons: [
      { x: 53, y: 76, r: 1.4 },
      { x: 64, y: 76, r: 1.4 },
      { x: 77, y: 76, r: 1.4 },
    ],
  },
  handheld: {
    file: "/mascot/rig/handheld-body.webp",
    face: "translate(56.3 38) rotate(2) scale(.82 .96)",
    buttons: [
      { x: 65, y: 71, r: 2.7 },
      { x: 73, y: 65.7, r: 2.7 },
    ],
  },
  pager: {
    file: "/mascot/rig/pager-body.webp",
    face: "translate(61 49) rotate(-2) scale(1.08 .65)",
    buttons: [
      { x: 43, y: 66.5, r: 1.8 },
      { x: 80, y: 64.5, r: 1.8 },
    ],
  },
  camera: {
    file: "/mascot/rig/camera-body.webp",
    face: "translate(74.5 49.5) scale(.53 .7)",
    buttons: [{ x: 30, y: 27, r: 2.2 }],
    lens: { x: 44, y: 54, r: 11.2 },
  },
  turntable: {
    file: "/mascot/rig/turntable-body.webp",
    face: "translate(60.3 64) rotate(-4) scale(.7 .33)",
    buttons: [],
    disc: { x: 45.6, y: 45.1, rx: 20.3, ry: 9, angle: 5 },
  },
  floppy: {
    file: "/mascot/rig/floppy-body.webp",
    face: "translate(60.3 59) rotate(1) scale(1.08 .95)",
    buttons: [],
  },
};

// Recolor the blue material only. A separate blue-material mask in the SVG
// preserves the warm cream casing, black display and original paper texture.
export function mascotTint(color?: string, variant = "miles"): string {
  const hex = mascotAccent(color, variant).slice(1);
  const channels = [0, 2, 4].map(
    (offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255,
  );
  const changes = channels.map(
    (channel, index) => (channel - [0.02, 0.4, 1][index]) / 0.98,
  );
  return `${1 - changes[0]} 0 ${changes[0]} 0 0 ${-changes[1]} 1 ${changes[1]} 0 0 ${-changes[2]} 0 ${1 + changes[2]} 0 0 0 0 0 1 0`;
}
