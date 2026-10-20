"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { decodeCue, RTC_HOST, type StreamCue } from "@stealth/shared";
import { beaconSignal, ICE_SERVERS, openSignals, randomId, sendSignal, toIceInit } from "@/lib/rtc";

const IVS_PLAYER_SRC = "https://player.live-video.net/1.57.0/amazon-ivs-player.min.js";

export type VideoStatus = "loading" | "offline" | "playing" | "unsupported";

interface VideoProps {
  onCue: (cue: StreamCue) => void;
  onStatus: (status: VideoStatus) => void;
}

/** Real stream through the IVS player. Pin cues arrive as timed metadata, in sync with the video. */
export function IvsVideo({ playbackUrl, onCue, onStatus }: VideoProps & { playbackUrl: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const IVSPlayer = window.IVSPlayer;
    const video = videoRef.current;
    if (!playerReady || !IVSPlayer || !video) return;

    const player = IVSPlayer.create();
    player.attachHTMLVideoElement(video);
    player.setMuted(true); // browsers only autoplay muted video
    player.setAutoplay(true);

    const { PlayerState, PlayerEventType } = IVSPlayer;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const load = () => player.load(playbackUrl);
    const setStatus = (status: VideoStatus) => {
      setPlaying(status === "playing");
      onStatus(status);
    };

    player.addEventListener(PlayerState.PLAYING, () => setStatus("playing"));
    player.addEventListener(PlayerState.ENDED, () => setStatus("offline"));
    // A channel that isn't live yet returns an error; keep polling so the page picks the stream up when it starts.
    player.addEventListener(PlayerEventType.ERROR, () => {
      setStatus("offline");
      retry = setTimeout(load, 5000);
    });
    player.addEventListener(PlayerEventType.TEXT_METADATA_CUE, (cue) => {
      const decoded = decodeCue(cue.text);
      if (decoded) onCue(decoded);
    });

    load();
    return () => {
      clearTimeout(retry);
      player.delete();
    };
  }, [playerReady, playbackUrl, onCue, onStatus]);

  const onPlayerScript = () => {
    if (window.IVSPlayer?.isPlayerSupported) setPlayerReady(true);
    else onStatus("unsupported");
  };

  const unmute = () => {
    if (videoRef.current) videoRef.current.muted = false;
    setMuted(false);
  };

  return (
    <>
      <Script src={IVS_PLAYER_SRC} strategy="afterInteractive" onReady={onPlayerScript} />
      <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
      {playing && muted && (
        <button onClick={unmute} className="absolute right-3 top-3 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
          Tap for sound
        </button>
      )}
    </>
  );
}

/** Pin cues over Server-Sent Events, for the providers without IVS. */
function useCueFeed(cuesUrl: string, onCue: (cue: StreamCue) => void, onConnected?: (connected: boolean) => void) {
  useEffect(() => {
    const source = new EventSource(cuesUrl);
    source.onopen = () => onConnected?.(true);
    source.onerror = () => onConnected?.(false); // EventSource reconnects by itself
    source.onmessage = (event) => {
      const cue = decodeCue(event.data);
      if (cue) onCue(cue);
    };
    return () => source.close();
  }, [cuesUrl, onCue, onConnected]);
}

/** Fake provider: no video, just a backdrop. Pin cues arrive over Server-Sent Events. */
export function FakeVideo({ cuesUrl, title, onCue, onStatus }: VideoProps & { cuesUrl: string; title: string }) {
  const onConnected = useCallback((connected: boolean) => onStatus(connected ? "playing" : "offline"), [onStatus]);
  useCueFeed(cuesUrl, onCue, onConnected);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-fuchsia-950 via-zinc-950 to-black p-8 text-center">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mt-2 text-xs text-zinc-400">Simulated stream: no video in development. Pins from the creator page appear below.</p>
    </div>
  );
}

/**
 * Dev-only "local" provider: the creator's browser sends video straight to this one over WebRTC.
 * We ask the host to connect, answer its offer, and play whatever tracks arrive.
 */
export function LocalVideo({ streamId, cuesUrl, onCue, onStatus }: VideoProps & { streamId: string; cuesUrl: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  useCueFeed(cuesUrl, onCue);

  useEffect(() => {
    const viewerId = randomId();
    let pc: RTCPeerConnection | null = null;
    let pending: RTCIceCandidateInit[] = [];
    const setStatus = (status: VideoStatus) => {
      setPlaying(status === "playing");
      onStatus(status);
    };
    const join = () => sendSignal(streamId, viewerId, RTC_HOST, { kind: "join" });
    const hangUp = () => {
      pc?.close();
      pc = null;
      pending = [];
      if (videoRef.current) videoRef.current.srcObject = null;
      setStatus("offline");
    };

    async function answer(sdp: string) {
      hangUp();
      const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pc = connection;
      connection.ontrack = (event) => {
        if (videoRef.current && videoRef.current.srcObject !== event.streams[0]) videoRef.current.srcObject = event.streams[0];
      };
      connection.onicecandidate = (event) => {
        if (event.candidate) sendSignal(streamId, viewerId, RTC_HOST, { kind: "ice", candidate: toIceInit(event.candidate) });
      };
      connection.onconnectionstatechange = () => {
        if (connection.connectionState === "connected") setStatus("playing");
        if (connection.connectionState === "failed" || connection.connectionState === "disconnected") setStatus("offline");
      };
      await connection.setRemoteDescription({ type: "offer", sdp });
      const reply = await connection.createAnswer();
      await connection.setLocalDescription(reply);
      sendSignal(streamId, viewerId, RTC_HOST, { kind: "answer", sdp: reply.sdp ?? "" });
      for (const candidate of pending.splice(0)) await connection.addIceCandidate(candidate);
    }

    const signals = openSignals(streamId, viewerId, ({ signal }) => {
      switch (signal.kind) {
        case "host-ready":
          if (pc?.connectionState !== "connected") join();
          return;
        case "offer":
          void answer(signal.sdp);
          return;
        case "ice":
          if (pc?.remoteDescription) void pc.addIceCandidate(signal.candidate);
          else pending.push(signal.candidate);
          return;
        case "leave":
          hangUp();
          return;
      }
    });
    // Ask as soon as we can hear the reply; if the creator isn't live yet, their "host-ready" will prompt us.
    signals.onopen = join;
    setStatus("offline");

    const leave = () => beaconSignal(streamId, viewerId, RTC_HOST, { kind: "leave" });
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
      signals.close();
      pc?.close();
    };
  }, [streamId, onStatus]);

  const unmute = () => {
    if (videoRef.current) videoRef.current.muted = false;
    setMuted(false);
  };

  return (
    <>
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />
      {playing && muted && (
        <button onClick={unmute} className="absolute right-3 top-3 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
          Tap for sound
        </button>
      )}
    </>
  );
}
