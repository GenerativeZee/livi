import { RTC_ALL_VIEWERS, RTC_HOST, type RtcEnvelope } from "@stealth/shared";
import { ICE_SERVERS, openSignals, sendSignal, toIceInit } from "@/lib/rtc";

interface ViewerConnection {
  pc: RTCPeerConnection;
  /** ICE candidates that arrived before the viewer's answer; WebRTC can't take them until then. */
  pending: RTCIceCandidateInit[];
}

/**
 * The creator's side of the dev-only "local" video provider: one WebRTC connection per viewer,
 * each sending the creator's camera and microphone. Viewers ask to join; the host sends an offer.
 */
export class LocalHost {
  private viewers = new Map<string, ViewerConnection>();
  private events: EventSource | null = null;

  constructor(
    private readonly streamId: string,
    private readonly media: MediaStream,
    private readonly onViewerCount: (count: number) => void,
  ) {}

  start(): void {
    this.events = openSignals(this.streamId, RTC_HOST, (envelope) => void this.handle(envelope));
    // Also fires after a reconnect, so viewers who were waiting ask again.
    this.events.onopen = () => sendSignal(this.streamId, RTC_HOST, RTC_ALL_VIEWERS, { kind: "host-ready" });
  }

  stop(): void {
    sendSignal(this.streamId, RTC_HOST, RTC_ALL_VIEWERS, { kind: "leave" });
    this.events?.close();
    this.events = null;
    for (const id of [...this.viewers.keys()]) this.drop(id);
  }

  private async handle({ from, signal }: RtcEnvelope): Promise<void> {
    const viewer = this.viewers.get(from);
    switch (signal.kind) {
      case "join":
        return this.connect(from);
      case "answer":
        if (!viewer) return;
        await viewer.pc.setRemoteDescription({ type: "answer", sdp: signal.sdp });
        for (const candidate of viewer.pending.splice(0)) await viewer.pc.addIceCandidate(candidate);
        return;
      case "ice":
        if (!viewer) return;
        if (viewer.pc.remoteDescription) await viewer.pc.addIceCandidate(signal.candidate);
        else viewer.pending.push(signal.candidate);
        return;
      case "leave":
        return this.drop(from);
    }
  }

  private async connect(viewerId: string): Promise<void> {
    this.drop(viewerId); // a viewer that rejoins (e.g. after a refresh) starts fresh
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.viewers.set(viewerId, { pc, pending: [] });

    for (const track of this.media.getTracks()) pc.addTrack(track, this.media);
    pc.onicecandidate = (event) => {
      if (event.candidate) sendSignal(this.streamId, RTC_HOST, viewerId, { kind: "ice", candidate: toIceInit(event.candidate) });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") this.drop(viewerId);
      else this.reportCount();
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal(this.streamId, RTC_HOST, viewerId, { kind: "offer", sdp: offer.sdp ?? "" });
  }

  private drop(viewerId: string): void {
    const viewer = this.viewers.get(viewerId);
    if (!viewer) return;
    this.viewers.delete(viewerId);
    viewer.pc.onconnectionstatechange = null;
    viewer.pc.close();
    this.reportCount();
  }

  private reportCount(): void {
    this.onViewerCount([...this.viewers.values()].filter((v) => v.pc.connectionState === "connected").length);
  }
}
