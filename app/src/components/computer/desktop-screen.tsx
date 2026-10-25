import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type RFB from "@novnc/novnc";
import { socketUrl } from "@/lib/socket-url";
import { Mascot } from "../agents/mascot";
/** Miles' noVNC viewer, using a private server relay and the original bot ownership controls. */
export function DesktopScreen({
  computerId,
  driving,
  fit = false,
  retryKey = 0,
  onProblem,
  portalTarget,
}: {
  portalTarget?: HTMLElement | null;
  computerId: string;
  driving: boolean;
  fit?: boolean;
  retryKey?: number;
  onProblem?: (message: string | null) => void;
}) {
  // The noVNC-owned DOM survives moving between the sidebar and expanded dialog.
  const [surface] = useState(() => {
    const node = document.createElement("div");
    node.className = "absolute inset-0 overflow-hidden [&_canvas]:outline-none";
    return node;
  });
  const attach = useCallback(
    (host: HTMLDivElement | null) => {
      if (host) host.appendChild(surface);
    },
    [surface],
  );
  const viewer = useRef<RFB | null>(null),
    drivingRef = useRef(driving);
  const [ready, setReady] = useState(false);
  const [reconnect, setReconnect] = useState(0);
  const failures = useRef(0);
  drivingRef.current = driving;
  useEffect(() => {
    let cancelled = false,
      firstFrame: ReturnType<typeof setTimeout> | undefined,
      reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    const deadline = setTimeout(() => {
      if (!cancelled)
        onProblem?.("The desktop did not connect. Reconnect to try again.");
    }, 15_000);
    setReady(false);
    onProblem?.(null);
    void import("@novnc/novnc")
      .then(({ default: RFB }) => {
        if (cancelled) return;
        const rfb = new RFB(
          surface,
          socketUrl(
            `/api/computers/${encodeURIComponent(computerId)}/stream?desktop=true`,
          ),
          { shared: true },
        );
        viewer.current = rfb;
        rfb.viewOnly = !drivingRef.current;
        rfb.scaleViewport = true;
        rfb.resizeSession = false;
        rfb.qualityLevel = 8;
        rfb.compressionLevel = 2;
        rfb.showDotCursor = false;
        rfb.background = "#090909";
        rfb.addEventListener("connect", () => {
          const painted = () => {
            if (cancelled) return;
            const canvas = surface.querySelector("canvas");
            if (
              canvas?.width &&
              canvas.height &&
              canvas.getContext("2d")?.getImageData(0, 0, 1, 1).data[3]
            ) {
              clearTimeout(deadline);
              setReady(true);
              failures.current = 0;
              onProblem?.(null);
              if (drivingRef.current) rfb.focus();
            } else firstFrame = setTimeout(painted, 50);
          };
          painted();
        });
        rfb.addEventListener("disconnect", () => {
          if (!cancelled) {
            clearTimeout(deadline);
            setReady(false);
            if (failures.current < 3) {
              failures.current++;
              onProblem?.("Reconnecting to the live desktop…");
              reconnectTimer = setTimeout(() => { if (!cancelled) setReconnect(value => value + 1); }, 1000 * failures.current);
            } else onProblem?.("Desktop disconnected. Reconnect to continue.");
          }
        });
        rfb.addEventListener("securityfailure", () => {
          if (!cancelled)
            onProblem?.(
              "Desktop authentication failed. Reconnect to continue.",
            );
        });
      })
      .catch(() => {
        if (!cancelled) onProblem?.("Could not load the desktop viewer.");
      });
    return () => {
      cancelled = true;
      clearTimeout(deadline);
      clearTimeout(firstFrame);
      clearTimeout(reconnectTimer);
      viewer.current?.disconnect();
      viewer.current = null;
    };
  }, [computerId, retryKey, reconnect, onProblem, surface]);
  useEffect(() => {
    const rfb = viewer.current;
    if (rfb) {
      rfb.viewOnly = !driving;
      if (driving && ready) rfb.focus();
    }
  }, [driving, ready, portalTarget]);
  const viewport = (
    <div
      className={`relative overflow-hidden bg-[#090909] ${fit ? "h-full w-full" : "aspect-[1.6] w-full"}`}
      role="region"
      aria-label={driving ? "Remote desktop control" : "Live remote desktop"}
    >
      <div
        ref={attach}
        className="absolute inset-0 overflow-hidden [&_canvas]:outline-none"
        data-desktop-ready={ready}
      />
      {!ready && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#090909] text-sm text-muted-foreground">
          <Mascot size={50} mood="connecting" motion="screen" />
          Connecting to desktop…
        </div>
      )}
    </div>
  );
  return portalTarget ? createPortal(viewport, portalTarget) : viewport;
}
