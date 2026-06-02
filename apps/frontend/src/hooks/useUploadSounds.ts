import { useEffect, useRef } from 'react';
import type { UploadZonePhase } from './useUpload';

const TICK_TOCK_SRC = '/audio%20files/tick-tock.mp3';
const SUCCESS_SRC = '/audio%20files/success.mp3';

function playFromStart(audio: HTMLAudioElement) {
  audio.pause();
  audio.currentTime = 0;
  void audio.play().catch(() => {});
}

function stopAudio(audio: HTMLAudioElement) {
  audio.pause();
  audio.currentTime = 0;
}

export function useUploadSounds(zonePhase: UploadZonePhase) {
  const tickTockRef = useRef<HTMLAudioElement | null>(null);
  const successRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const tickTock = new Audio(TICK_TOCK_SRC);
    tickTock.loop = false;
    tickTock.preload = 'auto';

    const success = new Audio(SUCCESS_SRC);
    success.loop = false;
    success.preload = 'auto';

    tickTockRef.current = tickTock;
    successRef.current = success;

    return () => {
      stopAudio(tickTock);
      stopAudio(success);
      tickTockRef.current = null;
      successRef.current = null;
    };
  }, []);

  useEffect(() => {
    const tickTock = tickTockRef.current;
    const success = successRef.current;
    if (!tickTock || !success) return;

    if (zonePhase === 'uploading') {
      stopAudio(success);
      playFromStart(tickTock);
      return;
    }

    stopAudio(tickTock);

    if (zonePhase === 'success') {
      playFromStart(success);
    } else {
      stopAudio(success);
    }
  }, [zonePhase]);
}
