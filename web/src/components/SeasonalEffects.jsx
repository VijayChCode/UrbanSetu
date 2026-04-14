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

        const particleCount = theme.effect === 'snow' ? 50
            : (theme.effect === 'confetti' || theme.effect === 'tricolor') ? 40
                : theme.effect === 'kite' ? 12
                    : theme.effect === 'holi' ? 30
                        : theme.effect === 'eid' ? 35
                            : theme.effect === 'ugadi' ? 25
                                : theme.effect === 'ramnavami' ? 30
                                    : theme.effect === 'shivaratri' ? 28
                                        : theme.effect === 'hanuman' ? 25
                                            : theme.effect === 'ambedkar' ? 32
                                                : theme.effect === 'baisakhi' ? 30
                                                    : (theme.effect === 'sparkle' || theme.effect === 'sun') ? 35
                                                : (theme.effect === 'bonfire' || theme.effect === 'candle' || theme.effect === 'peacock' || theme.effect === 'rakhi') ? 22
                                                    : 20;

        const kiteColors = ['#FF2D55', '#5856D6', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF', '#FF3B30', '#8E44AD', '#E74C3C', '#2ECC71', '#F1C40F'];
        const holiColors = ['#FF1493', '#FF6B35', '#FFEB3B', '#4CAF50', '#2196F3', '#9C27B0', '#E91E63', '#FF5722', '#00BCD4', '#FF4081', '#7C4DFF', '#F44336'];
        const eidColors = ['#FFD700', '#C0C0C0', '#2E7D32', '#1B5E20', '#FFF8E1'];
        const ugadiItems = ['🥭', '🌼', '🍃', '🌿', '🌸'];
        const ramNavamiItems = ['🌸', '🌺', '🪷', '✨', '🏵️'];
        const shivaItems = ['🔱', '🕉️', '✨', '💠', '🌙'];
        const hanumanItems = ['🔥', '🪔', '✨', '🌺', '🏵️'];
        const ambedkarItems = ['⚖️', '📖', '💙', '✨', '🌸'];
        const baisakhiItems = ['🌾', '🥁', '🌻', '✨', '🏵️'];

        const newParticles = Array.from({ length: particleCount }).map((_, i) => {
            // 3D depth layer: 0=far, 1=mid, 2=near
            const depthLayer = Math.floor(Math.random() * 3);
            const depthScale = [0.5, 0.8, 1.2][depthLayer];
            const depthZ = [-80, 0, 60][depthLayer];
            const depthSpeed = [1.4, 1.0, 0.7][depthLayer]; // far=slow, near=fast
            const depthOpacity = [0.3, 0.6, 0.85][depthLayer];

            const base = {
                id: i,
                left: Math.random() * 100 + 'vw',
                animationDelay: Math.random() * 8 + 's',
                opacity: depthOpacity + Math.random() * 0.15,
                startX: Math.random() * 100 + 'vw',
                hue: Math.random() * 360,
                depthLayer,
                depthScale,
                depthZ,
                depthSpeed,
                // 3D rotation seeds
                rotX: Math.random() * 360,
                rotY: Math.random() * 360,
                rotZ: Math.random() * 360,
                rotDir: Math.random() < 0.5 ? 1 : -1,
            };

            if (theme.effect === 'holi') {
                return {
                    ...base,
                    animationDuration: (Math.random() * 4 + 3) * depthSpeed + 's',
                    size: (Math.random() * 50 + 25) * depthScale + 'px',
                    color: holiColors[Math.floor(Math.random() * holiColors.length)],
                    color2: holiColors[Math.floor(Math.random() * holiColors.length)],
                    opacity: (Math.random() * 0.5 + 0.2) * (depthLayer === 0 ? 0.5 : 1),
                    variant: Math.floor(Math.random() * 3),
                };
            }

            if (theme.effect === 'eid') {
                const isCresc = Math.random() < 0.35;
                return {
                    ...base,
                    animationDuration: (Math.random() * 5 + 5) * depthSpeed + 's',
                    size: (isCresc ? Math.random() * 25 + 20 : Math.random() * 15 + 8) * depthScale + 'px',
                    color: eidColors[Math.floor(Math.random() * eidColors.length)],
                    isCrescent: isCresc,
                    isStar: !isCresc,
                };
            }

            if (theme.effect === 'ugadi') {
                return {
                    ...base,
                    animationDuration: (Math.random() * 5 + 4) * depthSpeed + 's',
                    size: (Math.random() * 18 + 16) * depthScale + 'px',
                    emoji: ugadiItems[Math.floor(Math.random() * ugadiItems.length)],
                    swayAmount: Math.random() * 40 + 20,
                };
            }

            if (theme.effect === 'ramnavami') {
                return {
                    ...base,
                    animationDuration: (Math.random() * 5 + 4) * depthSpeed + 's',
                    size: (Math.random() * 20 + 14) * depthScale + 'px',
                    emoji: ramNavamiItems[Math.floor(Math.random() * ramNavamiItems.length)],
                    glowColor: ['#FFD700', '#FF8C00', '#FFA500'][Math.floor(Math.random() * 3)],
                };
            }

            if (theme.effect === 'shivaratri') {
                return {
                    ...base,
                    animationDuration: (Math.random() * 6 + 5) * depthSpeed + 's',
                    size: (Math.random() * 22 + 16) * depthScale + 'px',
                    emoji: shivaItems[Math.floor(Math.random() * shivaItems.length)],
                    glowColor: ['#4F46E5', '#7C3AED', '#2563EB', '#6366F1', '#818CF8'][Math.floor(Math.random() * 5)],
                    isSvgOrb: Math.random() < 0.4,
                    orbColor: ['#4338CA', '#6D28D9', '#1E40AF'][Math.floor(Math.random() * 3)],
                };
            }

            if (theme.effect === 'hanuman') {
                return {
                    ...base,
                    animationDuration: (Math.random() * 5 + 4) * depthSpeed + 's',
                    size: (Math.random() * 20 + 15) * depthScale + 'px',
                    emoji: hanumanItems[Math.floor(Math.random() * hanumanItems.length)],
                    glowColor: ['#FF6B00', '#FF8C00', '#FF4500', '#FFD700', '#E65100'][Math.floor(Math.random() * 5)],
                    isFlame: Math.random() < 0.35,
                    flameColor: ['#FF6D00', '#FF3D00', '#FFAB00'][Math.floor(Math.random() * 3)],
                };
            }

            if (theme.effect === 'ambedkar') {
                return {
                    ...base,
                    animationDuration: (Math.random() * 6 + 5) * depthSpeed + 's',
                    size: (Math.random() * 22 + 16) * depthScale + 'px',
                    emoji: ambedkarItems[Math.floor(Math.random() * ambedkarItems.length)],
                    glowColor: ['#2563EB', '#3B82F6', '#1D4ED8', '#60A5FA'][Math.floor(Math.random() * 4)],
                    isBlueSparkle: Math.random() < 0.3,
                };
            }

            if (theme.effect === 'baisakhi') {
                return {
                    ...base,
                    animationDuration: (Math.random() * 5 + 6) * depthSpeed + 's',
                    size: (Math.random() * 24 + 18) * depthScale + 'px',
                    emoji: baisakhiItems[Math.floor(Math.random() * baisakhiItems.length)],
                    glowColor: ['#F59E0B', '#FCD34D', '#FBBF24', '#D97706'][Math.floor(Math.random() * 4)],
                };
            }

            // Default for existing effects (snow, confetti, tricolor, kite, etc.)
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
                isSolid: theme.effect === 'kite',
            };
        });

        setParticles(newParticles);
    }, [theme]);

    if (!theme || !theme.effect || theme.effect === 'none') return null;

    // Check if this is one of our 3D-enhanced effects
    const is3D = ['holi', 'eid', 'ugadi', 'ramnavami', 'shivaratri', 'hanuman', 'ambedkar', 'baisakhi'].includes(theme.effect);

    return (
        <div
            className={`fixed inset-0 pointer-events-none overflow-hidden ${className || 'z-0'}`}
            aria-hidden="true"
            style={is3D ? { perspective: '900px', perspectiveOrigin: '50% 50%' } : undefined}
        >
            <style>
                {`
          :root { --seasonal-thread: #4b5563; --snow-color: rgba(255,255,255,0.8); }
          .dark { --seasonal-thread: #cbd5e1; }
          @media (prefers-color-scheme: dark) {
            :root:not(.light) { --seasonal-thread: #cbd5e1; }
          }

          /* === Existing 2D Animations === */
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

          /* ============================= */
          /* ===  3D FESTIVAL EFFECTS  === */
          /* ============================= */

          /* --- HOLI 3D: Color powder clouds bursting in 3D space --- */
          @keyframes holi-3d {
            0% {
              transform: translate3d(0, 60vh, var(--dz)) scale(0) rotateX(0deg) rotateY(0deg) rotateZ(0deg);
              opacity: 0; filter: blur(0px);
            }
            15% {
              opacity: 0.85;
              transform: translate3d(var(--drift, 10px), 45vh, calc(var(--dz) + 30px)) scale(0.7) rotateX(45deg) rotateY(30deg) rotateZ(15deg);
              filter: blur(2px);
            }
            40% {
              transform: translate3d(calc(var(--drift, 10px) * 1.5), 25vh, calc(var(--dz) - 20px)) scale(1.3) rotateX(120deg) rotateY(80deg) rotateZ(60deg);
              opacity: 0.6; filter: blur(5px);
            }
            70% {
              transform: translate3d(calc(var(--drift, 10px) * 2), 8vh, calc(var(--dz) + 40px)) scale(1.8) rotateX(220deg) rotateY(150deg) rotateZ(140deg);
              opacity: 0.25; filter: blur(10px);
            }
            100% {
              transform: translate3d(calc(var(--drift, 10px) * 2.5), -10vh, var(--dz)) scale(2.5) rotateX(360deg) rotateY(200deg) rotateZ(200deg);
              opacity: 0; filter: blur(18px);
            }
          }

          /* --- EID 3D: Crescents and stars floating with 3D depth --- */
          @keyframes eid-crescent-3d {
            0% {
              transform: translate3d(0, -10vh, var(--dz)) rotateY(0deg) rotateX(-15deg) scale(var(--ds, 0.7));
              opacity: 0;
            }
            15% { opacity: 0.85; }
            40% {
              transform: translate3d(var(--drift, 8px), 35vh, calc(var(--dz) + 40px)) rotateY(90deg) rotateX(10deg) scale(var(--ds, 1));
              filter: drop-shadow(0 0 10px var(--glow, #FFD700));
            }
            70% {
              transform: translate3d(calc(var(--drift, 8px) * 1.5), 65vh, calc(var(--dz) - 30px)) rotateY(200deg) rotateX(25deg) scale(calc(var(--ds, 0.8)));
              opacity: 0.5;
            }
            100% {
              transform: translate3d(calc(var(--drift, 8px) * 2), 105vh, var(--dz)) rotateY(360deg) rotateX(15deg) scale(calc(var(--ds, 0.6)));
              opacity: 0;
            }
          }
          @keyframes eid-star-3d {
            0% {
              transform: translate3d(0, -5vh, var(--dz)) scale(0) rotateZ(0deg);
              opacity: 0;
            }
            20% {
              transform: translate3d(5px, 18vh, calc(var(--dz) + 20px)) scale(var(--ds, 1.2)) rotateZ(72deg);
              opacity: 1; filter: drop-shadow(0 0 8px var(--glow, #FFD700));
            }
            40% {
              transform: translate3d(-5px, 38vh, calc(var(--dz) - 15px)) scale(calc(var(--ds, 0.7))) rotateZ(144deg);
              opacity: 0.3;
            }
            60% {
              transform: translate3d(8px, 58vh, calc(var(--dz) + 25px)) scale(var(--ds, 1.1)) rotateZ(216deg);
              opacity: 0.9; filter: drop-shadow(0 0 12px var(--glow, #FFD700));
            }
            80% {
              transform: translate3d(-3px, 78vh, calc(var(--dz) - 10px)) scale(calc(var(--ds, 0.6))) rotateZ(288deg);
              opacity: 0.2;
            }
            100% {
              transform: translate3d(0, 105vh, var(--dz)) scale(calc(var(--ds, 0.4))) rotateZ(360deg);
              opacity: 0;
            }
          }

          /* --- UGADI 3D: Leaves/flowers tumbling gently in 3D --- */
          @keyframes ugadi-3d {
            0% {
              transform: translate3d(0, -10vh, var(--dz)) rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(var(--ds, 0.5));
              opacity: 0;
            }
            10% { opacity: 0.9; }
            25% {
              transform: translate3d(var(--sway, 25px), 20vh, calc(var(--dz) + 30px)) rotateX(80deg) rotateY(40deg) rotateZ(45deg) scale(var(--ds, 0.9));
            }
            50% {
              transform: translate3d(calc(var(--sway, 25px) * -0.7), 50vh, calc(var(--dz) - 20px)) rotateX(180deg) rotateY(100deg) rotateZ(130deg) scale(var(--ds, 1));
              opacity: 0.7;
            }
            75% {
              transform: translate3d(var(--sway, 25px), 75vh, calc(var(--dz) + 15px)) rotateX(270deg) rotateY(180deg) rotateZ(250deg) scale(var(--ds, 0.8));
              opacity: 0.4;
            }
            100% {
              transform: translate3d(calc(var(--sway, 25px) * -0.3), 105vh, var(--dz)) rotateX(360deg) rotateY(220deg) rotateZ(360deg) scale(var(--ds, 0.5));
              opacity: 0;
            }
          }

          /* --- RAM NAVAMI 3D: Divine petals tumbling with golden glow --- */
          @keyframes ramnavami-3d {
            0% {
              transform: translate3d(0, -10vh, var(--dz)) rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(var(--ds, 0.4));
              opacity: 0; filter: drop-shadow(0 0 0px transparent);
            }
            12% {
              opacity: 0.9;
              transform: translate3d(12px, 8vh, calc(var(--dz) + 40px)) rotateX(60deg) rotateY(30deg) rotateZ(25deg) scale(var(--ds, 0.9));
              filter: drop-shadow(0 0 6px var(--glow, #FFD700));
            }
            30% {
              transform: translate3d(-18px, 28vh, calc(var(--dz) - 30px)) rotateX(150deg) rotateY(90deg) rotateZ(80deg) scale(var(--ds, 1.1));
              filter: drop-shadow(0 0 12px var(--glow, #FFA500));
              opacity: 0.8;
            }
            50% {
              transform: translate3d(22px, 48vh, calc(var(--dz) + 50px)) rotateX(230deg) rotateY(160deg) rotateZ(160deg) scale(var(--ds, 1));
              filter: drop-shadow(0 0 18px var(--glow, #FFD700));
              opacity: 0.6;
            }
            70% {
              transform: translate3d(-10px, 68vh, calc(var(--dz) - 15px)) rotateX(300deg) rotateY(230deg) rotateZ(250deg) scale(var(--ds, 0.85));
              filter: drop-shadow(0 0 10px var(--glow, #FF8C00));
              opacity: 0.35;
            }
            100% {
              transform: translate3d(5px, 105vh, var(--dz)) rotateX(360deg) rotateY(300deg) rotateZ(360deg) scale(var(--ds, 0.5));
              opacity: 0; filter: drop-shadow(0 0 0px transparent);
            }
          }
          @keyframes divine-pulse {
            0%, 100% { filter: drop-shadow(0 0 4px var(--glow, #FFD700)); }
            50% { filter: drop-shadow(0 0 20px var(--glow, #FFA500)); }
          }

          /* --- SHIVARATRI 3D: Mystical upward float with blue/purple aura --- */
          @keyframes shivaratri-3d {
            0% {
              transform: translate3d(0, 110vh, var(--dz)) rotateX(0deg) rotateY(0deg) scale(var(--ds, 0.3));
              opacity: 0;
            }
            15% {
              opacity: 0.85;
              transform: translate3d(10px, 85vh, calc(var(--dz) + 35px)) rotateX(40deg) rotateY(60deg) scale(var(--ds, 0.7));
              filter: drop-shadow(0 0 8px var(--glow, #6366F1));
            }
            40% {
              transform: translate3d(-15px, 55vh, calc(var(--dz) - 25px)) rotateX(120deg) rotateY(150deg) scale(var(--ds, 1));
              filter: drop-shadow(0 0 16px var(--glow, #7C3AED));
              opacity: 0.7;
            }
            65% {
              transform: translate3d(18px, 28vh, calc(var(--dz) + 45px)) rotateX(220deg) rotateY(250deg) scale(var(--ds, 1.1));
              filter: drop-shadow(0 0 22px var(--glow, #4F46E5));
              opacity: 0.5;
            }
            85% {
              transform: translate3d(-8px, 10vh, calc(var(--dz) - 10px)) rotateX(300deg) rotateY(330deg) scale(var(--ds, 0.85));
              filter: drop-shadow(0 0 12px var(--glow, #6366F1));
              opacity: 0.25;
            }
            100% {
              transform: translate3d(0, -10vh, var(--dz)) rotateX(360deg) rotateY(360deg) scale(var(--ds, 0.4));
              opacity: 0;
            }
          }
          @keyframes shivaratri-orb-3d {
            0% { transform: translate3d(0, 110vh, var(--dz)) scale(0.2); opacity: 0; }
            20% { opacity: 0.7; transform: translate3d(8px, 80vh, calc(var(--dz) + 30px)) scale(0.8); }
            50% { transform: translate3d(-10px, 45vh, calc(var(--dz) - 20px)) scale(1.3); opacity: 0.5; }
            80% { transform: translate3d(5px, 15vh, calc(var(--dz) + 15px)) scale(0.9); opacity: 0.2; }
            100% { transform: translate3d(0, -15vh, var(--dz)) scale(0.4); opacity: 0; }
          }

          /* --- HANUMAN 3D: Saffron flames rising with 3D tumble --- */
          @keyframes hanuman-3d {
            0% {
              transform: translate3d(0, 110vh, var(--dz)) rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(var(--ds, 0.4));
              opacity: 0;
            }
            10% {
              opacity: 0.9;
              transform: translate3d(6px, 90vh, calc(var(--dz) + 25px)) rotateX(30deg) rotateY(20deg) rotateZ(10deg) scale(var(--ds, 0.7));
              filter: drop-shadow(0 0 6px var(--glow, #FF6B00));
            }
            30% {
              transform: translate3d(-12px, 65vh, calc(var(--dz) - 20px)) rotateX(90deg) rotateY(70deg) rotateZ(40deg) scale(var(--ds, 1));
              filter: drop-shadow(0 0 14px var(--glow, #FF8C00));
              opacity: 0.8;
            }
            55% {
              transform: translate3d(15px, 38vh, calc(var(--dz) + 40px)) rotateX(180deg) rotateY(140deg) rotateZ(90deg) scale(var(--ds, 1.15));
              filter: drop-shadow(0 0 20px var(--glow, #FF4500));
              opacity: 0.6;
            }
            75% {
              transform: translate3d(-8px, 18vh, calc(var(--dz) - 10px)) rotateX(270deg) rotateY(210deg) rotateZ(150deg) scale(var(--ds, 0.95));
              filter: drop-shadow(0 0 12px var(--glow, #FFD700));
              opacity: 0.3;
            }
            100% {
              transform: translate3d(0, -10vh, var(--dz)) rotateX(360deg) rotateY(280deg) rotateZ(200deg) scale(var(--ds, 0.5));
              opacity: 0;
            }
          }
          @keyframes hanuman-flame-3d {
            0% { transform: translate3d(0, 105vh, var(--dz)) scale(0.3) rotateZ(0deg); opacity: 0; }
            15% { opacity: 0.85; transform: translate3d(5px, 85vh, calc(var(--dz) + 20px)) scale(0.7) rotateY(30deg) rotateZ(10deg); }
            40% { transform: translate3d(-8px, 55vh, calc(var(--dz) - 15px)) scale(1.15) rotateY(90deg) rotateZ(-8deg); opacity: 0.9; }
            60% { transform: translate3d(10px, 35vh, calc(var(--dz) + 30px)) scale(1.35) rotateY(160deg) rotateZ(12deg); opacity: 0.55; }
            80% { transform: translate3d(-5px, 15vh, calc(var(--dz) - 10px)) scale(1) rotateY(240deg) rotateZ(-5deg); opacity: 0.25; }
            100% { transform: translate3d(0, -10vh, var(--dz)) scale(0.5) rotateY(360deg) rotateZ(0deg); opacity: 0; }
          }
          @keyframes flame-glow-pulse {
            0%, 100% { filter: drop-shadow(0 0 5px var(--glow, #FF6B00)); }
            50% { filter: drop-shadow(0 0 22px var(--glow, #FF4500)); }
          }

          /* --- AMBEDKAR 3D: Blue theme with drifting wisdom items --- */
          @keyframes ambedkar-3d {
            0% {
              transform: translate3d(0, -10vh, var(--dz)) rotateX(0deg) rotateY(0deg) scale(var(--ds, 0.4));
              opacity: 0;
            }
            15% {
              opacity: 0.9;
              transform: translate3d(12px, 15vh, calc(var(--dz) + 30px)) rotateX(45deg) rotateY(30deg) scale(var(--ds, 0.8));
              filter: drop-shadow(0 0 8px var(--glow, #2563EB));
            }
            40% {
              transform: translate3d(-15px, 45vh, calc(var(--dz) - 20px)) rotateX(120deg) rotateY(180deg) scale(var(--ds, 1.1));
              opacity: 0.7;
            }
            70% {
              transform: translate3d(18px, 75vh, calc(var(--dz) + 25px)) rotateX(240deg) rotateY(280deg) scale(var(--ds, 0.9));
              opacity: 0.4;
            }
            100% {
              transform: translate3d(0, 105vh, var(--dz)) rotateX(360deg) rotateY(360deg) scale(var(--ds, 0.5));
              opacity: 0;
            }
          }
          @keyframes ambedkar-sparkle {
            0%, 100% { opacity: 0.2; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1.2); }
          }

          /* --- BAISAKHI 3D: Golden harvest theme with drum tumble --- */
          @keyframes baisakhi-3d {
            0% {
              transform: translate3d(0, -10vh, var(--dz)) rotateX(0deg) rotateY(0deg) scale(var(--ds, 0.4));
              opacity: 0;
            }
            15% {
              opacity: 0.95;
              transform: translate3d(15px, 12vh, calc(var(--dz) + 40px)) rotateX(60deg) rotateY(45deg) scale(var(--ds, 0.9));
              filter: drop-shadow(0 0 10px var(--glow, #F59E0B));
            }
            40% {
              transform: translate3d(-20px, 40vh, calc(var(--dz) - 25px)) rotateX(150deg) rotateY(120deg) scale(var(--ds, 1.2));
              opacity: 0.8;
            }
            70% {
              transform: translate3d(25px, 70vh, calc(var(--dz) + 35px)) rotateX(280deg) rotateY(240deg) scale(var(--ds, 1));
              opacity: 0.5;
            }
            100% {
              transform: translate3d(0, 105vh, var(--dz)) rotateX(360deg) rotateY(360deg) scale(var(--ds, 0.6));
              opacity: 0;
            }
          }
        `}
            </style>

            {particles.map((p) => {
                const css3d = {
                    '--dz': p.depthZ + 'px',
                    '--ds': p.depthScale,
                    transformStyle: 'preserve-3d',
                    willChange: 'transform, opacity',
                };

                // === HOLI 3D ===
                if (theme.effect === 'holi') {
                    const driftX = (Math.random() - 0.5) * 60 + 'px';
                    return (
                        <div key={p.id} className="absolute" style={{
                            ...css3d, left: p.left,
                            width: p.size, height: p.size,
                            opacity: p.opacity,
                            animation: `holi-3d ${p.animationDuration} ease-out ${p.animationDelay} infinite`,
                            '--drift': driftX,
                        }}>
                            <svg width="100%" height="100%" viewBox="0 0 60 60">
                                <defs><radialGradient id={`hg-${p.id}`} cx="50%" cy="50%" r="50%">
                                    <stop offset="0%" stopColor={p.color} stopOpacity="0.9" />
                                    <stop offset="40%" stopColor={p.color2 || p.color} stopOpacity="0.6" />
                                    <stop offset="100%" stopColor={p.color} stopOpacity="0" />
                                </radialGradient></defs>
                                <circle cx="30" cy="30" r="28" fill={`url(#hg-${p.id})`} />
                                <circle cx={18 + Math.random() * 24} cy={14 + Math.random() * 12} r={3 + Math.random() * 5} fill={p.color2 || p.color} opacity="0.7" />
                                <circle cx={10 + Math.random() * 15} cy={28 + Math.random() * 18} r={2 + Math.random() * 4} fill={p.color} opacity="0.5" />
                            </svg>
                        </div>
                    );
                }

                // === EID 3D ===
                if (theme.effect === 'eid') {
                    const driftX = (Math.random() - 0.5) * 40 + 'px';
                    if (p.isCrescent) {
                        return (
                            <div key={p.id} className="absolute" style={{
                                ...css3d, left: p.left, width: p.size, height: p.size, opacity: p.opacity,
                                animation: `eid-crescent-3d ${p.animationDuration} ease-in-out ${p.animationDelay} infinite`,
                                '--drift': driftX, '--glow': p.color,
                            }}>
                                <svg width="100%" height="100%" viewBox="0 0 50 50" style={{ overflow: 'visible', filter: `drop-shadow(0 0 6px ${p.color})` }}>
                                    <path d="M25,5 A20,20 0 1,0 25,45 A14,14 0 1,1 25,5" fill={p.color} opacity="0.9" />
                                    <polygon points="40,12 42,18 48,18 43,22 45,28 40,24 35,28 37,22 32,18 38,18" fill="#FFD700" opacity="0.8" transform="scale(0.5) translate(50, 10)" />
                                </svg>
                            </div>
                        );
                    }
                    return (
                        <div key={p.id} className="absolute" style={{
                            ...css3d, left: p.left, width: p.size, height: p.size, opacity: p.opacity,
                            animation: `eid-star-3d ${p.animationDuration} ease-in-out ${p.animationDelay} infinite`,
                            '--glow': p.color,
                        }}>
                            <svg width="100%" height="100%" viewBox="0 0 30 30" style={{ overflow: 'visible', filter: `drop-shadow(0 0 5px ${p.color})` }}>
                                <polygon points="15,2 18,11 27,11 20,17 22,27 15,21 8,27 10,17 3,11 12,11" fill={p.color} opacity="0.9" />
                            </svg>
                        </div>
                    );
                }

                // === UGADI 3D ===
                if (theme.effect === 'ugadi') {
                    return (
                        <div key={p.id} className="absolute" style={{
                            ...css3d, left: p.left, fontSize: p.size, opacity: p.opacity,
                            animation: `ugadi-3d ${p.animationDuration} ease-in-out ${p.animationDelay} infinite`,
                            '--sway': p.swayAmount + 'px',
                        }}>
                            {p.emoji}
                        </div>
                    );
                }

                // === RAM NAVAMI 3D ===
                if (theme.effect === 'ramnavami') {
                    return (
                        <div key={p.id} className="absolute" style={{
                            ...css3d, left: p.left, fontSize: p.size, opacity: p.opacity,
                            animation: `ramnavami-3d ${p.animationDuration} ease-in-out ${p.animationDelay} infinite, divine-pulse 2s ease-in-out ${p.animationDelay} infinite`,
                            '--glow': p.glowColor,
                        }}>
                            {p.emoji}
                        </div>
                    );
                }

                // === SHIVARATRI 3D ===
                if (theme.effect === 'shivaratri') {
                    if (p.isSvgOrb) {
                        return (
                            <div key={p.id} className="absolute" style={{
                                ...css3d, left: p.left,
                                width: parseInt(p.size) * 1.8 + 'px', height: parseInt(p.size) * 1.8 + 'px',
                                opacity: p.opacity,
                                animation: `shivaratri-orb-3d ${p.animationDuration} ease-in-out ${p.animationDelay} infinite`,
                            }}>
                                <svg width="100%" height="100%" viewBox="0 0 50 50">
                                    <defs><radialGradient id={`so-${p.id}`} cx="50%" cy="50%" r="50%">
                                        <stop offset="0%" stopColor={p.orbColor} stopOpacity="0.9" />
                                        <stop offset="50%" stopColor={p.glowColor} stopOpacity="0.4" />
                                        <stop offset="100%" stopColor={p.orbColor} stopOpacity="0" />
                                    </radialGradient></defs>
                                    <circle cx="25" cy="25" r="24" fill={`url(#so-${p.id})`} />
                                    <circle cx="25" cy="25" r="10" fill={p.glowColor} opacity="0.6" />
                                </svg>
                            </div>
                        );
                    }
                    return (
                        <div key={p.id} className="absolute" style={{
                            ...css3d, left: p.left, fontSize: p.size, opacity: p.opacity,
                            animation: `shivaratri-3d ${p.animationDuration} ease-in-out ${p.animationDelay} infinite`,
                            '--glow': p.glowColor,
                        }}>
                            {p.emoji}
                        </div>
                    );
                }

                // === HANUMAN 3D ===
                if (theme.effect === 'hanuman') {
                    if (p.isFlame) {
                        return (
                            <div key={p.id} className="absolute" style={{
                                ...css3d, left: p.left,
                                width: parseInt(p.size) * 1.5 + 'px', height: parseInt(p.size) * 2 + 'px',
                                opacity: p.opacity,
                                animation: `hanuman-flame-3d ${p.animationDuration} ease-out ${p.animationDelay} infinite`,
                            }}>
                                <svg width="100%" height="100%" viewBox="0 0 40 60" style={{ overflow: 'visible', filter: `drop-shadow(0 0 10px ${p.flameColor})` }}>
                                    <defs><linearGradient id={`fl-${p.id}`} x1="0" y1="1" x2="0" y2="0">
                                        <stop offset="0%" stopColor="#FFD700" />
                                        <stop offset="40%" stopColor={p.flameColor} />
                                        <stop offset="100%" stopColor="#FF4500" stopOpacity="0.3" />
                                    </linearGradient></defs>
                                    <path d="M20,2 C20,2 5,25 8,40 C10,50 15,55 20,58 C25,55 30,50 32,40 C35,25 20,2 20,2 Z" fill={`url(#fl-${p.id})`} opacity="0.9" />
                                    <path d="M20,15 C20,15 12,30 14,42 C16,50 18,53 20,55 C22,53 24,50 26,42 C28,30 20,15 20,15 Z" fill="#FFD700" opacity="0.7" />
                                </svg>
                            </div>
                        );
                    }
                    return (
                        <div key={p.id} className="absolute" style={{
                            ...css3d, left: p.left, fontSize: p.size, opacity: p.opacity,
                            animation: `hanuman-3d ${p.animationDuration} ease-out ${p.animationDelay} infinite, flame-glow-pulse 2.5s ease-in-out ${p.animationDelay} infinite`,
                            '--glow': p.glowColor,
                        }}>
                            {p.emoji}
                        </div>
                    );
                }

                // === AMBEDKAR 3D ===
                if (theme.effect === 'ambedkar') {
                    return (
                        <div key={p.id} className="absolute" style={{
                            ...css3d, left: p.left, fontSize: p.size, opacity: p.opacity,
                            animation: `ambedkar-3d ${p.animationDuration} ease-in-out ${p.animationDelay} infinite`,
                            '--glow': p.glowColor,
                        }}>
                            {p.emoji}
                            {p.isBlueSparkle && (
                                <div className="absolute inset-0 bg-blue-400 rounded-full blur-xl opacity-20 animate-pulse" />
                            )}
                        </div>
                    );
                }

                // === BAISAKHI 3D ===
                if (theme.effect === 'baisakhi') {
                    return (
                        <div key={p.id} className="absolute" style={{
                            ...css3d, left: p.left, fontSize: p.size, opacity: p.opacity,
                            animation: `baisakhi-3d ${p.animationDuration} ease-in-out ${p.animationDelay} infinite`,
                            '--glow': p.glowColor,
                        }}>
                            {p.emoji}
                        </div>
                    );
                }

                // === DEFAULT EXISTING EFFECTS (snow, confetti, tricolor, kite, etc.) ===
                let animationName = 'seasonal-fall';
                if (theme.effect === 'hearts' || theme.effect === 'float-up') animationName = 'seasonal-float-up';
                else if (theme.effect === 'kite') animationName = p.isCut ? 'kite-fall-down' : 'kite-fly-up';

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
                else if (theme.effect === 'sun') content = '☀️';
                else if (theme.effect === 'bonfire') content = '🔥';
                else if (theme.effect === 'candle') content = '🕯️';
                else if (theme.effect === 'rakhi') content = '🧵';
                else if (theme.effect === 'peacock') content = '🦚';
                else if (theme.effect === 'sparkle') content = '✨';

                const isKite = theme.effect === 'kite';

                return (
                    <div key={p.id} className="absolute flex justify-center" style={{
                        left: p.left,
                        width: content ? 'auto' : p.size,
                        height: (content && typeof content === 'string') ? 'auto' : p.size,
                        backgroundColor: (content && typeof content === 'string') ? 'transparent' : (isKite && p.isSolid) ? 'transparent' : p.color,
                        borderRadius: theme.effect === 'snow' ? '50%' : '0%',
                        fontSize: (content && typeof content === 'string') ? p.size : 0,
                        opacity: p.opacity,
                        animation: `${animationName} ${p.animationDuration} ease-in-out ${p.animationDelay} infinite`,
                        filter: (isKite && !p.isSolid) ? `hue-rotate(${p.hue}deg)` : 'none',
                        '--sx': p.startX || p.left,
                    }}>
                        <div style={{ zIndex: 10, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>{content}</div>
                        {isKite && (
                            <svg className="absolute pointer-events-none"
                                width={p.isCut ? "40" : "400"} height={p.isCut ? "150" : "1000"}
                                viewBox={p.isCut ? "0 0 40 150" : "0 0 400 1000"}
                                style={{ top: p.isSolid ? '70%' : '50%', left: '50%', transform: 'translateX(-50%)', marginTop: p.isSolid ? '0px' : '5px', zIndex: 0, overflow: 'visible', opacity: p.isCut ? 0.8 : 0.6 }}>
                                {p.isCut
                                    ? <path d="M20,0 C20,20 40,50 60,100" stroke="var(--seasonal-thread)" strokeWidth="1.5" fill="none" />
                                    : <path d="M200,0 L450,1000" stroke="var(--seasonal-thread)" strokeWidth="1.5" fill="none" />
                                }
                            </svg>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default SeasonalEffects;
