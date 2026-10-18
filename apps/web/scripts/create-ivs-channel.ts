// Creates the IVS channel used by the Phase 0 spikes and prints the env lines to paste into .env.local.
// Usage: npm run spike:ivs-channel   (needs AWS credentials and AWS_REGION in apps/web/.env.local)
import { CreateChannelCommand, IvsClient } from "@aws-sdk/client-ivs";

const region = process.env.AWS_REGION;
if (!region) {
  console.error("Set AWS_REGION in apps/web/.env.local first (e.g. ap-south-1).");
  process.exit(1);
}

const { channel, streamKey } = await new IvsClient({ region }).send(
  new CreateChannelCommand({
    name: `spike-${Date.now()}`,
    latencyMode: "LOW",
    type: "STANDARD",
    tags: { project: "stealth", phase: "0" },
  }),
);

if (!channel?.arn || !streamKey?.value) throw new Error("IVS did not return a channel and stream key");

console.log(`\nChannel created. Add these to apps/web/.env.local:\n
IVS_CHANNEL_ARN=${channel.arn}
IVS_INGEST_ENDPOINT=${channel.ingestEndpoint}
IVS_STREAM_KEY=${streamKey.value}
IVS_PLAYBACK_URL=${channel.playbackUrl}
`);
