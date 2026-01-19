
import React from 'react';
import { ThreeElements } from '@react-three/fiber';

// Fix: Augment the global JSX namespace directly. 
// Modern React/TS setups (especially Vite) often look for IntrinsicElements in the global JSX namespace.
declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

interface BuildingProps {
  position: [number, number, number];
  color?: string;
  isGoal?: boolean;
  type?: 'house' | 'store' | 'park' | 'tree' | 'lamp';
  rotation?: [number, number, number];
}

const Building: React.FC<BuildingProps> = ({ position, color = "#fbbf24", isGoal = false, type = 'house', rotation = [0, 0, 0] }) => {
  if (type === 'tree') {
    return (
      <group position={position}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 1, 8]} />
          <meshStandardMaterial color="#5d4037" />
        </mesh>
        <mesh position={[0, 1.5, 0]}>
          <coneGeometry args={[0.8, 1.5, 8]} />
          <meshStandardMaterial color="#2e7d32" />
        </mesh>
      </group>
    );
  }

  if (type === 'lamp') {
    return (
      <group position={position} rotation={rotation}>
        <mesh position={[0, 1.5, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 3, 8]} />
          <meshStandardMaterial color="#212121" />
        </mesh>
        <mesh position={[0, 3, 0.2]}>
          <boxGeometry args={[0.1, 0.1, 0.5]} />
          <meshStandardMaterial color="#212121" />
        </mesh>
        <mesh position={[0, 2.9, 0.4]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color="#fff176" emissive="#fff176" emissiveIntensity={1} />
        </mesh>
      </group>
    );
  }

  if (type === 'park') {
    return (
      <group position={position}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <planeGeometry args={[4, 4]} />
          <meshStandardMaterial color="#4caf50" />
        </mesh>
        <Building type="tree" position={[-1.2, 0, -1.2]} />
        <Building type="tree" position={[1.2, 0, 1.2]} />
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[1.5, 0.1, 0.5]} />
          <meshStandardMaterial color="#8d6e63" />
        </mesh>
      </group>
    );
  }

  return (
    <group position={position} rotation={rotation}>
      {/* Base */}
      <mesh position={[0, 1, 0]} castShadow receiveShadow>
        <boxGeometry args={[3, 2, 3]} />
        <meshStandardMaterial color={isGoal ? "#ef4444" : color} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 2.5, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[2.5, 1.5, 4]} />
        <meshStandardMaterial color={isGoal ? "#b91c1c" : "#92400e"} />
      </mesh>
      
      {type === 'store' && (
        <group position={[0, 1.2, 1.51]}>
          <mesh>
            <boxGeometry args={[2.5, 0.6, 0.1]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0, -0.7, 0]}>
            <planeGeometry args={[1, 1]} />
            <meshStandardMaterial color="#bbdefb" />
          </mesh>
        </group>
      )}

      {/* Door */}
      <mesh position={[0, 0.5, 1.51]}>
        <planeGeometry args={[1, 1.2]} />
        <meshStandardMaterial color="#451a03" />
      </mesh>
      {/* Windows */}
      <mesh position={[-0.8, 1.3, 1.51]}>
        <planeGeometry args={[0.5, 0.5]} />
        <meshStandardMaterial color="#bae6fd" />
      </mesh>
      <mesh position={[0.8, 1.3, 1.51]}>
        <planeGeometry args={[0.5, 0.5]} />
        <meshStandardMaterial color="#bae6fd" />
      </mesh>
    </group>
  );
};

export default Building;
