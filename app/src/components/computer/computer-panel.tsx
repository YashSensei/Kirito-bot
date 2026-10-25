import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconArrowsMaximize, IconMoon } from "@tabler/icons-react";
import { client } from "@/lib/client";
import { agentQueryOptions } from "@/lib/agents/queries";
import { useComputerControl } from "@/lib/computers/use-control";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Mascot, appearanceOf } from "../agents/mascot";
import { IdentityPanel } from "../agents/identity-panel";
import { ActivityLog } from "./activity-log";
import { ComputerControlButton } from "./computer-controls";
import { DesktopScreen } from "./desktop-screen";
type Status = {
  state: "ready" | "absent" | "starting" | "unreachable";
  reason?: string;
};
export function ComputerViewPanel(props: { agentId: string; name?: string }) {
  return <ComputerPanel key={props.agentId} {...props} />;
}
function ComputerPanel({ agentId, name }: { agentId: string; name?: string }) {
  const queryClient = useQueryClient(),
    base = `/api/computers/${encodeURIComponent(agentId)}`,
    queryKey = ["computer-status", agentId];
  const status = useQuery({
    queryKey,
    queryFn: async ({ signal }): Promise<Status> =>
      (await client(`${base}/status`, { signal })).json(),
    refetchInterval: 4000,
    retry: false,
  });
  const agent = useQuery(agentQueryOptions(agentId));
  const { control } = useComputerControl(agentId);
  const [expandedTarget, setExpandedTarget] = useState<HTMLDivElement | null>(
    null,
  );
  const [expanded, setExpanded] = useState(false),
    [streamProblem, setStreamProblem] = useState<string | null>(null),
    [retry, setRetry] = useState(0);
  const action = useMutation({
    mutationFn: async (kind: "wake" | "sleep") => {
      setExpanded(false);
      setStreamProblem(null);
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, { state: "starting" });
      await client(`${base}/${kind === "wake" ? "wake" : "computers/stop"}`, {
        method: "POST",
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
  const ready = status.data?.state === "ready" && !action.isPending,
    changing = action.isPending || status.data?.state === "starting";
  const driving = control?.holder === "human" && !control.transitioning,
    look = appearanceOf(agent.data?.avatarSeed),
    title = agent.data?.name ?? name ?? "Kirito-bot";
  const problem =
    action.error?.message ?? status.error?.message ?? status.data?.reason;
  const screen = (
    <DesktopScreen
      computerId={agentId}
      fit={Boolean(expanded && expandedTarget)}
      portalTarget={expanded ? expandedTarget : null}
      driving={driving}
      onProblem={setStreamProblem}
      retryKey={retry}
    />
  );
  return (
    <section
      aria-label="Computer sidebar"
      className="kritovas-computer flex flex-col gap-5 p-4"
    >
      <header className="flex items-center gap-2">
        <Mascot
          {...look}
          size={34}
          mood={changing ? "launch" : ready ? "idle" : "sleeping"}
          motion="screen"
        />
        <div className="flex-1">
          <h3 className="text-sm font-medium">{title}’s computer</h3>
          <p className="text-xs text-muted-foreground" role="status">
            {changing
              ? action.variables === "sleep"
                ? "Going to sleep…"
                : "Waking up…"
              : ready
                ? driving
                  ? "You’re in control"
                  : "Live desktop"
                : "Sleeping"}
          </p>
        </div>
        {ready && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Sleep computer"
            onClick={() => action.mutate("sleep")}
          >
            <IconMoon />
          </Button>
        )}
      </header>
      {ready ? (
        <>
          <div className="overflow-hidden rounded-lg border bg-black min-h-40">
            {screen}
          </div>
          <div className="flex items-center justify-between gap-2">
            <ComputerControlButton
              computerId={agentId}
              onTakeControl={() => setExpanded(true)}
            />
            <Button size="sm" variant="ghost" onClick={() => setExpanded(true)}>
              <IconArrowsMaximize className="size-4" />
              Expand
            </Button>
          </div>
        </>
      ) : (
        <button
          type="button"
          aria-label="Wake computer"
          disabled={changing || status.isPending}
          onClick={() => action.mutate("wake")}
          className="flex aspect-[1.6] w-full flex-col items-center justify-center gap-2 rounded-lg border bg-background transition-colors hover:bg-accent disabled:cursor-wait"
        >
          <Mascot
            {...look}
            size={100}
            mood={changing ? "launch" : "sleeping"}
            motion="screen"
          />
          <span className="text-sm">
            {changing
              ? "Preparing your computer…"
              : status.isPending
                ? "Checking computer…"
                : "Click to wake computer"}
          </span>
          <span className="text-xs text-muted-foreground">
            Your files and sessions stay here.
          </span>
        </button>
      )}
      {problem && (
        <p role="alert" className="text-xs text-destructive">
          {problem}
        </p>
      )}
      {streamProblem && (
        <div role="alert" className="text-xs text-destructive">
          {streamProblem}
          <Button size="sm" variant="ghost" onClick={() => setRetry(retry + 1)}>
            Reconnect
          </Button>
        </div>
      )}
      {agent.data?.canCustomize && <IdentityPanel agent={agent.data} />}
      <p className="text-xs text-muted-foreground">
        Sleeps automatically after 10 minutes without activity. Tools wake it
        when needed.
      </p>
      <div className="border-t pt-4">
        <h3 className="mb-3 text-xs font-medium text-muted-foreground">
          Activity
        </h3>
        <ActivityLog computerId={agentId} />
      </div>
      <Dialog open={expanded && ready} onOpenChange={setExpanded}>
        <DialogContent className="h-[94dvh] max-h-[94dvh] w-[96vw] max-w-none overflow-hidden">
          <DialogTitle>{title}’s computer</DialogTitle>
          <DialogDescription>
            {driving
              ? "You’re in control. Click and type on the desktop."
              : "Watch your bot’s live desktop."}
          </DialogDescription>
          <div
            ref={setExpandedTarget}
            className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg border bg-black"
          />
          <ComputerControlButton computerId={agentId} />
        </DialogContent>
      </Dialog>
    </section>
  );
}
