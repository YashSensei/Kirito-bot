import { appearanceOf, Mascot } from "./mascot";
export function AbstractAvatar({
  name,
  seed,
  size = 40,
}: {
  name: string;
  seed: string;
  size?: number;
}) {
  return <Mascot {...appearanceOf(seed)} name={name} size={size} />;
}
