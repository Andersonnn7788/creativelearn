import { useState, useRef, useCallback, useEffect } from 'react';
import { chatWithVenom, ChatMessage, VENOM_SYSTEM_PROMPT } from '../utils/chat';

export type ConversationStatus = 'idle' | 'listening' | 'thinking' | 'speaking';

interface SpeechRecognitionEvent {
  results: { [index: number]: { [index: number]: { transcript: string } } };
  resultIndex: number;
}

// Detects when Venom's reply asks if the user is ready to begin
const READY_QUESTION_PATTERN = /ready.{0,40}(experiment|begin|start)/i;

// Detects affirmative user responses
const AFFIRMATIVE_PATTERN = /\b(yes|yeah|yep|sure|ready|i'?m ready|let'?s go|absolutely|ok|okay|go|do it)\b/i;

export function useConversation(
  speak: (text: string) => Promise<void>,
  isSpeakingRef: React.MutableRefObject<boolean>,
  onNavigationIntent?: () => void
) {
  const [status, setStatus] = useState<ConversationStatus>('idle');
  const [lastReply, setLastReply] = useState('');
  const messagesRef = useRef<ChatMessage[]>([VENOM_SYSTEM_PROMPT]);
  const recognitionRef = useRef<any>(null);
  // Tracks whether Venom has asked the user if they're ready to begin
  const venomAskedReadyRef = useRef(false);
  // Tracks previous status to detect speaking → idle transitions
  const prevStatusRef = useRef<ConversationStatus>('idle');

  const processUserInput = useCallback(
    async (userText: string) => {
      if (!userText.trim()) {
        setStatus('idle');
        return;
      }

      // If Venom already asked "are you ready?" and user is affirming — navigate
      if (venomAskedReadyRef.current && onNavigationIntent && AFFIRMATIVE_PATTERN.test(userText)) {
        onNavigationIntent();
        return;
      }

      // Add user message to history
      messagesRef.current = [
        ...messagesRef.current,
        { role: 'user', content: userText },
      ];

      setStatus('thinking');

      // Get AI response
      const reply = await chatWithVenom(messagesRef.current);

      // Add assistant reply to history
      messagesRef.current = [
        ...messagesRef.current,
        { role: 'assistant', content: reply },
      ];

      // Check if Venom asked about readiness in this reply
      if (READY_QUESTION_PATTERN.test(reply)) {
        venomAskedReadyRef.current = true;
      }

      setLastReply(reply);
      setStatus('speaking');

      // Speak the reply via ElevenLabs TTS
      await speak(reply);

      // Wait for TTS playback to finish
      await new Promise<void>((resolve) => {
        const check = () => {
          if (!isSpeakingRef.current) {
            resolve();
          } else {
            requestAnimationFrame(check);
          }
        };
        // Small delay to let isSpeakingRef update
        setTimeout(check, 100);
      });

      setStatus('idle');
    },
    [speak, isSpeakingRef, onNavigationIntent]
  );

  const startListening = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setLastReply("Your browser doesn't support speech recognition. Try Chrome or Edge!");
      return;
    }

    // Stop any ongoing recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    setStatus('listening');

    let finalTranscript = '';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < Object.keys(event.results).length; i++) {
        const result = event.results[i];
        if (result && result[0] && (result as any).isFinal) {
          finalTranscript += result[0].transcript;
        }
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      if (finalTranscript.trim()) {
        processUserInput(finalTranscript.trim());
      } else {
        setStatus('idle');
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      recognitionRef.current = null;
      if (event.error !== 'aborted') {
        setStatus('idle');
      }
    };

    recognition.start();
  }, [processUserInput]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  // Auto-activate mic after Venom finishes speaking
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (prev === 'speaking' && status === 'idle') {
      const timer = setTimeout(() => startListening(), 600);
      return () => clearTimeout(timer);
    }
  }, [status, startListening]);

  return { status, lastReply, startListening, stopListening };
}
