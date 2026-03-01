import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TrackingData } from "../types";

interface SymbioteBlobProps {
  trackingRef: React.RefObject<TrackingData>;
  audioLevelRef?: React.RefObject<number>;
}

const TENDRIL_COUNT = 10;

const SymbioteBlob: React.FC<SymbioteBlobProps> = ({ trackingRef, audioLevelRef }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const tendrilRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Pre-compute tendril directions, speeds, phase offsets
  const tendrilData = useMemo(() => {
    return Array.from({ length: TENDRIL_COUNT }, () => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      return {
        dir: new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta),
          Math.sin(phi) * Math.sin(theta),
          Math.cos(phi)
        ).normalize(),
        speed: 0.2 + Math.random() * 0.35,   // slow, viscous
        phase: Math.random() * Math.PI * 2,
      };
    });
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime:       { value: 0 },
      uHandLeft:   { value: new THREE.Vector3(-4, 0, 0) },
      uHandRight:  { value: new THREE.Vector3(4, 0, 0) },
      uAudioLevel: { value: 0 },
    }),
    []
  );

  // ── Vertex Shader ──────────────────────────────────────────────────────────
  // Domain-warped FBM: feeds fbm output back as a coordinate offset,
  // producing the complex self-folding fluid motion of Venom's symbiote.
  const vertexShader = `
    uniform float uTime;
    uniform vec3 uHandLeft;
    uniform vec3 uHandRight;
    uniform float uAudioLevel;

    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying float vDisplacement;

    // ── Simplex 3D noise ──────────────────────────────────────────────────
    vec3 mod289v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289v4(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x)  { return mod289v4(((x * 34.0) + 1.0) * x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
      const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g  = step(x0.yzx, x0.xyz);
      vec3 l  = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289v3(i);
      vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3  ns = n_ * D.wyz - D.xzx;
      vec4 j  = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x  = x_ * ns.x + ns.yyyy;
      vec4 y  = y_ * ns.x + ns.yyyy;
      vec4 h  = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0) * 2.0 + 1.0;
      vec4 s1 = floor(b1) * 2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw * sh.xzyw;
      vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m * m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
    }
    // ─────────────────────────────────────────────────────────────────────

    // 2-octave smooth FBM — no sharpening, produces continuous flowing curves
    float fbm(vec3 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 2; i++) {
        v += a * snoise(p);
        p  = p * 1.5 + vec3(5.2, 1.3, 8.7);
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec3 pos = position;

      // ── Domain warping pass 1 ─────────────────────────────────────────
      // q is a 3D offset field — each component is a separate slow fbm.
      // Sampling fbm at (pos + q*offset) warps the space non-linearly,
      // creating the folding, self-intersecting quality of thick liquid.
      vec3 q = vec3(
        fbm(pos * 0.2                              + uTime * 0.15),
        fbm(pos * 0.2 + vec3(5.2,  1.3,  8.7)     + uTime * 0.13),
        fbm(pos * 0.2 + vec3(1.7,  9.2,  3.4)     + uTime * 0.18)
      );

      // ── Domain warping pass 2 ─────────────────────────────────────────
      // r warps using q — "warping the warp" adds a second layer of
      // complexity: the already-complex q field is itself distorted.
      vec3 r = vec3(
        fbm(pos * 0.15 + q * 0.3                    + uTime * 0.10),
        fbm(pos * 0.15 + q * 0.3 + vec3(1.7, 9.2, 3.4) + uTime * 0.08),
        0.0
      );

      // Final displacement: fbm sampled in the double-warped coordinate
      float displacement = fbm(pos * 0.1 + r * 0.5 + uTime * 0.08) * 0.5;
      // Audio reactivity: boost displacement when speaking
      displacement *= (1.0 + uAudioLevel * 0.4);
      displacement += uAudioLevel * 0.05;

      // Smooth hand-pull — surface gently swells toward mock hands
      float dLeft  = distance(pos, uHandLeft);
      float dRight = distance(pos, uHandRight);
      float handPull = smoothstep(5.0, 0.0, dLeft)  * 0.38
                     + smoothstep(5.0, 0.0, dRight) * 0.38;

      float totalDisp = displacement + handPull * 0.25;
      vec3 newPos = pos + normal * totalDisp;

      vDisplacement = totalDisp;
      vec4 mvPosition = modelViewMatrix * vec4(newPos, 1.0);
      vViewPosition   = -mvPosition.xyz;
      gl_Position     = projectionMatrix * mvPosition;
      vNormal         = normalize(normalMatrix * (normal + totalDisp * 0.2));
    }
  `;

  // ── Fragment Shader ────────────────────────────────────────────────────────
  // Near-black liquid mercury look: razor specular + purple Fresnel rim.
  const fragmentShader = `
    uniform float uTime;
    uniform float uAudioLevel;

    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying float vDisplacement;

    void main() {
      vec3 normal = normalize(vNormal);

      vec3 viewDir = normalize(vViewPosition);

      // Key light + fill light
      vec3 light1 = normalize(vec3(4.0, 7.0,  5.0));
      vec3 light2 = normalize(vec3(-3.0, -2.0, 5.0));

      vec3 h1 = normalize(light1 + viewDir);
      vec3 h2 = normalize(light2 + viewDir);

      // Smoother primary hotspot for a viscous liquid look
      float spec1 = pow(max(dot(normal, h1), 0.0), 80.0) * 0.4;
      // Softer secondary fill
      float spec2 = pow(max(dot(normal, h2), 0.0), 40.0) * 0.15;

      // Fresnel: silhouette edge glows with dark purple
      float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);

      // Pure black base
      vec3 albedo = vec3(0.0, 0.0, 0.0);

      vec3 rimColor = vec3(0.10, 0.02, 0.20); // dark purple-violet
      // Audio reactivity: brighten rim when speaking
      float rimIntensity = 0.40 + uAudioLevel * 0.35;

      vec3 finalColor = albedo
        + spec1 * vec3(0.7, 0.7, 0.8)       // softer, darker flash
        + spec2 * vec3(0.3, 0.3, 0.4)       // very muted fill
        + fresnel * rimColor * rimIntensity; // audio-reactive purple silhouette

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const data = trackingRef.current;
    if (!data) return;

    // ── Read audio level ───────────────────────────────────────────────────
    const audioLevel = audioLevelRef?.current ?? 0;

    // ── Main blob ──────────────────────────────────────────────────────────
    if (meshRef.current) {
      // Faster rotation — lets the domain-warping be the dominant motion
      meshRef.current.rotation.y = t * 0.15;
      meshRef.current.rotation.x = Math.sin(t * 0.25) * 0.10;

      const mat = meshRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = t;
      mat.uniforms.uAudioLevel.value = audioLevel;

      const lx = (data.left.position.x  - 0.5) * 18;
      const ly = -(data.left.position.y  - 0.5) * 10;
      const rx = (data.right.position.x - 0.5) * 18;
      const ry = -(data.right.position.y - 0.5) * 10;
      mat.uniforms.uHandLeft.value.set(lx, ly, 0);
      mat.uniforms.uHandRight.value.set(rx, ry, 0);
    }

    // ── Tendrils — slow viscous arms ───────────────────────────────────────
    if (tendrilRef.current) {
      tendrilData.forEach((td, i) => {
        const raw = (Math.sin(t * td.speed + td.phase) + 1) / 2; // 0..1
        // Smoothstep easing: slow start, slow end — mimics viscous fluid
        const wave = raw * raw * (3.0 - 2.0 * raw);

        const dist = 1.3 + wave * 1.4 + audioLevel * 0.8;   // audio boosts reach

        dummy.position.set(
          td.dir.x * dist,
          td.dir.y * dist,
          td.dir.z * dist
        );

        // Elongate dramatically when extended, round when retracted
        const stretchY = 1.5 + wave * 2.3 + audioLevel * 1.2;
        dummy.scale.set(0.28, stretchY, 0.28);

        // Point along outward direction
        dummy.lookAt(td.dir.x * 10, td.dir.y * 10, td.dir.z * 10);
        dummy.updateMatrix();
        tendrilRef.current!.setMatrixAt(i, dummy.matrix);
      });
      tendrilRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Main symbiote blob */}
      <mesh ref={meshRef} frustumCulled={false}>
        <sphereGeometry args={[1.3, 128, 128]} />
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* Smooth elongated tendrils */}
      <instancedMesh ref={tendrilRef} args={[undefined, undefined, TENDRIL_COUNT]}>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshStandardMaterial
          color="#080006"
          emissive="#150025"
          emissiveIntensity={0.5}
          roughness={0.08}
          metalness={0.85}
        />
      </instancedMesh>
    </group>
  );
};

export default SymbioteBlob;
