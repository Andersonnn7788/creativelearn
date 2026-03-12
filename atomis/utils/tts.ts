/**
 * ElevenLabs Text-to-Speech service (proxied through /api/tts)
 * Returns raw ArrayBuffer so we can route through Web Audio API for analysis
 */

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
  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voiceId: options?.voiceId,
        voice_settings: {
          stability: options?.stability ?? 0.5,
          similarity_boost: options?.similarityBoost ?? 0.75,
          style: options?.style ?? 0.0,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`TTS API error: ${response.status} ${body}`);
    }

    return await response.arrayBuffer();
  } catch (error) {
    console.error('Error calling TTS API:', error);
    return null;
  }
}
