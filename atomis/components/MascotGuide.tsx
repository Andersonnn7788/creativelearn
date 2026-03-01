import React, { useEffect, useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import SymbioteBlob from './SymbioteBlob';
import { getSystemMessage } from '../utils/mascot';
import { getElementExplanation } from '../utils/elementExplanation';
import { TrackingData, ElementData } from '../types';
import { ConversationStatus } from '../hooks/useConversation';

interface MascotGuideProps {
  message: string; // System message from App
  isDashboardOpen: boolean;
  trackingData: React.MutableRefObject<TrackingData>;
  combinedElement: ElementData | null; // New element that was just created
  speak?: (text: string) => Promise<boolean>;
  audioLevelRef?: React.MutableRefObject<number>;
  conversationStatus?: ConversationStatus;
  lastReply?: string;
}

const MascotGuide: React.FC<MascotGuideProps> = ({ message, isDashboardOpen, trackingData, combinedElement, speak, audioLevelRef, conversationStatus = 'idle', lastReply }) => {
  const [mascotText, setMascotText] = useState("Welcome to the Lab! I'm Atom.");
  const [isVisible, setIsVisible] = useState(true);

  // Track the element explanation
  const [geminiExplanation, setGeminiExplanation] = useState<string | null>(null);
  const [explanationStartTime, setExplanationStartTime] = useState<number | null>(null);
  const lastCombinedElementRef = useRef<string | null>(null);
  const geminiLoadingRef = useRef(false);

  // Track when the current text was actually displayed
  const lastUpdateRef = useRef<number>(Date.now());
  // Track the timeout to allow cleanup
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Conversation is "active" when it's doing anything other than idle
  const isConversationActive = conversationStatus !== 'idle';

  // Handle new element creation - call API for explanation
  useEffect(() => {
    // Only trigger when a new element is successfully created (not errors like BOOM or X)
    if (combinedElement &&
        combinedElement.symbol !== 'BOOM' &&
        combinedElement.symbol !== 'X' &&
        combinedElement.symbol !== lastCombinedElementRef.current &&
        (message.includes('FUSION SUCCESS') || message.includes('QUIZ SUCCESS'))) {

      // If we have a previous explanation, ensure it was shown for at least 8 seconds
      if (geminiExplanation && explanationStartTime) {
        const timeShown = Date.now() - explanationStartTime;
        const minDisplayTime = 8000; // 8 seconds minimum

        if (timeShown < minDisplayTime) {
          // Wait until minimum time is reached before loading new explanation
          const remainingTime = minDisplayTime - timeShown;
          setTimeout(() => {
            // Now load the new explanation
            geminiLoadingRef.current = true;
            lastCombinedElementRef.current = combinedElement.symbol;

            getElementExplanation(combinedElement).then((explanation) => {
              setGeminiExplanation(explanation);
              setExplanationStartTime(Date.now());
              geminiLoadingRef.current = false;
            }).catch((error) => {
              console.error('Failed to get element explanation:', error);
              geminiLoadingRef.current = false;
              setGeminiExplanation(`Amazing! You've created ${combinedElement.name}! This is a fascinating compound with unique properties.`);
              setExplanationStartTime(Date.now());
            });
          }, remainingTime);
          return;
        }
      }

      // Mark that we're loading a new explanation
      geminiLoadingRef.current = true;
      lastCombinedElementRef.current = combinedElement.symbol;

      // Call API to get explanation
      getElementExplanation(combinedElement).then((explanation) => {
        setGeminiExplanation(explanation);
        setExplanationStartTime(Date.now());
        geminiLoadingRef.current = false;
      }).catch((error) => {
        console.error('Failed to get element explanation:', error);
        geminiLoadingRef.current = false;
        // Use fallback
        setGeminiExplanation(`Amazing! You've created ${combinedElement.name}! This is a fascinating compound with unique properties.`);
        setExplanationStartTime(Date.now());
      });
    }

    // Clear explanation when combinedElement is cleared (user resets/clears)
    // But ensure it was shown for at least 8 seconds
    if (!combinedElement && geminiExplanation && explanationStartTime) {
      const timeShown = Date.now() - explanationStartTime;
      const minDisplayTime = 8000; // 8 seconds minimum

      if (timeShown < minDisplayTime) {
        // Wait until minimum time is reached
        const timeoutId = setTimeout(() => {
          setGeminiExplanation(null);
          setExplanationStartTime(null);
          lastCombinedElementRef.current = null;
        }, minDisplayTime - timeShown);
        return () => clearTimeout(timeoutId);
      } else {
        setGeminiExplanation(null);
        setExplanationStartTime(null);
        lastCombinedElementRef.current = null;
      }
    }
  }, [combinedElement, message, geminiExplanation, explanationStartTime]);

  // Update text immediately when element explanation is ready
  // Guard: skip speaking if conversation is active to prevent audio collisions
  useEffect(() => {
    if (geminiExplanation) {
      setMascotText(geminiExplanation);
      lastUpdateRef.current = Date.now();
      // Only speak if conversation is NOT active
      if (speak && !isConversationActive) {
        speak(geminiExplanation);
      }
      return;
    }
  }, [geminiExplanation, speak, isConversationActive]);

  // Sync system message to mascot speech with smart timing
  // BUT: Don't show system message if we have an active element explanation
  useEffect(() => {
    // If we have an active element explanation, prioritize it over system messages
    if (geminiExplanation && explanationStartTime) {
      // Keep showing element explanation as long as combinedElement exists
      // or until minimum 8 seconds have passed
      const timeShown = Date.now() - explanationStartTime;
      if (combinedElement || timeShown < 8000) {
        setMascotText(geminiExplanation);
        return;
      }
    }

    // Only show system messages if no active element explanation
    if (!geminiExplanation) {
      const nextText = getSystemMessage(message);
      const isIdle = message.includes("LAB READY");

      const scheduleUpdate = () => {
          const now = Date.now();
          // How long has the *current* message been visible?
          const timeVisible = now - lastUpdateRef.current;

          // Default reaction delay
          let delay = 500;

          if (isIdle) {
              // If switching back to Idle, ensure the previous message
              // was shown for at least 3 seconds.
              const minDuration = 3000;
              if (timeVisible < minDuration) {
                  delay = minDuration - timeVisible;
              }
          }

          // Clear previous pending update
          if (timeoutRef.current) clearTimeout(timeoutRef.current);

          timeoutRef.current = setTimeout(() => {
              setMascotText(nextText);
              lastUpdateRef.current = Date.now(); // Reset timer upon actual update
          }, delay);
      };

      scheduleUpdate();

      return () => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }
  }, [message, geminiExplanation, explanationStartTime, combinedElement]);

  // Hide mascot when dashboard is open (since dashboard has its own)
  useEffect(() => {
    setIsVisible(!isDashboardOpen);
  }, [isDashboardOpen]);

  if (!isVisible) return null;

  // Display priority: conversation reply > element explanation > system message
  let displayText = mascotText;
  if (conversationStatus === 'listening') {
    displayText = 'Listening...';
  } else if (conversationStatus === 'thinking') {
    displayText = 'Thinking...';
  } else if (conversationStatus === 'speaking' && lastReply) {
    displayText = lastReply;
  }

  // Status dot color
  const statusDotColor =
    conversationStatus === 'listening' ? 'bg-red-500 shadow-red-500/50' :
    conversationStatus === 'thinking' ? 'bg-purple-500 shadow-purple-500/50' :
    conversationStatus === 'speaking' ? 'bg-green-500 shadow-green-500/50' :
    '';

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none overflow-visible ">
       {/* Speech Bubble */}
       <div className="mb-2 max-w-xs bg-white/10 backdrop-blur-md border border-purple-500/30 p-4 rounded-t-2xl rounded-bl-2xl rounded-br-none text-right shadow-[0_0_20px_rgba(168,85,247,0.2)] animate-bounce-slight origin-bottom-right transform transition-all relative">
          {/* Status indicator dot */}
          {statusDotColor && (
            <div className={`absolute top-2 left-2 w-2.5 h-2.5 rounded-full ${statusDotColor} shadow-lg ${conversationStatus === 'listening' ? 'animate-pulse' : ''}`} />
          )}
          <p className={`text-purple-100 font-mono text-sm leading-relaxed ${
            conversationStatus === 'listening' ? 'text-cyan-300' :
            conversationStatus === 'thinking' ? 'text-purple-300 animate-pulse' :
            ''
          }`}>
            {displayText}
          </p>
       </div>

       {/* 3D Blob Container */}
       <div className="w-40 h-40 relative group pointer-events-auto overflow-visible">
          {/* Glow Effect */}
          <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-3xl group-hover:bg-purple-500/40 transition-all duration-500"></div>

          {/* Container */}
          <div className="w-full h-full relative z-10 pointer-events-auto">
             <Canvas camera={{ position: [0, 0, 3], fov: 50 }} gl={{ alpha: true }}>
               <ambientLight intensity={0.15} />
               <pointLight position={[3, 4, 3]} intensity={2.0} color="#ffffff" />
               <pointLight position={[-3, -2, 4]} intensity={0.6} color="#6600aa" />
               <group scale={0.7}>
                 <SymbioteBlob trackingRef={trackingData} audioLevelRef={audioLevelRef} />
               </group>
             </Canvas>
          </div>
       </div>

       <style>{`
         @keyframes bounce-slight {
           0%, 100% { transform: translateY(0); }
           50% { transform: translateY(-5px); }
         }
         .animate-bounce-slight {
           animation: bounce-slight 3s ease-in-out infinite;
         }
       `}</style>
    </div>
  );
};

export default MascotGuide;
