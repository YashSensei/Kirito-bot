import { computerAvatarThemes } from "@/lib/mascot/mascot";
import { colors } from "@/lib/mascot/appearance";
import { Mascot } from "./mascot";
export type CharacterLook = { shape: string; color: string };
export function CharacterPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: CharacterLook;
  onChange: (value: CharacterLook) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <fieldset disabled={disabled}>
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
              aria-pressed={value.shape === theme.shape}
              onClick={() => onChange({ ...value, shape: theme.shape })}
              className={`flex justify-center rounded-lg border p-2 transition-colors hover:bg-accent focus-visible:outline-2 ${value.shape === theme.shape ? "border-primary bg-accent" : "border-transparent"}`}
            >
              <Mascot
                shape={theme.shape}
                color={value.color}
                size={44}
                motion="none"
              />
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={disabled}>
        <legend className="mb-3 text-xs text-muted-foreground">Color</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(colors).map(([color, hex]) => (
            <button
              type="button"
              key={color}
              aria-label={`${color} character color`}
              aria-pressed={value.color === color}
              onClick={() => onChange({ ...value, color })}
              className={`rounded-full border-2 p-1 ${value.color === color ? "border-primary" : "border-transparent"}`}
            >
              <span
                className="block size-5 rounded-full"
                style={{ background: hex }}
              />
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
