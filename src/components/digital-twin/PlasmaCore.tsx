"use client";

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Text, Html } from "@react-three/drei";
import * as THREE from "three";
import { ViewState } from "@/types";

export default function PlasmaCore({ systemData, activeView }: { systemData: any, activeView: ViewState }) {
    const coreRef = useRef<THREE.Mesh>(null);
    const ringRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        const time = state.clock.getElapsedTime();
        if (coreRef.current) {
            coreRef.current.rotation.y = time * 0.5;
            coreRef.current.rotation.x = time * 0.2;

            // If we are looking at the reactor and have data, make it aggressive
            const isProcessing = activeView === "REACTOR" && systemData;
            const scale = isProcessing ? 1 + Math.sin(time * 5) * 0.1 : 1;
            coreRef.current.scale.set(scale, scale, scale);
        }

        if (ringRef.current) {
            ringRef.current.rotation.z = time;
            ringRef.current.rotation.x = Math.PI / 2; // Lie flat
        }
    });

    return (
        <group>
            {/* Central Plasma Orb */}
            <Float speed={1} rotationIntensity={0.5} floatIntensity={1}>
                <mesh ref={coreRef}>
                    <sphereGeometry args={[1.5, 64, 64]} />
                    <meshStandardMaterial
                        color="#FFB800"
                        emissive="#FF4500"
                        emissiveIntensity={2}
                        roughness={0.1}
                        metalness={0.8}
                        wireframe={activeView !== "REACTOR"}
                    />
                </mesh>
            </Float>

            {/* Containment Ring */}
            <mesh ref={ringRef} position={[0, 0, 0]}>
                <torusGeometry args={[2.5, 0.05, 16, 100]} />
                <meshStandardMaterial color="#00F2FF" emissive="#00F2FF" emissiveIntensity={2} />
            </mesh>

            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
                <cylinderGeometry args={[2, 2, 0.5, 32]} />
                <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
            </mesh>

            {/* Data Visualizations hovering near valves/core */}
            {systemData && activeView === "REACTOR" && (
                <>
                    <Text
                        position={[2.5, 1.5, 0]}
                        fontSize={0.4}
                        color="#ffffff"
                        anchorX="left"
                        anchorY="middle"
                        outlineWidth={0.02}
                        outlineColor="#000000"
                        font="https://fonts.gstatic.com/s/firamono/v14/N0bX2SlFPv1weGeLZDtgJv7S.woff"
                    >
                        {`SYNGAS YIELD:\nCH4: ${(systemData.ch4_kg * 0.4).toFixed(2)}kg\nH2: ${(systemData.mass_kg * 0.1).toFixed(2)}kg`}
                    </Text>

                    <Text
                        position={[-2.5, 1.5, 0]}
                        fontSize={0.4}
                        color="#FFB800"
                        anchorX="right"
                        anchorY="middle"
                        outlineWidth={0.02}
                        outlineColor="#000000"
                        font="https://fonts.gstatic.com/s/firamono/v14/N0bX2SlFPv1weGeLZDtgJv7S.woff"
                    >
                        {`ENERGY OUT:\n${(systemData.mass_kg * 1.2 * 1000).toFixed(0)} kWh`}
                    </Text>

                    <Html position={[0, 2.5, 0]} center zIndexRange={[100, 0]}>
                        <div className="bg-[#FFB800]/20 border border-[#FFB800] text-[#FFB800] px-2 py-1 text-[10px] font-mono whitespace-nowrap backdrop-blur-md animate-pulse">
                            CORE TEMP: 5500°C CRITICAL
                        </div>
                    </Html>
                </>
            )}
        </group>
    );
}
