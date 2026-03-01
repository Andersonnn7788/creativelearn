import { ElementData } from '../types';

/**
 * Calls OpenAI GPT-5 Mini API to generate an explanation about a newly created element/compound
 */
declare const __OPENAI_API_KEY__: string | undefined;

export async function getElementExplanation(element: ElementData): Promise<string> {
  const apiKey = (import.meta.env.VITE_OPENAI_API_KEY as string | undefined) ||
                 (typeof __OPENAI_API_KEY__ !== 'undefined' ? __OPENAI_API_KEY__ : undefined);

  if (!apiKey) {
    console.warn('OpenAI API key not found, using fallback explanation');
    return getFallbackExplanation(element);
  }

  try {
    const prompt = `You are a friendly chemistry lab assistant named Atom. A student just created ${element.name} (${element.symbol}) by mixing elements in a chemistry lab simulation.

Give a brief, engaging explanation (2-3 sentences max) about what ${element.name} is and why it's interesting or important. Be enthusiastic and educational, like you're teaching a curious student. Keep it conversational and fun.

Element details:
- Name: ${element.name}
- Symbol: ${element.symbol}
- Description: ${element.description || 'N/A'}`;

    const response = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-5-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 200,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const explanation = data.choices?.[0]?.message?.content;

    if (explanation) {
      return explanation.trim().replace(/\*\*/g, '').replace(/\*/g, '');
    }

    return getFallbackExplanation(element);
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return getFallbackExplanation(element);
  }
}

/**
 * Fallback explanation if OpenAI API fails or is unavailable
 */
function getFallbackExplanation(element: ElementData): string {
  if (element.atomicNumber === 0) {
    return `Amazing! You've created ${element.name}! This compound has unique properties that make it different from its individual elements.`;
  }
  return `Great discovery! ${element.name} is a fascinating element. ${element.description || 'It has many interesting properties and uses.'}`;
}
