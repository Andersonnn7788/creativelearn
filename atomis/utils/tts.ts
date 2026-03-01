/**
 * ElevenLabs Text-to-Speech service
 * Returns raw ArrayBuffer so we can route through Web Audio API for analysis
 */

declare const __ELEVENLABS_API_KEY__: string | undefined;

const DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // "Adam" — deep, clear male voice

interface TTSOptions {
  voiceId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
}

export async function textToSpeech(
  text: string,
  options?: TTSOptions
): Promise<ArrayBuffer | null> {
  const apiKey =
    (import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined) ||
    (typeof __ELEVENLABS_API_KEY__ !== 'undefined' ? __ELEVENLABS_API_KEY__ : undefined);

  if (!apiKey) {
    console.warn('ElevenLabs API key not found — voice disabled');
    return null;
  }

  const voiceId =
    (import.meta.env.VITE_ELEVENLABS_VOICE_ID as string | undefined) ||
    options?.voiceId ||
    DEFAULT_VOICE_ID;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: options?.stability ?? 0.5,
            similarity_boost: options?.similarityBoost ?? 0.75,
            style: options?.style ?? 0.0,
          },
        }),
      }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`ElevenLabs API error: ${response.status} ${body}`);
    }

    return await response.arrayBuffer();
  } catch (error) {
    console.error('Error calling ElevenLabs TTS:', error);
    return null;
  }
}
