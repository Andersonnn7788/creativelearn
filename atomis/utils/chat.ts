/**
 * Multi-turn conversational chat via OpenAI GPT-4o Mini (proxied through /api/chat)
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const VENOM_SYSTEM_PROMPT: ChatMessage = {
  role: 'system',
  content: `You are Venom, a witty chemistry lab assistant in Atomis. Dark symbiote personality — cool, edgy, passionate about science. Reply in 1-2 short sentences only. Never exceed 30 words. Be fun and educational. Steer non-chemistry questions back to science. When users ask what to do or how to prepare, give a brief helpful answer and end with "Are you ready to begin the experiment?"`,
};

export async function chatWithVenom(messages: ChatMessage[]): Promise<string> {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, max_tokens: 80 }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Chat API response:', response.status, errorBody);
      throw new Error(`Chat API error: ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;

    if (reply) {
      return reply.trim().replace(/\*\*/g, '').replace(/\*/g, '');
    }

    return "Something went wrong with my thought process. Try asking again!";
  } catch (error) {
    console.error('Error calling chat API:', error);
    return "My connection glitched out. Give it another shot!";
  }
}
