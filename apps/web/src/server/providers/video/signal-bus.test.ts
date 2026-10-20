import { describe, expect, it } from "vitest";
import { RTC_ALL_VIEWERS, RTC_HOST, type RtcEnvelope } from "@stealth/shared";
import { publishSignal, subscribeToSignals } from "./signal-bus";

const stream = crypto.randomUUID();
const otherStream = crypto.randomUUID();
const [alice, bob] = [crypto.randomUUID(), crypto.randomUUID()];

function listen(streamId: string, peer: string) {
  const received: RtcEnvelope[] = [];
  const stop = subscribeToSignals(streamId, peer, (e) => received.push(e));
  return { received, stop };
}

describe("signal bus", () => {
  it("delivers to one peer, to every viewer, and never across streams", () => {
    const host = listen(stream, RTC_HOST);
    const a = listen(stream, alice);
    const b = listen(stream, bob);
    const elsewhere = listen(otherStream, alice);

    publishSignal(stream, { from: alice, to: RTC_HOST, signal: { kind: "join" } });
    publishSignal(stream, { from: RTC_HOST, to: alice, signal: { kind: "offer", sdp: "v=0" } });
    publishSignal(stream, { from: RTC_HOST, to: RTC_ALL_VIEWERS, signal: { kind: "host-ready" } });

    expect(host.received.map((e) => e.signal.kind)).toEqual(["join"]);
    expect(a.received.map((e) => e.signal.kind)).toEqual(["offer", "host-ready"]);
    expect(b.received.map((e) => e.signal.kind)).toEqual(["host-ready"]);
    expect(elsewhere.received).toHaveLength(0);

    for (const l of [host, a, b, elsewhere]) l.stop();
  });

  it("stops delivering after unsubscribing", () => {
    const a = listen(stream, alice);
    a.stop();
    publishSignal(stream, { from: RTC_HOST, to: RTC_ALL_VIEWERS, signal: { kind: "leave" } });
    expect(a.received).toHaveLength(0);
  });
});
