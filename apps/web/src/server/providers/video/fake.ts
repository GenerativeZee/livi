import "server-only";
import { publishCue } from "./cue-bus";
import type { VideoProvider } from "./types";

/** No real video. Pins are delivered over SSE so the shopping flow can be built and tested without AWS. */
export function createFakeVideo(): VideoProvider {
  return {
    name: "fake",
    broadcastConfig: () => ({ provider: "fake" }),
    playback: (streamId) => ({ provider: "fake", cuesUrl: cuesUrl(streamId) }),
    async sendCue(streamId, cue) {
      publishCue(streamId, cue);
    },
  };
}

export const cuesUrl = (streamId: string) => `/api/spike/cues?stream=${encodeURIComponent(streamId)}`;
