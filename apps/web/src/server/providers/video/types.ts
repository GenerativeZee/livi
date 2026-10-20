import type { BroadcastConfig, Playback, StreamCue } from "@stealth/shared";

export interface VideoProvider {
  readonly name: "ivs" | "fake" | "local";
  broadcastConfig(streamId: string): BroadcastConfig;
  playback(streamId: string): Playback;
  /** Delivers a cue to every viewer of the stream. */
  sendCue(streamId: string, cue: StreamCue): Promise<void>;
}
