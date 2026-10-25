import { describe, expect, test } from "bun:test";
import { RfbClientFilter } from "../src/computer/rfb";
function ready(control: boolean) {
  const f = new RfbClientFilter();
  f.setControl(control);
  f.push(Buffer.from("RFB 003."));
  f.push(Buffer.from("008\n\x01\x01"));
  return f;
}
const key = Buffer.from([4, 1, 0, 0, 0, 0, 0, 65]);
describe("Miles RFB input boundary", () => {
  test("blocks fragmented view-only input and allows screen requests", () => {
    const f = ready(false);
    expect(f.push(key.subarray(0, 3))).toEqual([]);
    expect(
      f.push(
        Buffer.concat([key.subarray(3), Buffer.from([5, 1, 0, 10, 0, 20])]),
      ),
    ).toEqual([]);
    expect(f.push(Buffer.from([3, 1, 0, 0, 0, 0, 0, 10, 0, 20]))).toHaveLength(
      1,
    );
  });
  test("take and return control preserve streaming and release held keys", () => {
    const f = ready(false);
    expect(f.push(key)).toEqual([]);
    f.setControl(true);
    expect(f.push(key)).toEqual([key]);
    expect(f.setControl(false)).toEqual([
      Buffer.from([4, 0, 0, 0, 0, 0, 0, 65]),
    ]);
    expect(f.push(key)).toEqual([]);
  });
  test("disconnect releases mouse buttons", () => {
    const f = ready(true);
    f.push(Buffer.from([5, 1, 0, 10, 0, 20]));
    expect(f.releaseInput()).toEqual([Buffer.from([5, 0, 0, 10, 0, 20])]);
  });
  test("rejects invalid handshakes, power controls, and oversized clipboard", () => {
    expect(() =>
      new RfbClientFilter().push(Buffer.from("RFB 003.007\n")),
    ).toThrow();
    expect(() => ready(true).push(Buffer.from([251]))).toThrow();
    expect(() =>
      ready(true).push(Buffer.from([6, 0, 0, 0, 0, 1, 255, 255])),
    ).toThrow();
  });
});
