"use client";

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Edges, Html, Float } from "@react-three/drei";
import * as THREE from "three";

export default function ScannerBed({ systemData }: { systemData: any }) {
    const boxRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (boxRef.current) {
            // Slow rotation of the bounding visualization
            boxRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.2;
        }
    });

    return (
        <group>
            {/* Scanner Base Platform */}
            <mesh position={[0, -1, 0]}>
                <boxGeometry args={[4, 0.2, 4]} />
                <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.2} />
                <Edges threshold={15} color="#00F2FF" />
            </mesh>

            {/* Grid Decal */}
            <gridHelper args={[4, 10, "#00F2FF", "#002233"]} position={[0, -0.89, 0]} />

            {/* Holographic Projection Box */}
            <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
                <mesh ref={boxRef} position={[0, 0.5, 0]}>
                    <boxGeometry args={[2, 2, 2]} />
                    <meshBasicMaterial color="#00F2FF" wireframe transparent opacity={0.1} />
                    <Edges threshold={15} color="#00F2FF" />

                    {/* Floating Data Labels inside the hologram */}
                    {systemData ? (
                        <>
                            <Html position={[1.2, 1, 0]} center>
                                <div className="bg-[#050505]/90 border border-[#00F2FF]/50 p-3 backdrop-blur-md rounded shadow-[0_0_15px_rgba(0,242,255,0.2)]">
                                    <div className="text-[10px] font-mono text-[#00F2FF] leading-relaxed whitespace-nowrap">
                                        <b className="border-b border-[#00F2FF]/30 pb-1 mb-1 block">DETECTION CONFIRM</b>
                                        ID: <span className="text-white">{systemData.waste_class.toUpperCase()}</span><br />
                                        ITEM: <span className="text-gray-300">{systemData.item_description?.substring(0, 25) || "N/A"}</span><br />
                                        MASS: <span className="text-white">{systemData.mass_kg} KG</span><br />
                                        DOC_f: <span className="text-white">{(systemData.carbon_credits > 0 ? 0.5 : 0.0)}</span> (IPCC)<br />
                                        TYPE: <span className={systemData.biodegradable ? "text-green-400" : "text-gray-400"}>
                                            {systemData.biodegradable ? "BIODEGRADABLE" : "NON-BIODEGRADABLE"}
                                        </span>
                                    </div>
                                </div>
                            </Html>

                            {/* Second floating label for Gas Composition */}
                            {systemData.gas_release_composition && (
                                <Html position={[-1.2, -0.5, 0]} center>
                                    <div className="bg-[#1a1a1a]/90 border border-[#FFB800]/50 p-2 backdrop-blur-md rounded">
                                        <div className="text-[9px] font-mono text-[#FFB800] leading-tight whitespace-nowrap">
                                            <b>POTENTIAL EMISSION:</b><br />
                                            {systemData.gas_release_composition.slice(0, 3).map((gas: string, i: number) => (
                                                <div key={i}>► {gas}</div>
                                            ))}
                                        </div>
                                    </div>
                                </Html>
                            )}
                        </>
                    ) : (
                        <Html position={[0, 0, 0]} center>
                            <div className="text-[12px] font-mono text-[#00F2FF] animate-pulse">
                                AWAITING OPTICAL INPUT...
                            </div>
                        </Html>
                    )}
                </mesh>
            </Float>

            {/* Scanner Laser Plane passing through */}
            <mesh position={[0, 0.5, 0]}>
                <planeGeometry args={[3, 3]} />
                <meshBasicMaterial color="#00F2FF" transparent opacity={0.05} side={THREE.DoubleSide} />
            </mesh>
        </group>
    );
}
