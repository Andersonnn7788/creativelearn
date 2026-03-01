/**
 * Multi-turn conversational chat via OpenAI GPT-4o Mini
 */

declare const __OPENAI_API_KEY__: string | undefined;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const VENOM_SYSTEM_PROMPT: ChatMessage = {
  role: 'system',
  content: `You are Venom, a witty chemistry lab assistant in Atomis. Dark symbiote personality — cool, edgy, passionate about science. Reply in 1-2 short sentences only. Never exceed 30 words. Be fun and educational. Steer non-chemistry questions back to science. When users ask what to do or how to prepare, give a brief helpful answer and end with "Are you ready to begin the experiment?"`,
};

export async function chatWithVenom(messages: ChatMessage[]): Promise<string> {
  const apiKey =
    (import.meta.env.VITE_OPENAI_API_KEY as string | undefined) ||
    (typeof __OPENAI_API_KEY__ !== 'undefined' ? __OPENAI_API_KEY__ : undefined);

  if (!apiKey) {
    console.warn('OpenAI API key not found — chat disabled');
    return "Hmm, my neural link is offline. Check the API key and try again!";
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 80,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('OpenAI API response:', response.status, errorBody);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;

    if (reply) {
      return reply.trim().replace(/\*\*/g, '').replace(/\*/g, '');
    }

    return "Something went wrong with my thought process. Try asking again!";
  } catch (error) {
    console.error('Error calling OpenAI chat:', error);
    return "My connection glitched out. Give it another shot!";
  }
}
