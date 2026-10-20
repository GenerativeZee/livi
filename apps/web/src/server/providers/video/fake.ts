import "server-only";
import { EventEmitter } from "node:events";
import type { StreamCue } from "@stealth/shared";
import type { VideoProvider } from "./types";

// Cues travel through an in-process event bus to the Server-Sent Events route.
// It lives on globalThis because Next.js can load route modules more than once in development.
const globalForBus = globalThis as unknown as { fakeCueBus?: EventEmitter };
const bus = (globalForBus.fakeCueBus ??= new EventEmitter().setMaxListeners(0));

export function subscribeToCues(streamId: string, listener: (cue: StreamCue) => void): () => void {
  bus.on(streamId, listener);
  return () => bus.off(streamId, listener);
}

/** No real video. Pins are delivered over SSE so the shopping flow can be built and tested without AWS. */
export function createFakeVideo(): VideoProvider {
  return {
    name: "fake",
    broadcastConfig: () => ({ provider: "fake" }),
    playback: (streamId) => ({ provider: "fake", cuesUrl: `/api/spike/cues?stream=${encodeURIComponent(streamId)}` }),
    async sendCue(streamId, cue) {
      bus.emit(streamId, cue);
    },
  };
}
