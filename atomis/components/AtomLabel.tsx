import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ElementData } from '../types';

interface AtomLabelProps {
  element: ElementData;
  position: [number, number, number];
}

const AtomLabel: React.FC<AtomLabelProps> = ({ element, position }) => {
  const { camera, size, gl } = useThree();
  const divRef = useRef<HTMLDivElement | null>(null);
  const vec = useRef(new THREE.Vector3());

  useEffect(() => {
    const parent = gl.domElement.parentElement;
    if (!parent) return;
    parent.style.position = 'relative';

    const wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.top = '0';
    wrapper.style.left = '0';
    wrapper.style.pointerEvents = 'none';
    wrapper.style.zIndex = '100';

    wrapper.innerHTML = `
      <div class="flex flex-col items-center justify-center opacity-90">
        <div
          class="text-2xl font-bold font-['Orbitron'] tracking-tighter transition-colors duration-500"
          style="color: #ffffff; text-shadow: 0 0 10px ${element.color}, 0 0 20px ${element.color};"
        >${element.symbol}</div>
        <div class="flex items-center gap-2 mt-1">
          <div class="h-px w-4 bg-white/20"></div>
          <div class="text-[10px] font-mono text-cyan-200 tracking-[0.2em] uppercase">${element.name}</div>
          <div class="h-px w-4 bg-white/20"></div>
        </div>
        <div class="text-[8px] text-gray-500 mt-0.5 font-mono">ATOMIC NO. ${element.atomicNumber}</div>
      </div>
    `;

    parent.appendChild(wrapper);
    divRef.current = wrapper;

    return () => {
      wrapper.remove();
      divRef.current = null;
    };
  }, [gl, element.symbol, element.name, element.atomicNumber, element.color]);

  useFrame(() => {
    if (!divRef.current) return;
    vec.current.set(position[0], position[1], position[2]);
    vec.current.project(camera);
    const x = (vec.current.x * 0.5 + 0.5) * size.width;
    const y = (-vec.current.y * 0.5 + 0.5) * size.height;
    divRef.current.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
  });

  // Return null — all DOM is managed imperatively outside R3F's reconciler
  return null;
};

export default AtomLabel;
