/** Miles' RFB input filter. Parse across frames; a view-only socket cannot inject input. */
export class RfbClientFilter {
  private buffer = Buffer.alloc(0);
  private phase = 0;
  private control = false;
  private keys = new Set<number>();
  private pointer = Buffer.from([5, 0, 0, 0, 0, 0]);
  setControl(control: boolean): Buffer[] {
    const releases = this.control && !control ? this.releaseInput() : [];
    this.control = control;
    return releases;
  }
  push(bytes: Uint8Array): Buffer[] {
    if (this.buffer.length + bytes.length > 128 * 1024)
      throw new Error("RFB message too large");
    this.buffer = Buffer.concat([this.buffer, bytes]);
    const out: Buffer[] = [];
    for (;;) {
      const b = this.buffer;
      if (!b.length) break;
      let length: number;
      if (this.phase === 0) length = 12;
      else if (this.phase < 3) length = 1;
      else
        switch (b[0]) {
          case 0:
            length = 20;
            break;
          case 2:
            if (b.length < 4) return out;
            if (b.readUInt16BE(2) > 256) throw new Error("RFB encodings limit");
            length = 4 + 4 * b.readUInt16BE(2);
            break;
          case 3:
            length = 10;
            break;
          case 4:
            length = 8;
            break;
          case 5:
            length = 6;
            break;
          case 6:
            if (b.length < 8) return out;
            length = 8 + Math.abs(b.readInt32BE(4));
            if (length > 64008) throw new Error("RFB clipboard limit");
            break;
          case 150:
            length = 10;
            break;
          case 248:
            if (b.length < 9) return out;
            length = 9 + b[8];
            break;
          case 255:
            if (b.length < 2) return out;
            if (b[1] !== 0) throw new Error("Unsupported RFB input");
            length = 12;
            break;
          default:
            throw new Error("Unsupported RFB message");
        }
      if (b.length < length) break;
      const message = Buffer.from(b.subarray(0, length));
      this.buffer = Buffer.from(b.subarray(length));
      if (this.phase < 3) {
        if (
          this.phase === 0
            ? message.toString() !== "RFB 003.008\n"
            : message[0] !== 1
        )
          throw new Error("Unsupported RFB handshake");
        this.phase++;
        out.push(message);
        continue;
      }
      if ([4, 5, 6, 255].includes(message[0]) && !this.control) continue;
      if (message[0] === 4 || message[0] === 255) {
        const key = message.readUInt32BE(4),
          down = message[0] === 4 ? message[1] !== 0 : message[3] !== 0;
        if (down) this.keys.add(key);
        else this.keys.delete(key);
      }
      if (message[0] === 5) this.pointer = message;
      out.push(message);
    }
    return out;
  }
  releaseInput(): Buffer[] {
    const out: Buffer[] = [];
    for (const key of this.keys) {
      const message = Buffer.alloc(8);
      message[0] = 4;
      message.writeUInt32BE(key, 4);
      out.push(message);
    }
    this.keys.clear();
    if (this.pointer[1]) {
      this.pointer[1] = 0;
      out.push(Buffer.from(this.pointer));
    }
    return out;
  }
}
const observers = new Map<string, Set<(human: boolean) => void>>();
export function publishDesktopControl(botId: string, human: boolean) {
  for (const notify of observers.get(botId) ?? []) notify(human);
}
export function subscribeDesktopControl(
  botId: string,
  notify: (human: boolean) => void,
) {
  const listeners = observers.get(botId) ?? new Set();
  listeners.add(notify);
  observers.set(botId, listeners);
  return () => {
    listeners.delete(notify);
    if (!listeners.size) observers.delete(botId);
  };
}
