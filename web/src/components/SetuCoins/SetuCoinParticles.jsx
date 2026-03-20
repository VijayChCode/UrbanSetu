import React, { useEffect, useState } from 'react';
import { FaCoins } from 'react-icons/fa';

/**
 * A "delight" component that creates a burst of coin particles.
 * Trigger this by setting 'active' to true.
 */
export default function SetuCoinParticles({ active, onComplete, count = 12 }) {
    const [particles, setParticles] = useState([]);

    const onCompleteRef = React.useRef(onComplete);
    useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);

    useEffect(() => {
        if (active) {
            const newParticles = Array.from({ length: count }).map((_, i) => ({
                id: Math.random(),
                angle: (Math.PI * 2 * i) / count + (Math.random() * 0.5),
                velocity: 3 + Math.random() * 5,
                rotation: Math.random() * 360,
                delay: Math.random() * 0.2
            }));
            setParticles(newParticles);

            const timer = setTimeout(() => {
                setParticles([]);
                if (onCompleteRef.current) onCompleteRef.current();
            }, 2000);

            return () => clearTimeout(timer);
        }
    }, [active, count]);

    if (!active || particles.length === 0) return null;

    return (
        <div className="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center">
            <style>
                {`
                @keyframes coinFloat {
                    0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
                    80% { opacity: 1; }
                    100% { transform: translate(var(--tw-tx), var(--tw-ty)) rotate(var(--tw-tr)); opacity: 0; }
                }
                .coin-particle {
                    animation: coinFloat 1.2s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
                    animation-delay: var(--tw-delay);
                }
                `}
            </style>
            {particles.map((p) => {
                const tx = Math.cos(p.angle) * 200 * (p.velocity / 5) + 'px';
                const ty = Math.sin(p.angle) * 200 * (p.velocity / 5) - 100 + 'px'; // Float upward slightly
                const tr = p.rotation + 720 + 'deg';

                return (
                    <div
                        key={p.id}
                        className="coin-particle absolute text-yellow-500 text-2xl"
                        style={{
                            '--tw-tx': tx,
                            '--tw-ty': ty,
                            '--tw-tr': tr,
                            '--tw-delay': p.delay + 's'
                        }}
                    >
                        <FaCoins className="drop-shadow-lg" />
                    </div>
                );
            })}
        </div>
    );
}
