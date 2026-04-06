import React, { useEffect, useState } from 'react';
import { useSeasonalTheme } from '../hooks/useSeasonalTheme.jsx';

const SeasonalEffects = ({ className }) => {
    const theme = useSeasonalTheme();
    const [particles, setParticles] = useState([]);

    useEffect(() => {
        if (!theme?.effect || theme.effect === 'none') {
            setParticles([]);
            return;
        }

        // Generate particles only once on mount/theme change
        const particleCount = theme.effect === 'snow' ? 50
            : (theme.effect === 'confetti' || theme.effect === 'tricolor') ? 40
                : theme.effect === 'kite' ? 12
                    : theme.effect === 'holi' ? 30
                        : theme.effect === 'eid' ? 35
                            : theme.effect === 'ugadi' ? 25
                                : theme.effect === 'ramnavami' ? 30
                                    : theme.effect === 'shivaratri' ? 28
                                        : theme.effect === 'hanuman' ? 25
                                            : 20;

        const kiteColors = ['#FF2D55', '#5856D6', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF', '#FF3B30', '#8E44AD', '#E74C3C', '#2ECC71', '#F1C40F'];

        const holiColors = ['#FF1493', '#FF6B35', '#FFEB3B', '#4CAF50', '#2196F3', '#9C27B0', '#E91E63', '#FF5722', '#00BCD4', '#FF4081', '#7C4DFF', '#F44336'];

        const eidColors = ['#FFD700', '#C0C0C0', '#2E7D32', '#1B5E20', '#FFF8E1'];

        const ugadiItems = ['🥭', '🌼', '🍃', '🌿', '🌸'];

        const ramNavamiItems = ['🌸', '🌺', '🪷', '✨', '🏵️'];

        const newParticles = Array.from({ length: particleCount }).map((_, i) => {
            const base = {
                id: i,
                left: Math.random() * 100 + 'vw',
                animationDelay: Math.random() * 8 + 's',
                opacity: Math.random() * 0.5 + 0.3,
                startX: Math.random() * 100 + 'vw',
                hue: Math.random() * 360,
            };

            if (theme.effect === 'holi') {
                return {
                    ...base,
                    animationDuration: Math.random() * 4 + 3 + 's',
                    size: Math.random() * 60 + 30 + 'px',
                    color: holiColors[Math.floor(Math.random() * holiColors.length)],
                    opacity: Math.random() * 0.6 + 0.2,
                    // Each particle gets a random secondary color for gradient
                    color2: holiColors[Math.floor(Math.random() * holiColors.length)],
                    variant: Math.floor(Math.random() * 3), // 0=burst, 1=splash, 2=powder
                };
            }

            if (theme.effect === 'eid') {
                const isCresc = Math.random() < 0.35;
                const isStar = !isCresc;
                return {
                    ...base,
                    animationDuration: Math.random() * 5 + 5 + 's',
                    size: isCresc ? Math.random() * 25 + 20 + 'px' : Math.random() * 15 + 8 + 'px',
                    color: eidColors[Math.floor(Math.random() * eidColors.length)],
                    opacity: Math.random() * 0.5 + 0.3,
                    isCrescent: isCresc,
                    isStar: isStar,
                    twinkleDelay: Math.random() * 3 + 's',
                };
            }

            if (theme.effect === 'ugadi') {
                return {
                    ...base,
                    animationDuration: Math.random() * 5 + 4 + 's',
                    size: Math.random() * 20 + 18 + 'px',
                    emoji: ugadiItems[Math.floor(Math.random() * ugadiItems.length)],
                    opacity: Math.random() * 0.5 + 0.4,
                    swayAmount: Math.random() * 40 + 20,
                };
            }

            if (theme.effect === 'ramnavami') {
                return {
                    ...base,
                    animationDuration: Math.random() * 5 + 4 + 's',
                    size: Math.random() * 20 + 14 + 'px',
                    emoji: ramNavamiItems[Math.floor(Math.random() * ramNavamiItems.length)],
                    opacity: Math.random() * 0.6 + 0.3,
                    glowColor: ['#FFD700', '#FF8C00', '#FFA500'][Math.floor(Math.random() * 3)],
                    rotationDir: Math.random() < 0.5 ? 1 : -1,
                };
            }

            if (theme.effect === 'shivaratri') {
                const shivaItems = ['🔱', '🕉️', '✨', '💠', '🌙'];
                return {
                    ...base,
                    animationDuration: Math.random() * 6 + 5 + 's',
                    size: Math.random() * 22 + 16 + 'px',
                    emoji: shivaItems[Math.floor(Math.random() * shivaItems.length)],
                    opacity: Math.random() * 0.5 + 0.3,
                    glowColor: ['#4F46E5', '#7C3AED', '#2563EB', '#6366F1', '#818CF8'][Math.floor(Math.random() * 5)],
                    isSvgOrb: Math.random() < 0.4,
                    orbColor: ['#4338CA', '#6D28D9', '#1E40AF'][Math.floor(Math.random() * 3)],
                };
            }

            if (theme.effect === 'hanuman') {
                const hanumanItems = ['🔥', '🪔', '✨', '🌺', '🏵️'];
                return {
                    ...base,
                    animationDuration: Math.random() * 5 + 4 + 's',
                    size: Math.random() * 20 + 15 + 'px',
                    emoji: hanumanItems[Math.floor(Math.random() * hanumanItems.length)],
                    opacity: Math.random() * 0.6 + 0.3,
                    glowColor: ['#FF6B00', '#FF8C00', '#FF4500', '#FFD700', '#E65100'][Math.floor(Math.random() * 5)],
                    isFlame: Math.random() < 0.35,
                    flameColor: ['#FF6D00', '#FF3D00', '#FFAB00'][Math.floor(Math.random() * 3)],
                };
            }

            // Default for existing effects
            return {
                ...base,
                animationDuration: theme.effect === 'kite' ? Math.random() * 5 + 8 + 's' : Math.random() * 3 + 2 + 's',
                animationDelay: Math.random() * 5 + 's',
                size: theme.effect === 'kite' ? Math.random() * 40 + 60 + 'px' : Math.random() * 10 + 5 + 'px',
                color: theme.effect === 'confetti'
                    ? ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'][Math.floor(Math.random() * 5)]
                    : theme.effect === 'tricolor'
                        ? ['#FF9933', '#FFFFFF', '#138808'][Math.floor(Math.random() * 3)]
                        : theme.effect === 'kite'
                            ? kiteColors[Math.floor(Math.random() * kiteColors.length)]
                            : theme.effect === 'snow'
                                ? 'var(--snow-color)'
                                : '#FFF',
                colors: theme.effect === 'kite'
                    ? Array.from({ length: 4 }).map(() => kiteColors[Math.floor(Math.random() * kiteColors.length)])
                    : null,
                sway: -1,
                isCut: theme.effect === 'kite' ? Math.random() < 0.4 : false,
                isSolid: theme.effect === 'kite' ? true : false,
            };
        });

        setParticles(newParticles);
    }, [theme]);

    if (!theme || !theme.effect || theme.effect === 'none') return null;

    return (
        <div className={`fixed inset-0 pointer-events-none overflow-hidden ${className || 'z-0'}`} aria-hidden="true">
            <style>
                {`
          :root { --seasonal-thread: #4b5563; --snow-color: rgba(255,255,255,0.8); }
          .dark { --seasonal-thread: #cbd5e1; }
          @media (prefers-color-scheme: dark) {
            :root:not(.light) { --seasonal-thread: #cbd5e1; }
          }

          /* === Existing Animations === */
          @keyframes seasonal-fall {
            0% { top: -10vh; transform: translateX(0) rotate(0deg); opacity: 0; }
            10% { opacity: 1; }
            100% { top: 100vh; transform: translateX(20px) rotate(360deg); opacity: 0; }
          }
          @keyframes seasonal-float-up {
            0% { transform: translateY(100vh) scale(0.5); opacity: 0; }
            10% { opacity: 0.8; }
            100% { transform: translateY(-10vh) scale(1.5); opacity: 0; }
          }
          @keyframes kite-fly-up {
            0% { transform: translate(var(--sx), 110vh) rotate(0deg) scale(0.5); opacity: 0; }
            10% { opacity: 1; transform: translate(calc(var(--sx) - 3vw), 90vh) rotate(-5deg) scale(0.6); }
            50% { transform: translate(calc(var(--sx) - 5vw), 50vh) rotate(5deg) scale(0.8); }
            100% { transform: translate(calc(var(--sx) - 8vw), -20vh) rotate(0deg) scale(1); opacity: 0; }
          }
          @keyframes kite-fall-down {
            0% { transform: translate(var(--sx), -20vh) rotate(-30deg) scale(0.8); opacity: 0; }
            10% { opacity: 1; transform: translate(calc(var(--sx) - 2vw), 10vh) rotate(-40deg) scale(0.8); }
            50% { transform: translate(calc(var(--sx) - 5vw), 60vh) rotate(-60deg) scale(0.7); }
            100% { transform: translate(calc(var(--sx) - 8vw), 120vh) rotate(-80deg) scale(0.6); opacity: 0; }
          }

          /* === HOLI: Color Powder Burst === */
          @keyframes holi-burst {
            0% { 
              transform: translate(0, 50vh) scale(0); 
              opacity: 0; 
              filter: blur(0px);
            }
            15% { 
              opacity: 0.9; 
              transform: translate(0, 40vh) scale(0.5);
              filter: blur(2px);
            }
            40% { 
              transform: translate(var(--drift-x, 10px), 20vh) scale(1.2); 
              opacity: 0.7;
              filter: blur(4px);
            }
            70% { 
              transform: translate(calc(var(--drift-x, 10px) * 1.5), 5vh) scale(1.8); 
              opacity: 0.3;
              filter: blur(8px);
            }
            100% { 
              transform: translate(calc(var(--drift-x, 10px) * 2), -10vh) scale(2.5); 
              opacity: 0;
              filter: blur(15px);
            }
          }
          @keyframes holi-splash {
            0% { 
              transform: translate(0, -10vh) scale(0.3); 
              opacity: 0;
            }
            20% { 
              opacity: 0.8; 
              transform: translate(var(--drift-x, -5px), 20vh) scale(0.8);
              filter: blur(1px);
            }
            50% { 
              transform: translate(calc(var(--drift-x, -5px) * 2), 50vh) scale(1.3); 
              opacity: 0.6;
              filter: blur(3px);
            }
            80% { 
              transform: translate(calc(var(--drift-x, -5px) * 3), 75vh) scale(1.6); 
              opacity: 0.2;
              filter: blur(6px);
            }
            100% { 
              transform: translate(calc(var(--drift-x, -5px) * 4), 100vh) scale(2); 
              opacity: 0;
              filter: blur(10px);
            }
          }
          @keyframes holi-powder {
            0% { 
              transform: translate(0, 30vh) scale(0.2) rotate(0deg); 
              opacity: 0;
            }
            10% { opacity: 0.7; }
            30% { 
              transform: translate(15px, 15vh) scale(1) rotate(90deg); 
              opacity: 0.8;
              filter: blur(2px);
            }
            60% { 
              transform: translate(-10px, 0vh) scale(1.5) rotate(180deg); 
              opacity: 0.4;
              filter: blur(5px);
            }
            100% { 
              transform: translate(20px, -20vh) scale(2) rotate(360deg); 
              opacity: 0;
              filter: blur(12px);
            }
          }

          /* === EID: Floating Crescents & Twinkling Stars === */
          @keyframes eid-crescent {
            0% { 
              transform: translateY(-10vh) rotate(-15deg) scale(0.6); 
              opacity: 0; 
            }
            15% { opacity: 0.8; }
            50% { 
              transform: translateY(45vh) translateX(calc(var(--drift-x, 0px) * 1)) rotate(10deg) scale(0.9); 
              opacity: 0.7;
              filter: drop-shadow(0 0 8px var(--glow-color, #FFD700));
            }
            100% { 
              transform: translateY(105vh) translateX(calc(var(--drift-x, 0px) * 2)) rotate(25deg) scale(0.7); 
              opacity: 0;
            }
          }
          @keyframes eid-star-twinkle {
            0% { 
              transform: translateY(-5vh) scale(0); 
              opacity: 0;
            }
            20% { 
              transform: translateY(15vh) scale(1.2); 
              opacity: 1;
              filter: drop-shadow(0 0 6px var(--glow-color, #FFD700));
            }
            40% { 
              transform: translateY(35vh) scale(0.8); 
              opacity: 0.4;
            }
            60% { 
              transform: translateY(55vh) scale(1.1); 
              opacity: 0.9;
              filter: drop-shadow(0 0 10px var(--glow-color, #FFD700));
            }
            80% { 
              transform: translateY(75vh) scale(0.7); 
              opacity: 0.3;
            }
            100% { 
              transform: translateY(105vh) scale(0.5); 
              opacity: 0;
            }
          }

          /* === UGADI: Gentle Sway & Drift === */
          @keyframes ugadi-drift {
            0% { 
              transform: translateY(-10vh) translateX(0) rotate(0deg); 
              opacity: 0; 
            }
            10% { opacity: 0.9; }
            25% { 
              transform: translateY(20vh) translateX(var(--sway, 25px)) rotate(45deg); 
            }
            50% { 
              transform: translateY(50vh) translateX(calc(var(--sway, 25px) * -0.7)) rotate(130deg); 
              opacity: 0.8;
            }
            75% { 
              transform: translateY(75vh) translateX(var(--sway, 25px)) rotate(250deg); 
              opacity: 0.5;
            }
            100% { 
              transform: translateY(105vh) translateX(calc(var(--sway, 25px) * -0.3)) rotate(360deg); 
              opacity: 0;
            }
          }

          /* === RAM NAVAMI: Divine Petal Rain with Golden Glow === */
          @keyframes ramnavami-petal {
            0% { 
              transform: translateY(-10vh) translateX(0) rotate(0deg) scale(0.5); 
              opacity: 0; 
              filter: drop-shadow(0 0 0px transparent);
            }
            15% { 
              opacity: 0.9; 
              transform: translateY(10vh) translateX(10px) rotate(30deg) scale(0.9);
              filter: drop-shadow(0 0 4px var(--glow, #FFD700));
            }
            35% { 
              transform: translateY(30vh) translateX(-15px) rotate(90deg) scale(1.1);
              filter: drop-shadow(0 0 8px var(--glow, #FFD700));
              opacity: 0.8;
            }
            55% { 
              transform: translateY(50vh) translateX(20px) rotate(180deg) scale(1);
              filter: drop-shadow(0 0 12px var(--glow, #FFA500));
              opacity: 0.6;
            }
            75% { 
              transform: translateY(70vh) translateX(-10px) rotate(270deg) scale(0.9);
              filter: drop-shadow(0 0 6px var(--glow, #FFD700));
              opacity: 0.3;
            }
            100% { 
              transform: translateY(105vh) translateX(5px) rotate(360deg) scale(0.7); 
              opacity: 0;
              filter: drop-shadow(0 0 0px transparent);
            }
          }
          @keyframes ramnavami-glow-pulse {
            0%, 100% { filter: drop-shadow(0 0 3px var(--glow, #FFD700)); }
            50% { filter: drop-shadow(0 0 15px var(--glow, #FFA500)); }
          }

          /* === SHIVARATRI: Mystical Float with Blue/Purple Aura === */
          @keyframes shivaratri-float {
            0% { 
              transform: translateY(110vh) translateX(0) scale(0.3); 
              opacity: 0; 
            }
            15% { 
              opacity: 0.8; 
              transform: translateY(85vh) translateX(8px) scale(0.7);
              filter: drop-shadow(0 0 6px var(--glow, #6366F1));
            }
            40% { 
              transform: translateY(55vh) translateX(-12px) scale(1);
              filter: drop-shadow(0 0 12px var(--glow, #7C3AED));
              opacity: 0.9;
            }
            65% { 
              transform: translateY(30vh) translateX(15px) scale(1.1);
              filter: drop-shadow(0 0 18px var(--glow, #4F46E5));
              opacity: 0.6;
            }
            85% { 
              transform: translateY(10vh) translateX(-5px) scale(0.9);
              filter: drop-shadow(0 0 10px var(--glow, #6366F1));
              opacity: 0.3;
            }
            100% { 
              transform: translateY(-10vh) translateX(0) scale(0.5); 
              opacity: 0;
              filter: drop-shadow(0 0 0px transparent);
            }
          }
          @keyframes shivaratri-orb {
            0% { 
              transform: translateY(110vh) scale(0.2); 
              opacity: 0; 
            }
            20% { 
              opacity: 0.7; 
              transform: translateY(80vh) scale(0.8);
            }
            50% { 
              transform: translateY(45vh) scale(1.2);
              opacity: 0.5;
            }
            80% { 
              transform: translateY(15vh) scale(0.9);
              opacity: 0.2;
            }
            100% { 
              transform: translateY(-15vh) scale(0.4); 
              opacity: 0;
            }
          }

          /* === HANUMAN: Saffron Flame Rise === */
          @keyframes hanuman-rise {
            0% { 
              transform: translateY(110vh) translateX(0) scale(0.4); 
              opacity: 0; 
            }
            10% { 
              opacity: 0.9;
              transform: translateY(90vh) translateX(5px) scale(0.7);
              filter: drop-shadow(0 0 5px var(--glow, #FF6B00));
            }
            30% { 
              transform: translateY(65vh) translateX(-10px) scale(1);
              filter: drop-shadow(0 0 10px var(--glow, #FF8C00));
              opacity: 0.8;
            }
            50% { 
              transform: translateY(40vh) translateX(12px) scale(1.15);
              filter: drop-shadow(0 0 16px var(--glow, #FF4500));
              opacity: 0.7;
            }
            70% { 
              transform: translateY(20vh) translateX(-8px) scale(1);
              filter: drop-shadow(0 0 12px var(--glow, #FFD700));
              opacity: 0.4;
            }
            100% { 
              transform: translateY(-10vh) translateX(0) scale(0.6); 
              opacity: 0;
              filter: drop-shadow(0 0 0px transparent);
            }
          }
          @keyframes hanuman-flame {
            0% { 
              transform: translateY(105vh) scale(0.3) rotate(0deg); 
              opacity: 0; 
            }
            15% { 
              opacity: 0.8;
              transform: translateY(85vh) scale(0.7) rotate(10deg);
            }
            40% { 
              transform: translateY(55vh) scale(1.1) rotate(-5deg);
              opacity: 0.9;
            }
            60% { 
              transform: translateY(35vh) scale(1.3) rotate(8deg);
              opacity: 0.6;
            }
            80% { 
              transform: translateY(15vh) scale(1) rotate(-3deg);
              opacity: 0.3;
            }
            100% { 
              transform: translateY(-10vh) scale(0.5) rotate(0deg); 
              opacity: 0;
            }
          }
          @keyframes hanuman-glow-pulse {
            0%, 100% { filter: drop-shadow(0 0 4px var(--glow, #FF6B00)); }
            50% { filter: drop-shadow(0 0 18px var(--glow, #FF4500)); }
          }
        `}
            </style>

            {particles.map((p) => {
                // === SHIVARATRI EFFECT ===
                if (theme.effect === 'shivaratri') {
                    if (p.isSvgOrb) {
                        return (
                            <div
                                key={p.id}
                                className="absolute"
                                style={{
                                    left: p.left,
                                    width: parseInt(p.size) * 1.8 + 'px',
                                    height: parseInt(p.size) * 1.8 + 'px',
                                    opacity: p.opacity,
                                    animation: `shivaratri-orb ${p.animationDuration} ease-in-out ${p.animationDelay} infinite`,
                                }}
                            >
                                <svg width="100%" height="100%" viewBox="0 0 50 50">
                                    <defs>
                                        <radialGradient id={`shiva-orb-${p.id}`} cx="50%" cy="50%" r="50%">
                                            <stop offset="0%" stopColor={p.orbColor} stopOpacity="0.9" />
                                            <stop offset="50%" stopColor={p.glowColor} stopOpacity="0.4" />
                                            <stop offset="100%" stopColor={p.orbColor} stopOpacity="0" />
                                        </radialGradient>
                                    </defs>
                                    <circle cx="25" cy="25" r="24" fill={`url(#shiva-orb-${p.id})`} />
                                    <circle cx="25" cy="25" r="10" fill={p.glowColor} opacity="0.6" />
                                </svg>
                            </div>
                        );
                    }
                    return (
                        <div
                            key={p.id}
                            className="absolute"
                            style={{
                                left: p.left,
                                fontSize: p.size,
                                opacity: p.opacity,
                                animation: `shivaratri-float ${p.animationDuration} ease-in-out ${p.animationDelay} infinite`,
                                '--glow': p.glowColor,
                                filter: `drop-shadow(0 0 8px ${p.glowColor})`,
                            }}
                        >
                            {p.emoji}
                        </div>
                    );
                }

                // === HANUMAN EFFECT ===
                if (theme.effect === 'hanuman') {
                    if (p.isFlame) {
                        return (
                            <div
                                key={p.id}
                                className="absolute"
                                style={{
                                    left: p.left,
                                    width: parseInt(p.size) * 1.5 + 'px',
                                    height: parseInt(p.size) * 2 + 'px',
                                    opacity: p.opacity,
                                    animation: `hanuman-flame ${p.animationDuration} ease-out ${p.animationDelay} infinite`,
                                }}
                            >
                                <svg width="100%" height="100%" viewBox="0 0 40 60" style={{ overflow: 'visible', filter: `drop-shadow(0 0 8px ${p.flameColor})` }}>
                                    <defs>
                                        <linearGradient id={`flame-${p.id}`} x1="0" y1="1" x2="0" y2="0">
                                            <stop offset="0%" stopColor="#FFD700" />
                                            <stop offset="40%" stopColor={p.flameColor} />
                                            <stop offset="100%" stopColor="#FF4500" stopOpacity="0.3" />
                                        </linearGradient>
                                    </defs>
                                    <path d="M20,2 C20,2 5,25 8,40 C10,50 15,55 20,58 C25,55 30,50 32,40 C35,25 20,2 20,2 Z" fill={`url(#flame-${p.id})`} opacity="0.9" />
                                    <path d="M20,15 C20,15 12,30 14,42 C16,50 18,53 20,55 C22,53 24,50 26,42 C28,30 20,15 20,15 Z" fill="#FFD700" opacity="0.7" />
                                </svg>
                            </div>
                        );
                    }
                    return (
                        <div
                            key={p.id}
                            className="absolute"
                            style={{
                                left: p.left,
                                fontSize: p.size,
                                opacity: p.opacity,
                                animation: `hanuman-rise ${p.animationDuration} ease-out ${p.animationDelay} infinite, hanuman-glow-pulse 2.5s ease-in-out ${p.animationDelay} infinite`,
                                '--glow': p.glowColor,
                                filter: `drop-shadow(0 0 6px ${p.glowColor})`,
                            }}
                        >
                            {p.emoji}
                        </div>
                    );
                }

                // === HOLI EFFECT ===
                if (theme.effect === 'holi') {
                    const animNames = ['holi-burst', 'holi-splash', 'holi-powder'];
                    const animName = animNames[p.variant || 0];
                    const driftX = (Math.random() - 0.5) * 60 + 'px';

                    return (
                        <div
                            key={p.id}
                            className="absolute"
                            style={{
                                left: p.left,
                                width: p.size,
                                height: p.size,
                                opacity: p.opacity,
                                animation: `${animName} ${p.animationDuration} ease-out ${p.animationDelay} infinite`,
                                '--drift-x': driftX,
                            }}
                        >
                            <svg width="100%" height="100%" viewBox="0 0 60 60">
                                <defs>
                                    <radialGradient id={`holi-grad-${p.id}`} cx="50%" cy="50%" r="50%">
                                        <stop offset="0%" stopColor={p.color} stopOpacity="0.9" />
                                        <stop offset="40%" stopColor={p.color2 || p.color} stopOpacity="0.6" />
                                        <stop offset="100%" stopColor={p.color} stopOpacity="0" />
                                    </radialGradient>
                                </defs>
                                <circle cx="30" cy="30" r="28" fill={`url(#holi-grad-${p.id})`} />
                                {/* Inner splatter dots */}
                                <circle cx={20 + Math.random() * 20} cy={15 + Math.random() * 10} r={3 + Math.random() * 4} fill={p.color2 || p.color} opacity="0.7" />
                                <circle cx={10 + Math.random() * 15} cy={30 + Math.random() * 15} r={2 + Math.random() * 3} fill={p.color} opacity="0.5" />
                                <circle cx={35 + Math.random() * 15} cy={35 + Math.random() * 15} r={2 + Math.random() * 5} fill={p.color2 || p.color} opacity="0.6" />
                            </svg>
                        </div>
                    );
                }

                // === EID EFFECT ===
                if (theme.effect === 'eid') {
                    const driftX = (Math.random() - 0.5) * 40 + 'px';

                    if (p.isCrescent) {
                        return (
                            <div
                                key={p.id}
                                className="absolute"
                                style={{
                                    left: p.left,
                                    width: p.size,
                                    height: p.size,
                                    opacity: p.opacity,
                                    animation: `eid-crescent ${p.animationDuration} ease-in-out ${p.animationDelay} infinite`,
                                    '--drift-x': driftX,
                                    '--glow-color': p.color,
                                }}
                            >
                                <svg width="100%" height="100%" viewBox="0 0 50 50" style={{ overflow: 'visible', filter: `drop-shadow(0 0 5px ${p.color})` }}>
                                    {/* Crescent moon */}
                                    <path
                                        d="M25,5 A20,20 0 1,0 25,45 A14,14 0 1,1 25,5"
                                        fill={p.color}
                                        opacity="0.9"
                                    />
                                    {/* Small star next to crescent */}
                                    <polygon
                                        points="40,12 42,18 48,18 43,22 45,28 40,24 35,28 37,22 32,18 38,18"
                                        fill="#FFD700"
                                        opacity="0.8"
                                        transform="scale(0.5) translate(50, 10)"
                                    />
                                </svg>
                            </div>
                        );
                    }

                    // Star particle
                    return (
                        <div
                            key={p.id}
                            className="absolute"
                            style={{
                                left: p.left,
                                width: p.size,
                                height: p.size,
                                opacity: p.opacity,
                                animation: `eid-star-twinkle ${p.animationDuration} ease-in-out ${p.animationDelay} infinite`,
                                '--glow-color': p.color,
                            }}
                        >
                            <svg width="100%" height="100%" viewBox="0 0 30 30" style={{ overflow: 'visible', filter: `drop-shadow(0 0 4px ${p.color})` }}>
                                <polygon
                                    points="15,2 18,11 27,11 20,17 22,27 15,21 8,27 10,17 3,11 12,11"
                                    fill={p.color}
                                    opacity="0.9"
                                />
                            </svg>
                        </div>
                    );
                }

                // === UGADI EFFECT ===
                if (theme.effect === 'ugadi') {
                    return (
                        <div
                            key={p.id}
                            className="absolute"
                            style={{
                                left: p.left,
                                fontSize: p.size,
                                opacity: p.opacity,
                                animation: `ugadi-drift ${p.animationDuration} ease-in-out ${p.animationDelay} infinite`,
                                '--sway': p.swayAmount + 'px',
                            }}
                        >
                            {p.emoji}
                        </div>
                    );
                }

                // === RAM NAVAMI EFFECT ===
                if (theme.effect === 'ramnavami') {
                    return (
                        <div
                            key={p.id}
                            className="absolute"
                            style={{
                                left: p.left,
                                fontSize: p.size,
                                opacity: p.opacity,
                                animation: `ramnavami-petal ${p.animationDuration} ease-in-out ${p.animationDelay} infinite, ramnavami-glow-pulse 2s ease-in-out ${p.animationDelay} infinite`,
                                '--glow': p.glowColor,
                                filter: `drop-shadow(0 0 6px ${p.glowColor})`,
                            }}
                        >
                            {p.emoji}
                        </div>
                    );
                }

                // === DEFAULT EXISTING EFFECTS ===
                let animationName = 'seasonal-fall';
                if (theme.effect === 'hearts' || theme.effect === 'float-up') animationName = 'seasonal-float-up';
                else if (theme.effect === 'kite') {
                    animationName = p.isCut ? 'kite-fall-down' : 'kite-fly-up';
                }

                let content = '';
                if (theme.effect === 'hearts') content = '❤️';
                else if (theme.effect === 'kite') {
                    const c = p.colors || [p.color, p.color, p.color, p.color];
                    content = p.isSolid ? (
                        <svg width="100%" height="100%" viewBox="0 0 50 85" style={{ overflow: 'visible', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.2))' }}>
                            <path d="M25,0 L0,20 L25,20 Z" fill={c[0]} />
                            <path d="M25,0 L50,20 L25,20 Z" fill={c[1]} />
                            <path d="M25,20 L0,20 L25,60 Z" fill={c[2]} />
                            <path d="M25,20 L50,20 L25,60 Z" fill={c[3]} />
                            <path d="M25,0 L25,60" stroke="rgba(0,0,0,0.2)" strokeWidth="0.5" />
                            <path d="M0,20 Q25,28 50,20" stroke="rgba(0,0,0,0.2)" strokeWidth="0.5" fill="none" />
                            <path d="M25,60 Q15,70 35,75 T25,85" stroke={c[2]} strokeWidth="3" fill="none" strokeLinecap="round" />
                        </svg>
                    ) : '🪁';
                }
                else if (theme.effect === 'leaf') content = '🍃';
                else if (theme.effect === 'flower') content = '🌺';
                else if (theme.effect === 'moon') content = '🌙';
                else if (theme.effect === 'lantern') content = '🏮';
                else if (theme.effect === 'mango') content = '🥭';

                const isKite = theme.effect === 'kite';

                return (
                    <div
                        key={p.id}
                        className="absolute flex justify-center"
                        style={{
                            left: p.left,
                            width: content ? 'auto' : p.size,
                            height: (content && typeof content === 'string') ? 'auto' : p.size,
                            backgroundColor: (content && typeof content === 'string') ? 'transparent' : (isKite && p.isSolid) ? 'transparent' : p.color,
                            borderRadius: theme.effect === 'snow' ? '50%' : '0%',
                            fontSize: (content && typeof content === 'string') ? p.size : 0,
                            opacity: p.opacity,
                            animation: `${animationName} ${p.animationDuration} ease-in-out ${p.animationDelay} infinite`,
                            filter: (isKite && !p.isSolid) ? `hue-rotate(${p.hue}deg)` : 'none',
                            '--sx': p.startX || p.left
                        }}
                    >
                        <div style={{ zIndex: 10, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>{content}</div>

                        {isKite && (
                            <svg
                                className="absolute pointer-events-none"
                                width={p.isCut ? "40" : "400"}
                                height={p.isCut ? "150" : "1000"}
                                viewBox={p.isCut ? "0 0 40 150" : "0 0 400 1000"}
                                style={{
                                    top: p.isSolid ? '70%' : '50%',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    marginTop: p.isSolid ? '0px' : '5px',
                                    zIndex: 0,
                                    overflow: 'visible',
                                    opacity: p.isCut ? 0.8 : 0.6
                                }}
                            >
                                {p.isCut ? (
                                    <path
                                        d="M20,0 C20,20 40,50 60,100"
                                        stroke="var(--seasonal-thread)"
                                        strokeWidth="1.5"
                                        fill="none"
                                    />
                                ) : (
                                    <path
                                        d="M200,0 L450,1000"
                                        stroke="var(--seasonal-thread)"
                                        strokeWidth="1.5"
                                        fill="none"
                                    />
                                )}
                            </svg>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default SeasonalEffects;
