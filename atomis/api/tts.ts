import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ElevenLabs API key not configured' });
  }

  try {
    const { text, voiceId, voice_settings } = req.body;
    const resolvedVoiceId = voiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: voice_settings ?? {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      return res.status(response.status).json({ error: errorBody });
    }

    const arrayBuffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    return res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error('ElevenLabs proxy error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
