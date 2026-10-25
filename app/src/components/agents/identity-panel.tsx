import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { IconPalette } from "@tabler/icons-react";
import { agentKeys, type AgentProfile } from "@/lib/agents/queries";
import { client } from "@/lib/client";
import { computerAvatarThemes } from "@/lib/mascot/mascot";
import { colors } from "@/lib/mascot/appearance";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { appearanceOf, Mascot } from "./mascot";
export function IdentityPanel({ agent }: { agent: AgentProfile }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <IconPalette className="size-4" />
        Name & appearance
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Make it yours</DialogTitle>
          <DialogDescription>
            Choose your bot’s name, character and color.
          </DialogDescription>
          <IdentityForm
            key={`${agent.id}:${open}`}
            agent={agent}
            done={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
function IdentityForm({
  agent,
  done,
}: {
  agent: AgentProfile;
  done: () => void;
}) {
  const [name, setName] = useState(agent.name),
    [look, setLook] = useState(appearanceOf(agent.avatarSeed));
  const queries = useQueryClient();
  const save = useMutation({
    mutationFn: async () => {
      await client(`/api/agents/${encodeURIComponent(agent.id)}/identity`, {
        method: "PATCH",
        body: {
          name: name.trim(),
          avatarSeed: `miles:${look.shape}:${look.color}`,
        },
      });
    },
    onSuccess: async () => {
      await queries.invalidateQueries({ queryKey: agentKeys.all });
      done();
    },
  });
  return (
    <form
      className="flex min-h-0 flex-col gap-4 overflow-auto"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="flex items-center gap-4">
        <Mascot {...look} size={76} mood="thinking" />
        <label className="flex-1 text-sm">
          Bot name
          <input
            autoFocus
            className="mt-2 w-full rounded-md border bg-background px-3 py-2"
            value={name}
            maxLength={80}
            required
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      </div>
      <fieldset disabled={save.isPending}>
        <legend className="mb-2 text-xs text-muted-foreground">
          Character
        </legend>
        <div className="grid grid-cols-5 gap-2">
          {computerAvatarThemes.map((theme) => (
            <button
              type="button"
              key={theme.id}
              aria-label={theme.label}
              title={theme.label}
              aria-pressed={look.shape === theme.shape}
              onClick={() => setLook({ ...look, shape: theme.shape })}
              className={`flex justify-center rounded-lg border p-2 transition-colors hover:bg-accent focus-visible:outline-2 ${look.shape === theme.shape ? "border-primary bg-accent" : "border-transparent"}`}
            >
              <Mascot
                shape={theme.shape}
                color={look.color}
                size={44}
                motion="none"
              />
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={save.isPending}>
        <legend className="mb-3 text-xs text-muted-foreground">Color</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(colors).map(([color, hex]) => (
            <button
              type="button"
              key={color}
              aria-label={`${color} character color`}
              aria-pressed={look.color === color}
              onClick={() => setLook({ ...look, color })}
              className={`rounded-full p-1 border-2 ${look.color === color ? "border-primary" : "border-transparent"}`}
            >
              <span
                className="block size-5 rounded-full"
                style={{ background: hex }}
              />
            </button>
          ))}
        </div>
      </fieldset>
      {save.error && (
        <p role="alert" className="text-sm text-destructive">
          {save.error.message}
        </p>
      )}
      <Button type="submit" disabled={save.isPending || !name.trim()}>
        {save.isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
