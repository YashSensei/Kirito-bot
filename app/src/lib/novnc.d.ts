declare module "@novnc/novnc" {
  export default class RFB extends EventTarget {
    constructor(
      target: HTMLElement,
      url: string,
      options?: { shared?: boolean },
    );
    viewOnly: boolean;
    scaleViewport: boolean;
    resizeSession: boolean;
    qualityLevel: number;
    compressionLevel: number;
    showDotCursor: boolean;
    background: string;
    disconnect(): void;
    focus(): void;
    blur(): void;
    clipboardPasteFrom(text: string): void;
    sendKey(keysym: number, code: string, down?: boolean): void;
  }
}
