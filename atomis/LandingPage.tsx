import React, { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import SymbioteBlob from "./components/SymbioteBlob";
import { useVoice } from "./hooks/useVoice";
import { useConversation } from "./hooks/useConversation";
import { TrackingData } from "./types";

// Fullscreen Nebula Background Shader
const NebulaBackground: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    }),
    []
  );

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = state.clock.getElapsedTime();
    }
  });

  const nebulaVertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `;

  const nebulaFragmentShader = `
    uniform float uTime;
    uniform vec2 uResolution;
    varying vec2 vUv;

    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
      m = m * m;
      m = m * m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
      vec3 g;
      g.x = a0.x * x0.x + h.x * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    float fbm(vec2 st) {
      float v = 0.0;
      float a = 0.5;
      vec2 shift = vec2(100.0);
      mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
      for (int i = 0; i < 4; i++) {
        v += a * snoise(st);
        st = rot * st * 2.0 + shift;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 uv = vUv;
      float aspect = uResolution.x / uResolution.y;
      vec2 st = vec2(uv.x * aspect, uv.y);

      float t = uTime * 0.25;

      // Two noise layers at different scales/speeds for depth
      float n1 = fbm(st * 2.0 + vec2(t * 0.7, t * 0.5));
      float n2 = fbm(st * 3.5 + vec2(-t * 0.3, t * 0.8) + 50.0);
      float n3 = fbm(st * 1.2 + vec2(t * 0.2, -t * 0.4) + 100.0);

      // Combine noise layers
      float combined = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;

      // Color palette: deep navy, purple, teal
      vec3 deepNavy = vec3(0.008, 0.0, 0.063);   // #020010
      vec3 purple   = vec3(0.165, 0.032, 0.271);  // #2a0845
      vec3 teal     = vec3(0.0, 0.45, 0.65);      // deep teal
      vec3 cyan     = vec3(0.0, 0.75, 1.0);       // #00BFFF accent

      // Map noise to color
      vec3 col = deepNavy;
      col = mix(col, purple, smoothstep(-0.2, 0.3, combined));
      col = mix(col, teal, smoothstep(0.2, 0.6, combined) * 0.4);
      col = mix(col, cyan, smoothstep(0.5, 0.8, combined) * 0.15);

      // Subtle brightness variation from third layer
      col += vec3(0.02, 0.04, 0.08) * smoothstep(0.1, 0.5, n3);

      // Vignette: darken edges
      float vignette = 1.0 - smoothstep(0.3, 0.85, length(uv - 0.5));
      col *= mix(0.3, 1.0, vignette);

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  return (
    <mesh ref={meshRef} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={nebulaVertexShader}
        fragmentShader={nebulaFragmentShader}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
};

// Subtle starfield with color variation
const StarField: React.FC = () => {
  const ref = useRef<THREE.Points>(null);
  const count = 4000;

  const { positions, colors, sizes } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sz = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const r = 200 * Math.cbrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = -Math.random() * 40 + r * Math.cos(phi);

      // Color variation: warm white to cool blue
      const colorChoice = Math.random();
      if (colorChoice < 0.5) {
        // Warm white
        col[i * 3] = 1.0;
        col[i * 3 + 1] = 0.95 + Math.random() * 0.05;
        col[i * 3 + 2] = 0.85 + Math.random() * 0.15;
      } else if (colorChoice < 0.8) {
        // Cool blue-white
        col[i * 3] = 0.7 + Math.random() * 0.2;
        col[i * 3 + 1] = 0.8 + Math.random() * 0.2;
        col[i * 3 + 2] = 1.0;
      } else {
        // Faint cyan/teal
        col[i * 3] = 0.5 + Math.random() * 0.2;
        col[i * 3 + 1] = 0.9 + Math.random() * 0.1;
        col[i * 3 + 2] = 1.0;
      }

      sz[i] = Math.random() * 4.5 + 1.5;
    }

    return { positions: pos, colors: col, sizes: sz };
  }, []);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.x += delta * 0.03;
      ref.current.rotation.y += delta * 0.02;
    }
  });

  const starVertexShader = `
    attribute float aSize;
    varying vec3 vColor;
    void main() {
      vColor = color;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      gl_PointSize = aSize * (300.0 / -mvPosition.z);
    }
  `;

  const starFragmentShader = `
    varying vec3 vColor;
    void main() {
      vec2 xy = gl_PointCoord.xy - vec2(0.5);
      float r = length(xy);
      if (r > 0.5) discard;
      float glow = 1.0 - smoothstep(0.0, 0.5, r);
      float brightness = glow * glow;
      gl_FragColor = vec4(vColor * brightness, brightness * 0.9);
    }
  `;

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aSize"
          count={count}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={starVertexShader}
        fragmentShader={starFragmentShader}
        vertexColors
      />
    </points>
  );
};

// Background 3D Scene
const StarryBackground: React.FC = () => {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 60 }}>
      <NebulaBackground />
      <StarField />
    </Canvas>
  );
};

// Main Landing Page Component
const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoaded, setIsLoaded] = useState(true);
  const { speak, audioLevelRef, isSpeakingRef } = useVoice();
  const handleNavigationIntent = useCallback(() => navigate("/play"), [navigate]);
  const { status, lastReply, startListening, stopListening } = useConversation(speak, isSpeakingRef, handleNavigationIntent);
  const hasSpokenRef = useRef(false);

  // Greet on first user interaction (browser autoplay policy requires a gesture)
  useEffect(() => {
    const greetOnInteraction = async () => {
      if (hasSpokenRef.current) return;
      hasSpokenRef.current = true;
      await speak("Welcome to Atomis. I'm Venom, your chemistry lab assistant. Ready to start experimenting?");
      // Wait for TTS playback to finish, then auto-open mic
      await new Promise<void>((resolve) => {
        const check = () => {
          if (!isSpeakingRef.current) resolve();
          else requestAnimationFrame(check);
        };
        setTimeout(check, 100);
      });
      startListening();
    };

    document.addEventListener('pointerdown', greetOnInteraction, { once: true });
    return () => document.removeEventListener('pointerdown', greetOnInteraction);
  }, [speak, isSpeakingRef, startListening]);

  const handleMicClick = () => {
    if (status === 'listening') {
      stopListening();
    } else if (status === 'idle' || status === 'speaking') {
      startListening();
    }
  };

  // Display text: never show the user's transcript (voice-to-voice feel)
  const displayText =
    status === 'listening'
      ? 'Listening...'
      : status === 'thinking'
      ? 'Thinking...'
      : lastReply || "Ask me anything about chemistry!";

  // Tracking data for hand interactions
  const trackingRef = useRef<TrackingData>({
    left: {
      pinchDistance: 0.3,
      isPinching: false,
      isPointing: false,
      position: { x: 0.3, y: 0.5, z: 0 },
      indexPosition: { x: 0.3, y: 0.5, z: 0 },
      isPresent: false
    },
    right: {
      pinchDistance: 0.3,
      isPinching: false,
      isPointing: false,
      position: { x: 0.7, y: 0.5, z: 0 },
      indexPosition: { x: 0.7, y: 0.5, z: 0 },
      isPresent: false
    },
    isClapping: false,
    isResetGesture: false,
    isClosedFist: false,
    isSixtySevenGesture: false,
    handDistance: 0.4,
    cameraAspect: 1.77,
  });

  return (
    <div className="relative w-full h-screen bg-black text-white overflow-hidden">
      {/* Starry Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <StarryBackground />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center h-full">
        {/* Central Card */}
        <div className="flex items-center justify-center px-6 md:px-12">
          <div
            className={`relative w-full max-w-md transition-all duration-1000 ${
              isLoaded
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-10"
            }`}
          >
            {/* Invite Card */}
            <div className="relative bg-gray-900/80 backdrop-blur-sm rounded-2xl p-8 md:p-12 border border-gray-700/50 shadow-2xl">
              {/* Textured overlay effect */}
              <div
                className="absolute inset-0 rounded-2xl opacity-30"
                style={{
                  backgroundImage: `
                    repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px),
                    repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)
                  `,
                }}
              ></div>

              {/* Water Simulation */}
              <div className="relative h-48 mb-4 md:mb-8 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 md:w-64 md:h-64">
                    <Canvas camera={{ position: [0, 0, 3], fov: 50 }}>
                      <ambientLight intensity={0.15} />
                      <pointLight
                        position={[3, 4, 3]}
                        intensity={2.0}
                        color="#ffffff"
                      />
                      <pointLight
                        position={[-3, -2, 4]}
                        intensity={0.6}
                        color="#6600aa"
                      />
                      <pointLight
                        position={[0, -4, 2]}
                        intensity={0.4}
                        color="#220044"
                      />
                      <group scale={0.7}>
                        <SymbioteBlob trackingRef={trackingRef} audioLevelRef={audioLevelRef} />
                      </group>
                    </Canvas>
                  </div>
                </div>
              </div>

              {/* Element Code */}
              <div className="relative z-10 mb-4">
                <div className="inline-block px-6 py-3 bg-gray-800/80 rounded-full border border-gray-600/50">
                  <span className="font-['Roboto_Mono'] text-white text-lg md:text-xl">
                    Venom
                  </span>
                </div>
              </div>

              {/* Inviter Info */}
              <div className="relative z-10 mb-4">
                <p className="text-sm text-gray-400 font-['Roboto_Mono']">
                  Your Chemistry Lab Assistant
                </p>
              </div>

              {/* Speech Bubble */}
              <div className="relative z-10 mb-4 min-h-[3rem] max-h-28 overflow-y-auto bg-white/5 backdrop-blur-sm rounded-xl px-4 py-3 border border-purple-500/20">
                <p className={`text-sm font-['Roboto_Mono'] leading-relaxed ${
                  status === 'listening' ? 'text-cyan-300' : status === 'thinking' ? 'text-purple-300 animate-pulse' : 'text-gray-200'
                }`}>
                  {displayText}
                </p>
              </div>

              {/* Mic Button */}
              <div className="relative z-10 flex justify-center">
                <button
                  onClick={handleMicClick}
                  disabled={status === 'thinking'}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${
                    status === 'listening'
                      ? 'bg-red-500/30 border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.4)] scale-110'
                      : status === 'thinking'
                      ? 'bg-purple-500/20 border-purple-500/40 cursor-wait'
                      : 'bg-white/5 border-gray-600/50 hover:border-purple-400/60 hover:bg-purple-500/10 hover:scale-105'
                  }`}
                >
                  {status === 'thinking' ? (
                    <svg className="w-6 h-6 text-purple-300 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg className={`w-6 h-6 ${status === 'listening' ? 'text-red-300' : 'text-gray-300'}`} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LandingPage;
