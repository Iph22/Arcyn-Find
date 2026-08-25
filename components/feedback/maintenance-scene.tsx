"use client"

import { useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Points, PointMaterial } from "@react-three/drei"

function inSphere(buffer: Float32Array, options: { radius: number }) {
    for (let i = 0; i < buffer.length; i += 3) {
        const u = Math.random()
        const v = Math.random()
        const theta = 2 * Math.PI * u
        const phi = Math.acos(2 * v - 1)
        const r = Math.cbrt(Math.random()) * options.radius
        const sinPhi = Math.sin(phi)
        buffer[i] = r * sinPhi * Math.cos(theta)
        buffer[i + 1] = r * sinPhi * Math.sin(theta)
        buffer[i + 2] = r * Math.cos(phi)
    }
    return buffer
}

function Stars(props: any) {
    const ref = useRef<any>(null)
    const [sphere] = useState(() => inSphere(new Float32Array(5000), { radius: 1.5 }))

    useFrame((state, delta) => {
        if (ref.current) {
            ref.current.rotation.x -= delta / 10
            ref.current.rotation.y -= delta / 15
        }
    })

    return (
        <group rotation={[0, 0, Math.PI / 4]}>
            <Points ref={ref} positions={sphere} stride={3} frustumCulled={false} {...props}>
                <PointMaterial
                    transparent
                    color="#ffffff"
                    size={0.002}
                    sizeAttenuation={true}
                    depthWrite={false}
                />
            </Points>
        </group>
    )
}

export default function MaintenanceScene() {
    return (
        <div className="absolute inset-0 -z-10">
            <Canvas camera={{ position: [0, 0, 1] }}>
                <Stars />
            </Canvas>
        </div>
    )
}


