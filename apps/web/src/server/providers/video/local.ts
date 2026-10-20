import "server-only";
import { publishCue } from "./cue-bus";
import { cuesUrl } from "./fake";
import type { VideoProvider } from "./types";

/**
 * Development only: the creator's browser sends video straight to each viewer's browser over WebRTC,
 * with our server relaying just the connection setup. Pins work as with the fake provider.
 *
 * Every viewer gets its own connection from the creator's device, so this suits a handful of viewers
 * on one machine or one Wi-Fi network. It says nothing about real streaming quality; that's what IVS is for.
 */
export function createLocalVideo(): VideoProvider {
  return {
    name: "local",
    broadcastConfig: () => ({ provider: "local" }),
    playback: (streamId) => ({ provider: "local", cuesUrl: cuesUrl(streamId) }),
    async sendCue(streamId, cue) {
      publishCue(streamId, cue);
    },
  };
}
