import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sphere, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

const AnimatedObject = () => {
  const meshRef = useRef();

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(time / 4);
      meshRef.current.rotation.y = Math.sin(time / 2);
    }
  });

  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={2}>
      <Sphere ref={meshRef} args={[1, 64, 64]} scale={1.8}>
        <MeshDistortMaterial
          color="#d97706"
          speed={3}
          distort={0.4}
          radius={1}
          metalness={0.5}
          roughness={0.2}
          emissive="#d97706"
          emissiveIntensity={0.2}
        />
      </Sphere>
    </Float>
  );
};

const Scene3D = () => {
  return (
    <div className="w-full h-[500px] lg:h-[700px] relative pointer-events-none md:pointer-events-auto">
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0, 5]} />
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#d97706" />
        
        <AnimatedObject />
        
        <OrbitControls enableZoom={false} enablePan={false} />
      </Canvas>
      
      {/* Abstract Rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-64 h-64 md:w-96 md:h-96 border border-accent-orange/20 rounded-full animate-[spin_10s_linear_infinite]"></div>
        <div className="absolute w-80 h-80 md:w-[450px] md:h-[450px] border border-accent-orange/10 rounded-full animate-[spin_15s_linear_infinite_reverse]"></div>
      </div>
    </div>
  );
};

export default Scene3D;
