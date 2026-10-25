import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetTitle,
} from "@/components/ui/sheet";
import { createAgentMutationOptions } from "@/lib/agents/mutations";
import { queryClient } from "@/query-client";
import { Mascot } from "./mascot";
import { CharacterPicker, type CharacterLook } from "./character-picker";
export function NewBotSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        className="gap-0 data-[side=right]:w-[calc(100%-1rem)] data-[side=right]:sm:max-w-xl"
        side="right"
        variant="inset"
      >
        <SheetTitle className="sr-only">Create Bot</SheetTitle>
        <CreateBotForm onCreated={onCreated} />
      </SheetContent>
    </Sheet>
  );
}
function CreateBotForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [name, setName] = useState(""),
    [title, setTitle] = useState(""),
    [visibility, setVisibility] = useState<"private" | "public">("private"),
    [instructions, setInstructions] = useState(""),
    [look, setLook] = useState<CharacterLook>({ shape: "blob", color: "blue" });
  const create = useMutation(createAgentMutationOptions(queryClient));
  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim() || create.isPending) return;
        try {
          const bot = await create.mutateAsync({
            name: name.trim(),
            title: title.trim() || "Assistant",
            roleDescription:
              instructions.trim() ||
              `You are ${name.trim()}. Help the user clearly and briefly. Use your connected tools when needed.`,
            visibility,
            avatarSeed: `miles:${look.shape}:${look.color}`,
          });
          onCreated(bot.id);
        } catch {
          /* Error is rendered below. */
        }
      }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mb-5 flex items-center gap-4">
          <Mascot
            {...look}
            size={80}
            mood={create.isPending ? "launch" : "thinking"}
          />
          <div>
            <h2 className="text-xl font-medium">Create your bot</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Give it a name and make it yours.
            </p>
          </div>
        </div>
        <label className="mb-4 block text-sm">
          Name
          <Input
            id="new-bot-name"
            className="mt-2"
            autoFocus
            value={name}
            maxLength={80}
            required
            onChange={(e) => setName(e.target.value)}
            placeholder="Research Assistant"
          />
        </label>
        <label className="mb-4 block text-sm">
          Role / title <span className="text-muted-foreground">(optional)</span>
          <Input
            className="mt-2"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Assistant"
          />
        </label>
        <fieldset className="mb-5">
          <legend className="mb-2 text-sm">Who can use this bot?</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["private", "public"] as const).map((option) => (
              <button
                type="button"
                key={option}
                aria-pressed={visibility === option}
                onClick={() => setVisibility(option)}
                className={`rounded-lg border p-3 text-left text-sm ${visibility === option ? "border-primary bg-accent" : "border-border"}`}
              >
                <span className="font-medium">
                  {option === "private" ? "Private" : "Public"}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {option === "private"
                    ? "Only you can use this bot."
                    : "Everyone in your workspace can use it."}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
        <CharacterPicker
          value={look}
          onChange={setLook}
          disabled={create.isPending}
        />
        <label className="mt-5 block text-sm">
          Instructions <span className="text-muted-foreground">(optional)</span>
          <Textarea
            id="new-bot-instructions"
            className="mt-2"
            value={instructions}
            maxLength={1000}
            rows={3}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="What should this bot help you with?"
          />
        </label>
        <p className="mt-3 text-xs text-muted-foreground">
          Uses your configured OpenAI model.
        </p>
        {create.error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {create.error.message}
          </p>
        )}
      </div>
      <SheetFooter className="flex-row justify-between border-t">
        <SheetClose render={<Button variant="ghost" />}>Cancel</SheetClose>
        <Button type="submit" disabled={!name.trim() || create.isPending}>
          {create.isPending ? "Creating…" : "Create Bot"}
        </Button>
      </SheetFooter>
    </form>
  );
}
