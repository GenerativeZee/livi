import "server-only";
import { EventEmitter } from "node:events";
import { RTC_ALL_VIEWERS, RTC_HOST, type RtcEnvelope, type RtcPeer } from "@stealth/shared";

// Relays WebRTC signalling between a stream's host and its viewers (dev-only "local" provider).
// In-process, so it only works with a single server, which is all local development needs.
const globalForBus = globalThis as unknown as { rtcBus?: EventEmitter };
const bus = (globalForBus.rtcBus ??= new EventEmitter().setMaxListeners(0));

const channel = (streamId: string, peer: RtcPeer) => `${streamId}:${peer}`;

/** Viewers also hear messages addressed to every viewer (e.g. "the host just went live"). */
export function subscribeToSignals(streamId: string, peer: RtcPeer, listener: (envelope: RtcEnvelope) => void): () => void {
  const channels = [channel(streamId, peer)];
  if (peer !== RTC_HOST) channels.push(channel(streamId, RTC_ALL_VIEWERS));
  for (const c of channels) bus.on(c, listener);
  return () => {
    for (const c of channels) bus.off(c, listener);
  };
}

export function publishSignal(streamId: string, envelope: RtcEnvelope): void {
  bus.emit(channel(streamId, envelope.to), envelope);
}
