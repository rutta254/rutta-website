'use client';

import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Geometry3DData, Vector3D } from '@/lib/structural/foundation';

// Extend JSX IntrinsicElements for React Three Fiber
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      boxGeometry: any;
      cylinderGeometry: any;
      meshStandardMaterial: any;
      ambientLight: any;
      directionalLight: any;
    }
  }
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        group: any;
        mesh: any;
        boxGeometry: any;
        cylinderGeometry: any;
        meshStandardMaterial: any;
        ambientLight: any;
        directionalLight: any;
      }
    }
  }
}

interface Foundation3DRendererProps {
  data?: Geometry3DData;
  meshMode?: 'single' | 'double'; // 'single' = bottom mat, 'double' = top & bottom
}

// Default fallback geometry data matching full Geometry3DData interface
const defaultGeometryData: Geometry3DData = {
  footingBox: { width: 2.2, height: 0.5, depth: 2.2, position: { x: 0, y: 0, z: 0 } },
  footingBoxes: [{ width: 2.2, height: 0.5, depth: 2.2, position: { x: 0, y: 0, z: 0 } }],
  columnBoxes: [{ width: 0.4, height: 1.0, depth: 0.4, position: { x: 0, y: 0.75, z: 0 } }],
  rebars3D: [],
};

// 3D Procedural Rebar Grid Component
const RebarGrid3D: React.FC<{
  width: number;
  height: number;
  depth: number;
  position: Vector3D;
  isTopMat?: boolean;
}> = ({ width, height, depth, position, isTopMat = false }) => {
  const cover = 0.05; // 50mm cover converted to meters
  const barRadius = 0.008; // 16mm rebar radius
  const spacing = 0.15; // 150mm spacing
  const barColor = isTopMat ? '#f59e0b' : '#ef4444'; // Amber for Top, Red for Bottom

  const yOffset = isTopMat 
    ? position.y + height / 2 - cover - barRadius
    : position.y - height / 2 + cover + barRadius;

  // X-direction bars
  const numXBars = Math.floor((depth - 2 * cover) / spacing);
  const xBarPositions = Array.from({ length: numXBars }, (_, i) => 
    position.z - (depth - 2 * cover) / 2 + i * spacing
  );

  // Z-direction bars
  const numZBars = Math.floor((width - 2 * cover) / spacing);
  const zBarPositions = Array.from({ length: numZBars }, (_, i) => 
    position.x - (width - 2 * cover) / 2 + i * spacing
  );

  return (
    <group>
      {/* Longitudinal X-Bars */}
      {xBarPositions.map((zPos, idx) => (
        <mesh 
          key={`x-bar-${isTopMat ? 'top' : 'bot'}-${idx}`}
          position={[position.x, yOffset, zPos]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[barRadius, barRadius, width - 2 * cover, 12]} />
          <meshStandardMaterial color={barColor} metalness={0.8} roughness={0.3} />
        </mesh>
      ))}

      {/* Transverse Z-Bars */}
      {zBarPositions.map((xPos, idx) => (
        <mesh 
          key={`z-bar-${isTopMat ? 'top' : 'bot'}-${idx}`}
          position={[xPos, yOffset + (isTopMat ? -0.02 : 0.02), position.z]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[barRadius, barRadius, depth - 2 * cover, 12]} />
          <meshStandardMaterial color={barColor} metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
};

// 3D Scene Assembly
const Foundation3DScene: React.FC<{
  data: Geometry3DData;
  showConcrete: boolean;
  showRebar: boolean;
  meshMode: 'single' | 'double';
  concreteOpacity: number;
}> = ({ data, showConcrete, showRebar, meshMode, concreteOpacity }) => {
  const primaryFooting = data?.footingBox || data?.footingBoxes?.[0] || defaultGeometryData.footingBoxes![0];
  const primaryColumn = data?.columnBoxes?.[0] || defaultGeometryData.columnBoxes![0];

  return (
    <group>
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 12, 8]} intensity={1.2} castShadow />

      {/* Concrete Rendering */}
      {showConcrete && (
        <>
          {/* Footing Pad */}
          <mesh position={[primaryFooting.position.x, primaryFooting.position.y, primaryFooting.position.z]}>
            <boxGeometry args={[primaryFooting.width, primaryFooting.height, primaryFooting.depth]} />
            <meshStandardMaterial 
              color="#94a3b8" 
              transparent 
              opacity={concreteOpacity} 
              wireframe={concreteOpacity === 0}
            />
          </mesh>

          {/* Column Stub */}
          {primaryColumn && (
            <mesh position={[primaryColumn.position.x, primaryColumn.position.y, primaryColumn.position.z]}>
              <boxGeometry args={[primaryColumn.width, primaryColumn.height, primaryColumn.depth]} />
              <meshStandardMaterial 
                color="#64748b" 
                transparent 
                opacity={concreteOpacity}
              />
            </mesh>
          )}
        </>
      )}

      {/* Rebar Mesh Rendering */}
      {showRebar && (
        <group>
          {/* Bottom Rebar Mat */}
          <RebarGrid3D 
            width={primaryFooting.width} 
            height={primaryFooting.height} 
            depth={primaryFooting.depth} 
            position={primaryFooting.position} 
            isTopMat={false} 
          />

          {/* Top Rebar Mat (Double Mesh Mode) */}
          {meshMode === 'double' && (
            <RebarGrid3D 
              width={primaryFooting.width} 
              height={primaryFooting.height} 
              depth={primaryFooting.depth} 
              position={primaryFooting.position} 
              isTopMat={true} 
            />
          )}

          {/* Column Starter Dowels */}
          {primaryColumn && [-0.12, 0.12].map((x, i) =>
            [-0.12, 0.12].map((z, j) => (
              <mesh 
                key={`dowel-${i}-${j}`} 
                position={[primaryColumn.position.x + x, primaryColumn.position.y - 0.2, primaryColumn.position.z + z]}
              >
                <cylinderGeometry args={[0.01, 0.01, primaryColumn.height + 0.4, 12]} />
                <meshStandardMaterial color="#3b82f6" metalness={0.8} />
              </mesh>
            ))
          )}
        </group>
      )}
    </group>
  );
};

export const Foundation3DRenderer: React.FC<Foundation3DRendererProps> = ({ 
  data,
  meshMode: propMeshMode = 'single' 
}) => {
  const [showConcrete, setShowConcrete] = useState(true);
  const [showRebar, setShowRebar] = useState(true);
  const [concreteOpacity, setConcreteOpacity] = useState(0.4); // Semi-transparent by default to see rebar
  const [meshMode, setMeshMode] = useState<'single' | 'double'>(propMeshMode);

  return (
    <div className="w-full bg-slate-950 rounded-xl border border-slate-800 overflow-hidden relative shadow-2xl">
      {/* Toolbar Controls Overlay */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap justify-between items-center bg-slate-900/90 backdrop-blur-md p-2.5 rounded-lg border border-slate-800 text-xs gap-2">
        {/* Toggle Concrete */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConcrete(!showConcrete)}
            className={`px-3 py-1 rounded font-bold transition ${
              showConcrete ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {showConcrete ? 'Concrete: ON' : 'Concrete: OFF'}
          </button>

          {showConcrete && (
            <button
              onClick={() => setConcreteOpacity(concreteOpacity === 1 ? 0.3 : 1)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-mono text-[11px]"
            >
              {concreteOpacity === 1 ? 'Solid' : 'Transparent'}
            </button>
          )}
        </div>

        {/* Toggle Rebar & Mesh Layers */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRebar(!showRebar)}
            className={`px-3 py-1 rounded font-bold transition ${
              showRebar ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {showRebar ? 'Rebar: ON' : 'Rebar: OFF'}
          </button>

          {showRebar && (
            <div className="flex bg-slate-950 rounded border border-slate-800 p-0.5">
              <button
                onClick={() => setMeshMode('single')}
                className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                  meshMode === 'single' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'
                }`}
              >
                Single Mesh
              </button>
              <button
                onClick={() => setMeshMode('double')}
                className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                  meshMode === 'double' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                }`}
              >
                Double Mesh
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3D WebGL Canvas */}
      <div className="w-full h-[480px]">
        <Canvas camera={{ position: [3.5, 3, 3.5], fov: 45 }}>
          <Foundation3DScene 
            data={data || defaultGeometryData} 
            showConcrete={showConcrete} 
            showRebar={showRebar} 
            meshMode={meshMode} 
            concreteOpacity={concreteOpacity} 
          />
          <OrbitControls makeDefault minDistance={1.5} maxDistance={10} />
        </Canvas>
      </div>
    </div>
  );
};

export default Foundation3DRenderer;