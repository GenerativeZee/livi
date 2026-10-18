import "server-only";
import { IvsClient, PutMetadataCommand } from "@aws-sdk/client-ivs";
import { encodeCue, type StreamCue } from "@stealth/shared";
import { ivsEnv } from "./env";

let client: IvsClient | undefined;

/**
 * Injects a cue into the live stream. IVS delivers it to every player alongside
 * the video frame being broadcast at that moment, which keeps pins in sync with the video.
 * IVS allows about 5 PutMetadata calls per second per channel; pins are far below that.
 */
export async function sendStreamCue(cue: StreamCue): Promise<void> {
  const env = ivsEnv();
  client ??= new IvsClient({ region: env.AWS_REGION });
  await client.send(new PutMetadataCommand({ channelArn: env.IVS_CHANNEL_ARN, metadata: encodeCue(cue) }));
}
