'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { 
  Geometry3DData, 
  Vector3D, 
  FootingBox3D, 
  ColumnBox3D 
} from '@/lib/structural/foundation';

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

export interface Foundation3DRendererProps {
  data?: Geometry3DData;
  meshMode?: 'single' | 'double'; // 'single' = bottom mat, 'double' = top & bottom
  botBarSpacing?: number;        // in mm (e.g. 150)
  topBarSpacing?: number;        // in mm (e.g. 200)
  botBarDiam?: number;           // in mm (e.g. 16)
  topBarDiam?: number;           // in mm (e.g. 12)
  cover?: number;                // in mm (e.g. 50)
  onMeshModeChange?: (mode: 'single' | 'double') => void;
}

// Default fallback geometry data matching full Geometry3DData interface
const defaultGeometryData: Geometry3DData = {
  footingBox: { width: 2.2, height: 0.5, depth: 2.2, position: { x: 0, y: 0, z: 0 } },
  footingBoxes: [{ width: 2.2, height: 0.5, depth: 2.2, position: { x: 0, y: 0, z: 0 } }],
  columnBoxes: [{ width: 0.4, height: 1.0, depth: 0.4, position: { x: 0, y: 0.75, z: 0 } }],
  rebars3D: [],
};

// Parametric 3D Rebar Grid Component
const RebarGrid3D: React.FC<{
  width: number;
  height: number;
  depth: number;
  position: Vector3D;
  isTopMat?: boolean;
  spacingMm?: number;
  barDiamMm?: number;
  coverMm?: number;
}> = ({ 
  width, 
  height, 
  depth, 
  position, 
  isTopMat = false,
  spacingMm = 150,
  barDiamMm = 16,
  coverMm = 50
}) => {
  const { xBarPositions, zBarPositions, yOffset, barRadius, cover, barColor } = useMemo(() => {
    const cover = coverMm / 1000;
    const barRadius = (barDiamMm / 2) / 1000;
    const spacing = spacingMm / 1000;
    const barColor = isTopMat ? '#f59e0b' : '#ef4444'; // Amber for Top, Red for Bottom

    // Elevation offset based on top vs bottom mat placement
    const yOffset = isTopMat 
      ? position.y + height / 2 - cover - barRadius
      : position.y - height / 2 + cover + barRadius;

    // X-direction bars (longitudinal)
    const numXBars = Math.max(1, Math.floor((depth - 2 * cover) / spacing));
    const xBarPositions = Array.from({ length: numXBars }, (_, i) => 
      position.z - (depth - 2 * cover) / 2 + i * spacing
    );

    // Z-direction bars (transverse)
    const numZBars = Math.max(1, Math.floor((width - 2 * cover) / spacing));
    const zBarPositions = Array.from({ length: numZBars }, (_, i) => 
      position.x - (width - 2 * cover) / 2 + i * spacing
    );

    return { xBarPositions, zBarPositions, yOffset, barRadius, cover, barColor };
  }, [width, height, depth, position, isTopMat, spacingMm, barDiamMm, coverMm]);

  return (
    <group>
      {/* Longitudinal X-Bars */}
      {xBarPositions.map((zPos: number, idx: number) => (
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
      {zBarPositions.map((xPos: number, idx: number) => (
        <mesh 
          key={`z-bar-${isTopMat ? 'top' : 'bot'}-${idx}`}
          position={[xPos, yOffset + (isTopMat ? -barRadius * 2 : barRadius * 2), position.z]}
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
  botBarSpacing: number;
  topBarSpacing: number;
  botBarDiam: number;
  topBarDiam: number;
  cover: number;
}> = ({ 
  data, 
  showConcrete, 
  showRebar, 
  meshMode, 
  concreteOpacity,
  botBarSpacing,
  topBarSpacing,
  botBarDiam,
  topBarDiam,
  cover
}) => {
  const footingBoxes = data?.footingBoxes && data.footingBoxes.length > 0
    ? data.footingBoxes
    : (data?.footingBox ? [data.footingBox] : defaultGeometryData.footingBoxes!);

  const columnBoxes = data?.columnBoxes && data.columnBoxes.length > 0
    ? data.columnBoxes
    : defaultGeometryData.columnBoxes!;

  return (
    <group>
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 12, 8]} intensity={1.2} castShadow />

      {/* Concrete Rendering */}
      {showConcrete && (
        <>
          {footingBoxes.map((box: FootingBox3D, idx: number) => (
            <mesh key={`footing-${idx}`} position={[box.position.x, box.position.y, box.position.z]}>
              <boxGeometry args={[box.width, box.height, box.depth]} />
              <meshStandardMaterial 
                color="#94a3b8" 
                transparent 
                opacity={concreteOpacity} 
                wireframe={concreteOpacity === 0}
              />
            </mesh>
          ))}

          {columnBoxes.map((col: ColumnBox3D, idx: number) => (
            <mesh key={`column-${idx}`} position={[col.position.x, col.position.y, col.position.z]}>
              <boxGeometry args={[col.width, col.height, col.depth]} />
              <meshStandardMaterial 
                color="#64748b" 
                transparent 
                opacity={concreteOpacity}
              />
            </mesh>
          ))}
        </>
      )}

      {/* Rebar Mesh Rendering */}
      {showRebar && (
        <group>
          {footingBoxes.map((box: FootingBox3D, idx: number) => (
            <React.Fragment key={`rebar-group-${idx}`}>
              {/* Bottom Rebar Mat */}
              <RebarGrid3D 
                width={box.width} 
                height={box.height} 
                depth={box.depth} 
                position={box.position} 
                isTopMat={false} 
                spacingMm={botBarSpacing}
                barDiamMm={botBarDiam}
                coverMm={cover}
              />

              {/* Top Rebar Mat (Double Mesh Mode) */}
              {meshMode === 'double' && (
                <RebarGrid3D 
                  width={box.width} 
                  height={box.height} 
                  depth={box.depth} 
                  position={box.position} 
                  isTopMat={true} 
                  spacingMm={topBarSpacing}
                  barDiamMm={topBarDiam}
                  coverMm={cover}
                />
              )}
            </React.Fragment>
          ))}

          {/* Column Dowels */}
          {columnBoxes.map((col: ColumnBox3D, colIdx: number) => (
            <group key={`column-dowels-${colIdx}`}>
              {[-0.12, 0.12].map((x: number, i: number) =>
                [-0.12, 0.12].map((z: number, j: number) => (
                  <mesh 
                    key={`dowel-${colIdx}-${i}-${j}`} 
                    position={[col.position.x + x, col.position.y - 0.2, col.position.z + z]}
                  >
                    <cylinderGeometry args={[0.01, 0.01, col.height + 0.4, 12]} />
                    <meshStandardMaterial color="#3b82f6" metalness={0.8} />
                  </mesh>
                ))
              )}
            </group>
          ))}
        </group>
      )}
    </group>
  );
};

export const Foundation3DRenderer: React.FC<Foundation3DRendererProps> = ({ 
  data,
  meshMode: propMeshMode = 'single',
  botBarSpacing = 150,
  topBarSpacing = 200,
  botBarDiam = 16,
  topBarDiam = 12,
  cover = 50,
  onMeshModeChange
}) => {
  const [showConcrete, setShowConcrete] = useState(true);
  const [showRebar, setShowRebar] = useState(true);
  const [concreteOpacity, setConcreteOpacity] = useState(0.4);
  const [meshMode, setMeshMode] = useState<'single' | 'double'>(propMeshMode);

  useEffect(() => {
    setMeshMode(propMeshMode);
  }, [propMeshMode]);

  const handleMeshToggle = (mode: 'single' | 'double') => {
    setMeshMode(mode);
    if (onMeshModeChange) {
      onMeshModeChange(mode);
    }
  };

  return (
    <div className="w-full bg-slate-950 rounded-xl border border-slate-800 overflow-hidden relative shadow-2xl">
      {/* Toolbar Controls Overlay */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap justify-between items-center bg-slate-900/90 backdrop-blur-md p-2.5 rounded-lg border border-slate-800 text-xs gap-2">
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
                onClick={() => handleMeshToggle('single')}
                className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                  meshMode === 'single' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'
                }`}
              >
                Single Mesh
              </button>
              <button
                onClick={() => handleMeshToggle('double')}
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
            botBarSpacing={botBarSpacing}
            topBarSpacing={topBarSpacing}
            botBarDiam={botBarDiam}
            topBarDiam={topBarDiam}
            cover={cover}
          />
          <OrbitControls makeDefault minDistance={1.5} maxDistance={10} />
        </Canvas>
      </div>
    </div>
  );
};

export default Foundation3DRenderer;