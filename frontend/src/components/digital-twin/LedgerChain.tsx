"use client";

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, Html } from "@react-three/drei";
import * as THREE from "three";

export default function LedgerChain({ systemData }: { systemData: any }) {
    const groupRef = useRef<THREE.Group>(null);

    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.1;
        }
    });

    return (
        <group ref={groupRef}>

            {/* Dynamic Data Blocks (The Ledger) */}
            {[0, 1, 2, 3, 4].map((i) => {
                // Position them in a helix/chain stack
                const yPos = i * 1.2 - 2;
                const radius = 2;
                const angle = i * Math.PI / 2;
                const xPos = Math.cos(angle) * radius;
                const zPos = Math.sin(angle) * radius;

                // If it's the "newest" block, check if systemData has credits
                const isCurrentTx = i === 4;
                const displayData = isCurrentTx && systemData
                    ? { cct: systemData.carbon_credits, hash: "0xVERIFIED_" + Math.random().toString(36).substring(7) }
                    : { cct: 1.05 + (i * 0.2), hash: "0xLEDGER_PAST_" + i };

                return (
                    <Float key={i} speed={2} rotationIntensity={0.5} floatIntensity={1} position={[xPos, yPos, zPos]}>
                        <mesh>
                            {/* Glass Block */}
                            <boxGeometry args={[1, 1, 1]} />
                            <meshPhysicalMaterial
                                color={isCurrentTx ? "#bb00ff" : "#1a1a1a"}
                                transmission={0.9}
                                opacity={1}
                                metalness={0.1}
                                roughness={0.1}
                                ior={1.5}
                                thickness={0.5}
                            />

                            <Html position={[0.6, 0.6, 0.6]} center>
                                <div className={`text-[9px] font-mono leading-tight whitespace-nowrap p-1 backdrop-blur-sm border ${isCurrentTx ? 'border-[#bb00ff] text-[#bb00ff]' : 'border-gray-700 text-gray-500'}`}>
                                    MINT: {displayData.cct.toFixed(4)} CCT<br />
                                    {displayData.hash.toUpperCase()}
                                </div>
                            </Html>
                        </mesh>

                        {/* Connection Line to center (Proof of chain) */}
                        <mesh rotation={[0, -angle, 0]} position={[-xPos / 2, 0, -zPos / 2]}>
                            <boxGeometry args={[radius, 0.05, 0.05]} />
                            <meshBasicMaterial color={isCurrentTx ? "#bb00ff" : "#333"} />
                        </mesh>
                    </Float>
                );
            })}

            {/* Central Spire */}
            <mesh>
                <cylinderGeometry args={[0.2, 0.2, 8, 16]} />
                <meshStandardMaterial color="#333" />
            </mesh>

        </group>
    );
}
