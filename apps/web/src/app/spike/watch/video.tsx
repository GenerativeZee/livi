"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { decodeCue, type StreamCue } from "@stealth/shared";

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

/** Fake provider: no video, just a backdrop. Pin cues arrive over Server-Sent Events. */
export function FakeVideo({ cuesUrl, title, onCue, onStatus }: VideoProps & { cuesUrl: string; title: string }) {
  useEffect(() => {
    const source = new EventSource(cuesUrl);
    source.onopen = () => onStatus("playing");
    source.onerror = () => onStatus("offline"); // EventSource reconnects by itself
    source.onmessage = (event) => {
      const cue = decodeCue(event.data);
      if (cue) onCue(cue);
    };
    return () => source.close();
  }, [cuesUrl, onCue, onStatus]);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-fuchsia-950 via-zinc-950 to-black p-8 text-center">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mt-2 text-xs text-zinc-400">Simulated stream: no video in development. Pins from the creator page appear below.</p>
    </div>
  );
}
