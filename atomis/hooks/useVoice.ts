import { useRef, useCallback, useEffect } from 'react';
import { textToSpeech } from '../utils/tts';

export function useVoice() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const rafIdRef = useRef<number>(0);
  const audioLevelRef = useRef<number>(0);
  const isSpeakingRef = useRef<boolean>(false);

  // Lazy-init AudioContext + AnalyserNode (autoplay-policy safe)
  const ensureAudioCtx = useCallback(async () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyser.connect(audioCtxRef.current.destination);
      analyserRef.current = analyser;
    }
    // Resume if suspended (autoplay policy)
    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
    return { ctx: audioCtxRef.current, analyser: analyserRef.current! };
  }, []);

  // RMS amplitude loop — writes to audioLevelRef (0–1)
  const startLevelLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (!isSpeakingRef.current) {
        audioLevelRef.current = 0;
        return;
      }
      analyser.getByteTimeDomainData(data);

      // Compute RMS
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128; // -1..1
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      // Normalize to 0–1 (speech RMS is usually 0.05–0.3)
      audioLevelRef.current = Math.min(rms * 4, 1);

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);
  }, []);

  const stop = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {
        // already stopped
      }
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    isSpeakingRef.current = false;
    audioLevelRef.current = 0;
    cancelAnimationFrame(rafIdRef.current);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      // Cancel any in-progress playback
      stop();

      const audioBuffer = await textToSpeech(text);
      if (!audioBuffer) return; // No API key or error — silent

      try {
        const { ctx, analyser } = await ensureAudioCtx();

        const decoded = await ctx.decodeAudioData(audioBuffer.slice(0));

        const playDecoded = () => {
          const source = ctx.createBufferSource();
          source.buffer = decoded;
          source.connect(analyser);
          sourceRef.current = source;

          isSpeakingRef.current = true;
          startLevelLoop();

          source.onended = () => {
            isSpeakingRef.current = false;
            audioLevelRef.current = 0;
            cancelAnimationFrame(rafIdRef.current);
            sourceRef.current = null;
          };

          source.start();
        };

        // If context is still suspended (no user gesture yet), defer playback
        if (ctx.state === 'suspended') {
          const handler = async () => {
            document.removeEventListener('click', handler);
            document.removeEventListener('pointerdown', handler);
            try {
              await ctx.resume();
              playDecoded();
            } catch (e) {
              console.error('Failed to resume AudioContext on user gesture:', e);
            }
          };
          document.addEventListener('click', handler, { once: true });
          document.addEventListener('pointerdown', handler, { once: true });
        } else {
          playDecoded();
        }
      } catch (e) {
        console.error('useVoice.speak() failed:', e);
        isSpeakingRef.current = false;
        audioLevelRef.current = 0;
      }
    },
    [stop, ensureAudioCtx, startLevelLoop]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, [stop]);

  return { speak, stop, audioLevelRef, isSpeakingRef };
}
