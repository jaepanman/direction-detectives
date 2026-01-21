import React, { useMemo } from 'react';
import { Canvas, useFrame, useThree, ThreeElements } from '@react-three/fiber';
import { Sky, Stars, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import Building from './Building';
import { Position, GameStatus } from '../types';
import { GRID_SIZE } from '../constants';

// Fix: Augment the React.JSX namespace to include Three.js elements.
declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements extends ThreeElements {}
    }
  }
}

interface TownProps {
  playerPos: Position;
  targetPos: { x: number, z: number };
  status: GameStatus;
}

const PlayerCamera: React.FC<{ playerPos: Position }> = ({ playerPos }) => {
  const { camera } = useThree();
  const targetCamPos = new THREE.Vector3(playerPos.x, 1.6, playerPos.z);
  const targetRotationY = (playerPos.rotation * Math.PI) / 180;

  useFrame(() => {
    // Smoothly interpolate position
    camera.position.lerp(targetCamPos, 0.15);
    
    // Smoothly interpolate rotation on Y axis
    camera.rotation.y = THREE.MathUtils.lerp(camera.rotation.y, targetRotationY, 0.1);
    
    camera.rotation.x = 0;
    camera.rotation.z = 0;
  });

  return null;
};

const RoadMarkings: React.FC = () => {
  const lines = useMemo(() => {
    const arr = [];
    const extent = 100; // Performance optimization
    const step = GRID_SIZE;
    
    for (let x = -extent; x <= extent; x += step) {
      for (let z = -extent; z <= extent; z += step) {
        arr.push(
          <group key={`cw-${x}-${z}`} position={[x, 0.02, z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
              <planeGeometry args={[1.5, 4]} />
              <meshStandardMaterial color="#ffffff" transparent opacity={0.5} />
            </mesh>
          </group>
        );
      }
    }
    return arr;
  }, []);

  return <>{lines}</>;
};

const Town: React.FC<TownProps> = ({ playerPos, targetPos, status }) => {
  const envObjects = useMemo(() => {
    const objs = [];
    const range = 12; // Optimized range for performance (down from 20)
    const colors = ["#fbbf24", "#60a5fa", "#f87171", "#a78bfa", "#34d399", "#fb923c"];
    
    for (let i = -range; i <= range; i++) {
      for (let j = -range; j <= range; j++) {
        const x = i * GRID_SIZE;
        const z = j * GRID_SIZE;

        const bx = x + GRID_SIZE / 2;
        const bz = z + GRID_SIZE / 2;

        // Skip the goal position area
        if (Math.abs(bx - targetPos.x) < 2 && Math.abs(bz - targetPos.z) < 2) continue;

        const rand = Math.random();
        if (rand < 0.35) {
          objs.push(
            <Building 
              key={`b-${i}-${j}`} 
              position={[bx, 0, bz]} 
              color={colors[Math.floor(Math.random() * colors.length)]} 
              type={rand < 0.1 ? 'store' : 'house'}
              rotation={[0, Math.floor(Math.random() * 4) * (Math.PI / 2), 0]}
            />
          );
        } else if (rand < 0.45) {
          objs.push(<Building key={`p-${i}-${j}`} position={[bx, 0, bz]} type="park" />);
        } else if (rand < 0.55) {
          objs.push(<Building key={`t-${i}-${j}`} position={[bx + (Math.random()-0.5), 0, bz + (Math.random()-0.5)]} type="tree" />);
        }

        if (i % 3 === 0 && j % 3 === 0) {
            objs.push(
                <Building 
                    key={`l-${i}-${j}`} 
                    position={[x + 1.2, 0, z + 1.2]} 
                    type="lamp" 
                    rotation={[0, Math.PI / 4, 0]}
                />
            );
        }
      }
    }
    return objs;
  }, [targetPos]);

  return (
    <div className="w-full h-full bg-[#87ceeb]">
      <Canvas shadows camera={{ fov: 70, near: 0.1, far: 500 }}>
        <fog attach="fog" args={["#87ceeb", 5, 60]} />
        <Sky sunPosition={[100, 50, 100]} turbidity={0.1} rayleigh={2} />
        <ambientLight intensity={0.7} />
        <directionalLight 
          position={[50, 100, 50]} 
          intensity={1.0} 
          castShadow 
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-60}
          shadow-camera-right={60}
          shadow-camera-top={60}
          shadow-camera-bottom={-60}
        />
        
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color="#374151" />
        </mesh>

        <RoadMarkings />
        {envObjects}

        <Building position={[targetPos.x, 0, targetPos.z]} isGoal />

        <PlayerCamera playerPos={playerPos} />
        
        <Environment preset="city" />
        <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={20} blur={2} far={4.5} />
      </Canvas>
    </div>
  );
};

export default Town;
