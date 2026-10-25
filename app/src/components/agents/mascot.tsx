import { useId, type CSSProperties } from "react";
import {
  computerTheme,
  mascotBodies,
  mascotTint,
  mascotAccent,
  type MascotMood,
} from "@/lib/mascot/mascot";
import { colors } from "@/lib/mascot/appearance";
import "./mascot.css";
export function appearanceOf(seed = "") {
  const [, shape, color] = seed.split(":");
  return seed.startsWith("miles:") && Object.hasOwn(colors, color ?? "")
    ? { shape, color }
    : { shape: "blob", color: "blue" };
}
/** Miles artwork, blue-material tint, and face animations adapted to React. */
export function Mascot({
  shape = "blob",
  color = "blue",
  size = 40,
  mood = "idle",
  name,
  motion = "full",
}: {
  shape?: string;
  color?: string;
  size?: number;
  mood?: MascotMood;
  name?: string;
  motion?: "full" | "screen" | "none";
}) {
  const id = useId().replace(/:/g, "");
  const theme = computerTheme(shape),
    body = mascotBodies[theme.body];
  const active =
    !["sleeping", "offline", "success", "error"].includes(mood) &&
    motion !== "none";
  const text = mood === "typing" || mood === "writing";
  return (
    <span
      className={`computer-avatar theme-${theme.id} mood-${mood} motion-${motion} ${active ? "animated" : ""} ${text ? "has-text" : ""}`}
      role={name ? "img" : undefined}
      aria-label={name}
      aria-hidden={name ? undefined : true}
      style={
        {
          width: size,
          height: size,
          "--avatar-accent": mascotAccent(color),
          "--blink-phase": "-1.7s",
          "--motion-state": "running",
        } as CSSProperties
      }
    >
      <svg className="size-full" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <filter id={`${id}-tint`} colorInterpolationFilters="sRGB">
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values={mascotTint(color)}
              result="accent"
            />
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 -2 0 2 0 0"
              result="blue-material"
            />
            <feComposite
              in="accent"
              in2="blue-material"
              operator="in"
              result="paint"
            />
            <feComposite
              in="SourceGraphic"
              in2="blue-material"
              operator="out"
              result="cream"
            />
            <feMerge>
              <feMergeNode in="cream" />
              <feMergeNode in="paint" />
            </feMerge>
          </filter>
          <clipPath id={`${id}-screen`}>
            <rect x="-16" y="-12" width="32" height="26" rx="2" />
          </clipPath>
        </defs>
        <g className="body-reveal">
          <g className="body-hover">
            <g className="body-action">
              <image
                href={body.file}
                width="100"
                height="100"
                filter={`url(#${id}-tint)`}
              />
              {body.disc && (
                <g
                  transform={`translate(${body.disc.x} ${body.disc.y}) rotate(${body.disc.angle}) scale(1 ${body.disc.ry / body.disc.rx})`}
                >
                  <g className="rotor disc">
                    <circle
                      r={body.disc.rx}
                      fill={theme.id === "turntable" ? "#1b1d22" : "#dddcd4"}
                    />
                    <circle
                      r={body.disc.rx * 0.64}
                      fill="none"
                      stroke="#111419"
                      opacity=".3"
                    />
                    <path
                      d={`M0 0L${body.disc.rx * 0.8} 0A${body.disc.rx * 0.8} ${body.disc.rx * 0.8} 0 0 0 0 ${-body.disc.rx * 0.8}Z`}
                      fill="var(--avatar-accent)"
                      opacity=".6"
                    />
                    <circle
                      r={body.disc.rx * 0.21}
                      fill="var(--avatar-accent)"
                    />
                    <circle r={body.disc.rx * 0.08} fill="#111419" />
                  </g>
                </g>
              )}
              {body.reels?.map((reel, i) => (
                <g key={i} transform={`translate(${reel.x} ${reel.y})`}>
                  <g className="rotor reel">
                    <circle r={reel.r} fill="#dddcd4" />
                    <path
                      d={`M0 ${-reel.r}V${reel.r}M${-reel.r} 0H${reel.r}`}
                      stroke="#111419"
                    />
                  </g>
                </g>
              ))}
              {body.buttons.map((button, i) =>
                active && text ? (
                  <circle
                    key={i}
                    className="hardware-key"
                    cx={button.x}
                    cy={button.y}
                    r={button.r}
                    fill="var(--avatar-accent)"
                  />
                ) : null,
              )}
              <g transform={body.face}>
                <g className="face-spacing">
                  <g className="gaze">
                    <g
                      className="blink"
                      fill="#f5efe2"
                      stroke="#f5efe2"
                      strokeLinecap="round"
                    >
                      {mood === "sleeping" || mood === "offline" ? (
                        <path
                          d="M-13 1q4 4 8 0M5 1q4 4 8 0"
                          fill="none"
                          strokeWidth="2.4"
                        />
                      ) : mood === "success" ? (
                        <path
                          d="M-13 1q4-8 8 0M5 1q4-8 8 0"
                          fill="none"
                          strokeWidth="2.8"
                        />
                      ) : (
                        <>
                          <ellipse
                            cx="-9"
                            rx="2.8"
                            ry={mood === "waiting" ? 4.3 : 6}
                          />
                          <ellipse
                            cx="9"
                            rx="2.8"
                            ry={mood === "waiting" ? 4.3 : 6}
                          />
                        </>
                      )}
                    </g>
                  </g>
                </g>
                <g
                  clipPath={`url(#${id}-screen)`}
                  fill="none"
                  stroke="#f5efe2"
                  strokeLinecap="round"
                >
                  {text && (
                    <>
                      <path
                        className={
                          mood === "typing" ? "code code-one" : "ink ink-one"
                        }
                        pathLength="1"
                        d="M-13 5h3m2 0h4m2 0h3m2 0h4m2 0h2"
                        strokeWidth="1.7"
                      />
                      <path
                        className="code code-two"
                        pathLength="1"
                        d="M-13 10h5m2 0h3m2 0h5m2 0h3"
                        strokeWidth="1.7"
                      />
                      <path
                        className="typing-cursor"
                        d="M-13 3v4"
                        stroke="var(--avatar-accent)"
                      />
                    </>
                  )}
                  {mood === "searching" && (
                    <path
                      className="scan"
                      d="M-13-10v23"
                      stroke="var(--avatar-accent)"
                      opacity=".4"
                    />
                  )}
                  {mood === "connecting" && (
                    <g stroke="var(--avatar-accent)">
                      <path className="connect-left" d="m-10 7 4 3-4 3" />
                      <path className="connect-right" d="m10 7-4 3 4 3" />
                    </g>
                  )}
                  {(mood === "launch" || mood === "updating") && (
                    <>
                      <path d="M-13 10h26" opacity=".25" />
                      <path
                        className="update-progress"
                        pathLength="1"
                        d="M-13 10h26"
                        stroke="var(--avatar-accent)"
                        strokeWidth="2"
                      />
                    </>
                  )}
                  {mood === "waiting" && (
                    <circle
                      className="waiting-light"
                      cy="10"
                      r="1.6"
                      fill="var(--avatar-accent)"
                    />
                  )}
                </g>
              </g>
            </g>
          </g>
        </g>
      </svg>
    </span>
  );
}
