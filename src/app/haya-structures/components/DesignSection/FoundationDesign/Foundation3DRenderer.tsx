'use client';

import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Geometry3DData, Vector3D } from '@/lib/structural/foundation';

// Extend JSX IntrinsicElements for both legacy JSX and React 18/19 React.JSX namespaces
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

interface FootingBoxItem {
  width: number;
  height: number;
  depth: number;
  position: Vector3D;
}

interface PileItem {
  diameter: number;
  length: number;
  position: Vector3D;
}

interface Foundation3DRendererProps {
  data: Geometry3DData;
}

const Foundation3DScene: React.FC<Foundation3DRendererProps> = ({ data }) => {
  // Safe extraction with fallbacks for legacy or single-box setups
  const primaryFooting = data.footingBox || data.footingBoxes?.[0];
  const primaryColumn = data.columnBox || data.columnBoxes?.[0];

  return (
    <group>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1} />

      {/* 1. Primary Footing Box */}
      {primaryFooting && (
        <mesh
          position={[
            primaryFooting.position.x,
            primaryFooting.position.y,
            primaryFooting.position.z,
          ]}
        >
          <boxGeometry
            args={[
              primaryFooting.width,
              primaryFooting.height,
              primaryFooting.depth,
            ]}
          />
          <meshStandardMaterial color="#94a3b8" transparent opacity={0.85} />
        </mesh>
      )}

      {/* 2. Additional Footing Boxes (Multi-Pad / Combined Footings) */}
      {data.footingBoxes?.slice(1).map((box: FootingBoxItem, idx: number) => (
        <mesh
          key={`footing-${idx}`}
          position={[box.position.x, box.position.y, box.position.z]}
        >
          <boxGeometry args={[box.width, box.height, box.depth]} />
          <meshStandardMaterial color="#94a3b8" transparent opacity={0.85} />
        </mesh>
      ))}

      {/* 3. Column Boxes */}
      {(data.columnBoxes?.length
        ? data.columnBoxes
        : primaryColumn
        ? [primaryColumn]
        : []
      ).map((col: FootingBoxItem, idx: number) => (
        <mesh
          key={`col-${idx}`}
          position={[col.position.x, col.position.y, col.position.z]}
        >
          <boxGeometry args={[col.width, col.height, col.depth]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
      ))}

      {/* 4. Strap Beam (if applicable) */}
      {data.strapBeam && (
        <mesh
          position={[
            data.strapBeam.position.x,
            data.strapBeam.position.y,
            data.strapBeam.position.z,
          ]}
        >
          <boxGeometry
            args={[
              data.strapBeam.width,
              data.strapBeam.height,
              data.strapBeam.depth,
            ]}
          />
          <meshStandardMaterial color="#475569" />
        </mesh>
      )}

      {/* 5. Deep Foundation Piles */}
      {data.piles?.map((pile: PileItem, idx: number) => (
        <mesh
          key={`pile-${idx}`}
          position={[pile.position.x, pile.position.y, pile.position.z]}
        >
          <cylinderGeometry
            args={[pile.diameter / 2, pile.diameter / 2, pile.length, 32]}
          />
          <meshStandardMaterial color="#475569" />
        </mesh>
      ))}
    </group>
  );
};

export const Foundation3DRenderer: React.FC<Foundation3DRendererProps> = ({
  data,
}) => {
  return (
    <div className="w-full h-[450px] bg-slate-900 rounded-lg overflow-hidden relative">
      <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
        <Foundation3DScene data={data} />
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
};

export default Foundation3DRenderer;