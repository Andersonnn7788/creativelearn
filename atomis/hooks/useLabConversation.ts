import { useEffect, useRef, useCallback } from 'react';
import { useVoice } from './useVoice';
import { useConversation, ConversationStatus } from './useConversation';
import { buildLabSystemPrompt, LabContext } from '../utils/labPrompt';

export function useLabConversation(labState: LabContext, isCameraReady: boolean) {
  const { speak, stop, audioLevelRef, isSpeakingRef } = useVoice();

  const initialPrompt = useRef(buildLabSystemPrompt(labState));
  const { status, lastReply, startListening, stopListening, updateSystemPrompt, injectAssistantMessage } =
    useConversation(speak, isSpeakingRef, { systemPrompt: initialPrompt.current });

  // Stable ref for injectAssistantMessage so the greeting effect doesn't depend on it
  const injectRef = useRef(injectAssistantMessage);
  injectRef.current = injectAssistantMessage;

  // Keep system prompt in sync with lab state
  const labStateRef = useRef(labState);
  labStateRef.current = labState;

  useEffect(() => {
    updateSystemPrompt(buildLabSystemPrompt(labState));
  }, [
    labState.leftElement.symbol,
    labState.rightElement.symbol,
    labState.activeCatalyst,
    labState.combinedElement?.symbol,
    labState.message,
    labState.gameState,
    labState.quizMode.active,
    updateSystemPrompt,
    // We intentionally do NOT list labState itself to avoid infinite loops
  ]);

  // --- Auto-greeting on first interaction after camera is ready ---
  const hasGreetedRef = useRef(false);
  useEffect(() => {
    if (!isCameraReady) return;

    const greetOnInteraction = async () => {
      if (hasGreetedRef.current) return;
      hasGreetedRef.current = true;

      const ctx = labStateRef.current;
      const greeting = `Welcome to the lab! I see you've got ${ctx.leftElement.name} and ${ctx.rightElement.name} loaded up. Want to try mixing them?`;
      await injectRef.current(greeting);
      // mic auto-opens via the speaking → idle effect in useConversation
    };

    // Browser autoplay policy requires a user gesture, so defer to first interaction
    document.addEventListener('pointerdown', greetOnInteraction, { once: true });
    return () => document.removeEventListener('pointerdown', greetOnInteraction);
  }, [isCameraReady]);

  // --- Proactive commentary for high-impact events ---
  const lastProactiveRef = useRef(0);
  const PROACTIVE_COOLDOWN = 8000; // 8 seconds

  const tryProactive = useCallback(
    (text: string) => {
      const now = Date.now();
      if (now - lastProactiveRef.current < PROACTIVE_COOLDOWN) return;
      // Don't interrupt active conversation
      if (status === 'listening' || status === 'thinking' || status === 'speaking') return;
      lastProactiveRef.current = now;
      injectAssistantMessage(text);
    },
    [status, injectAssistantMessage]
  );

  // Danger warning: Na + H2O + heat
  const prevDangerRef = useRef(false);
  useEffect(() => {
    const symbols = [labState.leftElement.symbol, labState.rightElement.symbol];
    const isDanger = symbols.includes('Na') && symbols.includes('H2O') && labState.activeCatalyst === 'heat';
    if (isDanger && !prevDangerRef.current) {
      tryProactive("Whoa! Sodium plus water with heat? That's an explosion waiting to happen. I'd cool it down if I were you.");
    }
    prevDangerRef.current = isDanger;
  }, [labState.leftElement.symbol, labState.rightElement.symbol, labState.activeCatalyst, tryProactive]);

  // Explosion / death
  const prevDeadRef = useRef(false);
  useEffect(() => {
    if (labState.gameState === 'dead' && !prevDeadRef.current) {
      tryProactive("BOOM! Told you that was dangerous. Sodium and water under heat is no joke — violent exothermic reaction!");
    }
    prevDeadRef.current = labState.gameState === 'dead';
  }, [labState.gameState, tryProactive]);

  // Quiz start
  const prevQuizRef = useRef(false);
  useEffect(() => {
    if (labState.quizMode.active && !prevQuizRef.current && labState.quizMode.targetName) {
      tryProactive(`Quiz time! You need to create ${labState.quizMode.targetName}. Think about which elements combine to make it.`);
    }
    prevQuizRef.current = labState.quizMode.active;
  }, [labState.quizMode.active, labState.quizMode.targetName, tryProactive]);

  return {
    speak,
    audioLevelRef,
    isSpeakingRef,
    conversationStatus: status as ConversationStatus,
    lastReply,
    startListening,
    stopListening,
  };
}
