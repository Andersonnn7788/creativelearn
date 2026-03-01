import React, { useRef, useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import WaterSimulation from "./components/WaterSimulation";
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

      sz[i] = Math.random() * 1.5 + 0.5;
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
      gl_PointSize = aSize * (200.0 / -mvPosition.z);
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
  const [isLoaded, setIsLoaded] = useState(false);

  // Mock tracking data for landing page (no hand tracking)
  const mockTrackingRef = useRef<TrackingData>({
    left: {
      pinchDistance: 0.3,
      isPinching: false,
      isPointing: false,
      position: { x: 0.3, y: 0.5, z: 0 },
    },
    right: {
      pinchDistance: 0.3,
      isPinching: false,
      isPointing: false,
      position: { x: 0.7, y: 0.5, z: 0 },
    },
    isClapping: false,
    isResetGesture: false,
    isClosedFist: false,
    handDistance: 0.4,
    cameraAspect: 1.77,
  });

  useEffect(() => {
    setIsLoaded(true);
    // Animate mock hands for visual effect
    const interval = setInterval(() => {
      const time = Date.now() * 0.001;
      mockTrackingRef.current.left.position.x = 0.3 + Math.sin(time) * 0.1;
      mockTrackingRef.current.left.position.y =
        0.5 + Math.cos(time * 0.7) * 0.1;
      mockTrackingRef.current.right.position.x =
        0.7 + Math.sin(time + Math.PI) * 0.1;
      mockTrackingRef.current.right.position.y =
        0.5 + Math.cos(time * 0.7 + Math.PI) * 0.1;
      mockTrackingRef.current.left.pinchDistance =
        0.3 + Math.sin(time * 2) * 0.1;
      mockTrackingRef.current.right.pinchDistance =
        0.3 + Math.sin(time * 2 + Math.PI) * 0.1;
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, []);

  const handleGetStarted = () => {
    navigate("/play");
  };

  const handleClose = () => {
    navigate("/play");
  };

  return (
    <div className="relative w-full h-screen bg-black text-white overflow-hidden">
      {/* Starry Background */}
      <div className="absolute inset-0 z-0">
        <StarryBackground />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Central Card */}
        <div className="flex-1 flex items-center justify-center px-6 md:px-12 py-12">
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
              <div className="relative h-48 mb-8 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 md:w-64 md:h-64">
                    <Canvas camera={{ position: [0, 0, 3], fov: 50 }}>
                      <ambientLight intensity={0.5} />
                      <pointLight
                        position={[2, 2, 2]}
                        intensity={1}
                        color="#00BFFF"
                      />
                      <pointLight
                        position={[-2, -2, 2]}
                        intensity={0.8}
                        color="#8B5CF6"
                      />
                      <pointLight
                        position={[0, 2, -2]}
                        intensity={0.6}
                        color="#00FFFF"
                      />
                      <group scale={0.7}>
                        <WaterSimulation trackingRef={mockTrackingRef} />
                      </group>
                    </Canvas>
                  </div>
                </div>
              </div>

              {/* Element Code */}
              <div className="relative z-10 mb-4">
                <div className="inline-block px-6 py-3 bg-gray-800/80 rounded-full border border-gray-600/50">
                  <span className="font-['Roboto_Mono'] text-white text-lg md:text-xl">
                    :: H₂O
                  </span>
                </div>
              </div>

              {/* Inviter Info */}
              <div className="relative z-10">
                <p className="text-sm text-gray-400 font-['Roboto_Mono']">
                  Hands On Chemistry Lab
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="w-full px-6 md:px-12 pb-6">
          <div className="space-y-6">
            {/* Top Footer Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              {/* Left */}
              <div className="flex items-center gap-3 justify-start md:justify-start">
                <span className="text-2xl md:text-3xl font-['Orbitron'] font-bold">
                  1x
                </span>
                <span className="text-sm md:text-base font-['Roboto_Mono'] text-gray-300">
                  Element to combine
                </span>
              </div>

              {/* Center - CTA Button */}
              <div className="flex justify-center">
                <button
                  onClick={handleGetStarted}
                  className="px-8 py-4 bg-transparent border-2 border-white/20 hover:border-white/40 rounded-lg font-['Orbitron'] text-lg md:text-xl font-medium transition-all duration-300 hover:scale-105 whitespace-nowrap"
                  style={{
                    fontFamily: "Orbitron, sans-serif",
                    letterSpacing: "0.05em",
                  }}
                >
                  Start Experimenting →
                </button>
              </div>

              {/* Right */}
              <div className="text-right text-sm font-['Roboto_Mono'] text-gray-400 max-w-sm md:ml-auto">
                <p>Start experimenting with your own elements</p>
                <p>and create new compounds.</p>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="w-full bg-gray-900/60 backdrop-blur-md border-t border-gray-700/50 px-6 md:px-12 py-4 rounded-t-lg">
              <div className="flex justify-between items-center">
                {/* Left: Logo */}
                <div className="flex items-center gap-3">
                  <div className="grid grid-cols-3 gap-1 w-6 h-6">
                    {[...Array(9)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 bg-white rounded-sm"
                      ></div>
                    ))}
                  </div>
                  <span className="font-['Orbitron'] font-bold text-lg">
                    Atomis
                  </span>
                </div>

                {/* Right: Attribution */}
                <div className="flex items-center gap-2 text-sm font-['Roboto_Mono'] text-gray-400">
                  <span>curated by</span>
                  <div className="flex items-center gap-1">
                    <span className="font-['Orbitron'] font-bold text-white">
                      M
                    </span>
                    <span className="text-white">Atomis</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;
