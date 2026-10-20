import "server-only";
import { EventEmitter } from "node:events";
import type { StreamCue } from "@stealth/shared";

// Pin cues for the providers without IVS ("fake" and "local") travel through this in-process bus
// to the Server-Sent Events route. It lives on globalThis because Next.js can load route modules
// more than once in development.
const globalForBus = globalThis as unknown as { cueBus?: EventEmitter };
const bus = (globalForBus.cueBus ??= new EventEmitter().setMaxListeners(0));

export function subscribeToCues(streamId: string, listener: (cue: StreamCue) => void): () => void {
  bus.on(streamId, listener);
  return () => bus.off(streamId, listener);
}

export function publishCue(streamId: string, cue: StreamCue): void {
  bus.emit(streamId, cue);
}
