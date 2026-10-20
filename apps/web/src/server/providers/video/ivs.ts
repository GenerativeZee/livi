import "server-only";
import { IvsClient, PutMetadataCommand } from "@aws-sdk/client-ivs";
import { encodeCue } from "@stealth/shared";
import { ivsEnv } from "../../env";
import type { VideoProvider } from "./types";

/**
 * AWS IVS low-latency channel. For now every stream shares the one channel from the environment;
 * per-stream channels (live_streams.ivs_channel_arn) come with stream scheduling.
 */
export function createIvsVideo(): VideoProvider {
  const env = ivsEnv();
  const client = new IvsClient({ region: env.AWS_REGION });

  return {
    name: "ivs",
    broadcastConfig: () => ({ provider: "ivs", ingestEndpoint: env.IVS_INGEST_ENDPOINT, streamKey: env.IVS_STREAM_KEY }),
    playback: () => ({ provider: "ivs", playbackUrl: env.IVS_PLAYBACK_URL }),
    // IVS puts the cue into the video itself, so viewers see it on the same frame the creator was on.
    // IVS allows about 5 PutMetadata calls per second per channel; pins are far below that.
    async sendCue(_streamId, cue) {
      await client.send(new PutMetadataCommand({ channelArn: env.IVS_CHANNEL_ARN, metadata: encodeCue(cue) }));
    },
  };
}
