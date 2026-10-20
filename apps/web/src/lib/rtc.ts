import type { RtcEnvelope, RtcPeer, RtcSignal } from "@stealth/shared";

// Browser helpers for the dev-only "local" video provider (WebRTC between creator and viewers).

/**
 * Public STUN lets browsers on different networks find a direct route to each other.
 * There's no TURN relay, so very strict networks may not connect; on one machine or Wi-Fi it isn't needed.
 */
export const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

export function openSignals(streamId: string, peer: RtcPeer, onEnvelope: (envelope: RtcEnvelope) => void): EventSource {
  const source = new EventSource(`/api/spike/rtc/events?stream=${encodeURIComponent(streamId)}&peer=${encodeURIComponent(peer)}`);
  source.onmessage = (event) => {
    try {
      onEnvelope(JSON.parse(event.data));
    } catch {
      // Ignore anything malformed rather than break the connection.
    }
  };
  return source;
}

export function sendSignal(streamId: string, from: RtcPeer, to: RtcPeer, signal: RtcSignal): void {
  void fetch("/api/spike/rtc/signal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ streamId, from, to, signal }),
  }).catch(() => {});
}

/** For page unload, where a normal fetch may be cancelled. */
export function beaconSignal(streamId: string, from: RtcPeer, to: RtcPeer, signal: RtcSignal): void {
  navigator.sendBeacon("/api/spike/rtc/signal", JSON.stringify({ streamId, from, to, signal }));
}

/**
 * A random UUID that also works on plain-http pages (a phone on the local network):
 * crypto.randomUUID() only exists on HTTPS or localhost, crypto.getRandomValues() exists everywhere.
 */
export function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const toIceInit = (candidate: RTCIceCandidate) => ({
  candidate: candidate.candidate,
  sdpMid: candidate.sdpMid,
  sdpMLineIndex: candidate.sdpMLineIndex,
});
