import React, { useState, useEffect, useRef } from 'react';
import { GameEngine, RadarBlip } from './engine';
import { FloatingText, GameState, PlayerStats } from './types';
import { sound } from './audio';
import {
  Volume2,
  VolumeX,
  Music,
  Shield,
  Zap,
  Crosshair,
  Award,
  Flame,
  RefreshCw,
  Play,
  RotateCcw,
  Sliders,
  Target,
  Sparkles,
  Radio,
} from 'lucide-react';

export const GameShell: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [gameState, setGameState] = useState<GameState>('TITLE');
  const [isMuted, setIsMuted] = useState<boolean>(sound.getIsMuted());
  const [isMusicEnabled, setIsMusicEnabled] = useState<boolean>(sound.getIsMusicEnabled());
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const [stats, setStats] = useState<PlayerStats>({
    health: 100,
    maxHealth: 100,
    shield: 100,
    maxShield: 100,
    boost: 100,
    maxBoost: 100,
    shockwaveCooldown: 1,
    currentWeapon: 'RAILGUN',
    weaponLevel: 1,
    score: 0,
    highScore: 0,
    wave: 1,
    kills: 0,
    combo: 0,
    comboTimer: 0,
    totalDamage: 0,
    shotsFired: 0,
    shotsHit: 0,
    bossActive: false,
    bossHealth: 0,
    bossMaxHealth: 1800,
    bossName: 'COLOSSUS PRIME',
  });

  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [radarData, setRadarData] = useState<{ blips: RadarBlip[]; playerHeading: number }>({
    blips: [],
    playerHeading: 0,
  });

  // Touch device support
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const joystickCenterRef = useRef<{ x: number; y: number } | null>(null);
  const [joystickPos, setJoystickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingJoystick, setIsDraggingJoystick] = useState(false);

  // Initialize engine once
  useEffect(() => {
    if (!mountRef.current) return;

    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      setIsTouchDevice(true);
    }

    const engine = new GameEngine(
      mountRef.current,
      (nextState) => setGameState(nextState),
      (nextStats) => setStats(nextStats)
    );
    engineRef.current = engine;

    // Fast UI sync timer for floating text & radar (60 FPS synced)
    let uiRaf = 0;
    const updateUiData = () => {
      if (engineRef.current) {
        setFloatingTexts([...engineRef.current.getFloatingTexts()]);
        setRadarData(engineRef.current.getRadarBlips());
      }
      uiRaf = requestAnimationFrame(updateUiData);
    };
    uiRaf = requestAnimationFrame(updateUiData);

    return () => {
      cancelAnimationFrame(uiRaf);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const handleToggleMute = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  const handleToggleMusic = () => {
    const musicOn = sound.toggleMusic();
    setIsMusicEnabled(musicOn);
  };

  const handleStartGame = () => {
    engineRef.current?.startGame();
  };

  const handleResumeGame = () => {
    engineRef.current?.resumeGame();
  };

  const handleRestartGame = () => {
    engineRef.current?.restartGame();
  };

  const handleTriggerShockwave = () => {
    engineRef.current?.triggerShockwave();
  };

  // Virtual Joystick touch listeners
  const handleJoystickTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    joystickCenterRef.current = { x: centerX, y: centerY };
    setIsDraggingJoystick(true);

    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const maxRadius = 36;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const nx = Math.cos(angle) * (clampedDist / maxRadius);
    const ny = Math.sin(angle) * (clampedDist / maxRadius);

    setJoystickPos({ x: nx * 30, y: ny * 30 });
    engineRef.current?.setVirtualMove(nx, ny, true);
  };

  const handleJoystickTouchMove = (e: React.TouchEvent) => {
    if (!joystickCenterRef.current || !isDraggingJoystick) return;
    const touch = e.touches[0];
    const dx = touch.clientX - joystickCenterRef.current.x;
    const dy = touch.clientY - joystickCenterRef.current.y;
    const maxRadius = 36;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const nx = Math.cos(angle) * (clampedDist / maxRadius);
    const ny = Math.sin(angle) * (clampedDist / maxRadius);

    setJoystickPos({ x: nx * 30, y: ny * 30 });
    engineRef.current?.setVirtualMove(nx, ny, true);
  };

  const handleJoystickTouchEnd = () => {
    setIsDraggingJoystick(false);
    joystickCenterRef.current = null;
    setJoystickPos({ x: 0, y: 0 });
    engineRef.current?.setVirtualMove(0, 0, false);
  };

  const accuracyPct =
    stats.shotsFired > 0 ? Math.round((stats.shotsHit / stats.shotsFired) * 100) : 100;

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none bg-black text-white font-['Chakra_Petch',sans-serif]">
      {/* 3D WebGL Canvas Viewport */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full z-0 cursor-crosshair" />

      {/* Floating Combat Damage Numbers Layer (projected directly from 3D space) */}
      <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
        {floatingTexts.map((ft) => {
          if (ft.screenX === undefined || ft.screenY === undefined || !ft.opacity) return null;
          return (
            <div
              key={ft.id}
              className="absolute font-extrabold tracking-wider font-mono-numbers drop-shadow-[0_0_8px_rgba(0,0,0,0.9)] transform -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${ft.screenX}px`,
                top: `${ft.screenY}px`,
                color: ft.color,
                fontSize: `${ft.size}px`,
                opacity: ft.opacity,
              }}
            >
              {ft.text}
            </div>
          );
        })}
      </div>

      {/* Top Right Quick Controls Bar (Sound & Settings) */}
      <div className="absolute top-4 right-4 z-40 flex items-center gap-2 pointer-events-auto">
        <button
          onClick={handleToggleMusic}
          title={isMusicEnabled ? 'Disable Cyberpunk BGM' : 'Enable Cyberpunk BGM'}
          className={`p-2.5 rounded-lg border transition-all ${
            isMusicEnabled
              ? 'bg-purple-950/80 border-purple-500/50 text-purple-300 hover:bg-purple-900/90'
              : 'bg-gray-950/80 border-gray-800 text-gray-500 hover:text-gray-300'
          }`}
        >
          <Music className="w-4 h-4" />
        </button>

        <button
          onClick={handleToggleMute}
          title={isMuted ? 'Unmute Audio (M)' : 'Mute Audio (M)'}
          className="p-2.5 rounded-lg bg-gray-950/80 border border-cyan-500/40 text-cyan-400 hover:text-cyan-200 hover:border-cyan-400 hover:bg-gray-900 transition-all shadow-[0_0_15px_rgba(0,240,255,0.15)]"
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        <button
          onClick={() => setShowSettings(!showSettings)}
          title="Tactical Settings"
          className="p-2.5 rounded-lg bg-gray-950/80 border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition-all"
        >
          <Sliders className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Settings Panel Drawer */}
      {showSettings && (
        <div className="absolute top-16 right-4 z-40 w-72 p-4 rounded-xl bg-gray-950/95 border border-cyan-500/40 shadow-2xl backdrop-blur-none text-xs">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-800">
            <span className="font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" /> SYSTEM CONFIG
            </span>
            <button
              onClick={() => setShowSettings(false)}
              className="text-gray-400 hover:text-white px-1 font-mono-numbers"
            >
              ✕
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Procedural Synth BGM</span>
              <button
                onClick={handleToggleMusic}
                className={`px-2 py-1 rounded text-[11px] font-bold ${
                  isMusicEnabled ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400'
                }`}
              >
                {isMusicEnabled ? 'ON (124-138 BPM)' : 'MUTED'}
              </button>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Master Sound FX</span>
              <button
                onClick={handleToggleMute}
                className={`px-2 py-1 rounded text-[11px] font-bold ${
                  !isMuted ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-400'
                }`}
              >
                {!isMuted ? 'ENABLED' : 'MUTED'}
              </button>
            </div>
            <div className="pt-2 border-t border-gray-800/80 text-[10px] text-gray-400 leading-relaxed">
              Craft physics runs at unthrottled 60FPS with spring damping & zero memory allocation in the render loop.
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          STATE 1: TITLE SCREEN
          ========================================================================= */}
      {gameState === 'TITLE' && (
        <div className="absolute inset-0 z-30 flex flex-col justify-between items-center p-8 pointer-events-none">
          {/* Top Brand Spec Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-950/50 border border-cyan-500/30 text-cyan-400 text-xs tracking-widest uppercase">
            <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
            Tactical Antigravity Combat Engine v2.5 · AAA Edition
          </div>

          {/* Center Title Lockup */}
          <div className="text-center max-w-2xl px-4 flex flex-col items-center">
            <div className="mb-4">
              <svg viewBox="0 0 760 120" className="w-full max-w-[620px] drop-shadow-[0_0_28px_rgba(0,240,255,0.5)]">
                <defs>
                  <linearGradient id="titleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="50%" stopColor="#00f0ff" />
                    <stop offset="100%" stopColor="#0072ff" />
                  </linearGradient>
                  <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ff007f" />
                    <stop offset="100%" stopColor="#00f0ff" />
                  </linearGradient>
                </defs>
                <path d="M 40,20 L 10,20 L 10,100 L 40,100" fill="none" stroke="#00f0ff" strokeWidth="2.5" opacity="0.6" />
                <path d="M 720,20 L 750,20 L 750,100 L 720,100" fill="none" stroke="#00f0ff" strokeWidth="2.5" opacity="0.6" />
                <text
                  x="380"
                  y="68"
                  textAnchor="middle"
                  fill="url(#titleGrad)"
                  fontFamily="'Chakra Petch', sans-serif"
                  fontWeight="800"
                  fontSize="54"
                  letterSpacing="9"
                >
                  NEO-VALKYRIE
                </text>
                <text
                  x="380"
                  y="100"
                  textAnchor="middle"
                  fill="url(#accentGrad)"
                  fontFamily="'Chakra Petch', sans-serif"
                  fontWeight="600"
                  fontSize="16"
                  letterSpacing="12"
                >
                  KINETIC VECTOR ARENA
                </text>
              </svg>
            </div>

            <p className="text-gray-300 text-sm md:text-base max-w-lg mb-8 leading-relaxed font-normal">
              Pilot an experimental antigravity skimmer. Evade seeker swarms, deflect orbital artillery, level up kinetic weapons, and survive the Colossus Boss Dreadnought.
            </p>

            <button
              onClick={handleStartGame}
              className="pointer-events-auto group relative px-10 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold text-lg uppercase tracking-wider rounded-md shadow-[0_0_35px_rgba(0,240,255,0.5)] transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3 cursor-pointer"
            >
              <Play className="w-6 h-6 fill-black" />
              <span>Initiate Launch</span>
              <span className="text-xs py-0.5 px-2 bg-black/25 text-black font-mono-numbers rounded">
                ENTER / SPACE
              </span>
            </button>
          </div>

          {/* Flat Single Control-Hint Line */}
          <div className="w-full flex flex-col items-center gap-2">
            <div className="text-gray-400 text-xs md:text-sm font-medium tracking-wide bg-gray-950/70 border border-gray-800 px-6 py-2 rounded-full">
              <span className="text-cyan-400 font-bold">WASD</span> Move ·{' '}
              <span className="text-cyan-400 font-bold">Mouse</span> Aim & Fire ·{' '}
              <span className="text-cyan-400 font-bold">Shift</span> Turbo Boost ·{' '}
              <span className="text-cyan-400 font-bold">E / Right-Click</span> EMP Shockwave ·{' '}
              <span className="text-cyan-400 font-bold">Esc</span> Pause
            </div>
            {stats.highScore > 0 && (
              <div className="text-yellow-400 text-xs flex items-center gap-1 font-mono-numbers">
                <Award className="w-3.5 h-3.5" /> High Score: {stats.highScore.toLocaleString()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          STATE 2: PLAYING HUD (World-Matched, Low-Occlusion UI, >85% Playfield Clear)
          ========================================================================= */}
      {gameState === 'PLAYING' && (
        <div className="absolute inset-0 z-20 pointer-events-none p-5 flex flex-col justify-between">
          {/* Top Status Area */}
          <div className="flex justify-between items-start">
            {/* Top-Left: Player Hull, Shield & EMP Meter */}
            <div className="flex flex-col gap-2.5 w-64">
              {/* Shield Bar */}
              <div className="bg-gray-950/80 border border-cyan-500/30 p-2.5 rounded-lg shadow-[0_0_15px_rgba(0,240,255,0.1)]">
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-cyan-400 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" /> SHIELD CAPACITOR
                  </span>
                  <span className="font-mono-numbers text-cyan-300">
                    {stats.shield} / {stats.maxShield}
                  </span>
                </div>
                <div className="h-2 w-full bg-gray-900 rounded-sm overflow-hidden p-0.5 border border-cyan-900/60">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 rounded-sm transition-all duration-150"
                    style={{ width: `${(stats.shield / stats.maxShield) * 100}%` }}
                  />
                </div>
              </div>

              {/* Hull Armor Bar */}
              <div className="bg-gray-950/80 border border-red-500/30 p-2.5 rounded-lg shadow-[0_0_15px_rgba(255,50,50,0.1)]">
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-red-400 flex items-center gap-1">
                    <Crosshair className="w-3.5 h-3.5" /> HULL INTEGRITY
                  </span>
                  <span className="font-mono-numbers text-red-300">
                    {stats.health} / {stats.maxHealth}
                  </span>
                </div>
                <div className="h-2 w-full bg-gray-900 rounded-sm overflow-hidden p-0.5 border border-red-900/60">
                  <div
                    className={`h-full rounded-sm transition-all duration-150 ${
                      stats.health < 30 ? 'bg-red-500' : 'bg-gradient-to-r from-red-500 to-amber-500'
                    }`}
                    style={{ width: `${(stats.health / stats.maxHealth) * 100}%` }}
                  />
                </div>
              </div>

              {/* EMP Overdrive Ready Gauge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-950/80 border border-purple-500/30 text-xs">
                <Zap className="w-4 h-4 text-purple-400" />
                <span className="text-gray-300 font-semibold text-[11px]">EMP OVERDRIVE</span>
                <div className="flex-1 h-1.5 bg-gray-900 rounded overflow-hidden">
                  <div
                    className="h-full bg-purple-500 transition-all duration-100"
                    style={{ width: `${stats.shockwaveCooldown * 100}%` }}
                  />
                </div>
                <span
                  className={`font-mono-numbers text-[10px] ${
                    stats.shockwaveCooldown >= 1 ? 'text-purple-300 font-bold' : 'text-gray-500'
                  }`}
                >
                  {stats.shockwaveCooldown >= 1 ? 'READY [E]' : `${Math.round(stats.shockwaveCooldown * 100)}%`}
                </span>
              </div>
            </div>

            {/* Top-Center: Dynamic Boss Health Bar (Rendered during Boss Encounters) */}
            {stats.bossActive && (
              <div className="flex flex-col items-center w-full max-w-md px-4">
                <div className="w-full bg-gray-950/90 border border-red-500/60 p-3 rounded-xl shadow-[0_0_30px_rgba(255,0,85,0.4)]">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-extrabold text-red-400 tracking-wider uppercase flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-red-500" /> {stats.bossName}
                    </span>
                    <span className="font-mono-numbers text-xs text-red-300">
                      {stats.bossHealth} / {stats.bossMaxHealth}
                    </span>
                  </div>
                  <div className="h-3 w-full bg-gray-900 rounded overflow-hidden p-0.5 border border-red-950">
                    <div
                      className="h-full bg-gradient-to-r from-red-600 via-orange-500 to-red-400 rounded transition-all duration-100"
                      style={{ width: `${(stats.bossHealth / stats.bossMaxHealth) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Top-Right: Score, Wave & Combo Streak */}
            <div className="flex flex-col items-end gap-1.5 text-right">
              <div className="text-2xl md:text-3xl font-extrabold tracking-wider text-cyan-400 font-mono-numbers drop-shadow-[0_0_10px_rgba(0,240,255,0.4)]">
                {stats.score.toLocaleString()}
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-md bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 font-bold text-xs tracking-wider uppercase">
                  WAVE {stats.wave}
                </span>
                <span className="text-xs text-gray-400 font-mono-numbers">
                  KILLS: {stats.kills}
                </span>
              </div>

              {stats.combo > 1 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold font-mono-numbers">
                  <Flame className="w-3.5 h-3.5 text-amber-400" /> {stats.combo}x COMBO
                </div>
              )}
            </div>
          </div>

          {/* Bottom Area: Controls HUD & Tactical Holographic Radar */}
          <div className="flex justify-between items-end">
            {/* Bottom-Left: Combat Telemetry */}
            <div className="hidden md:flex flex-col gap-1 text-[11px] text-gray-400 bg-gray-950/60 p-2.5 rounded-lg border border-gray-800 font-mono-numbers">
              <div>ACCURACY: <span className="text-cyan-400 font-bold">{accuracyPct}%</span></div>
              <div>DAMAGE DEALT: <span className="text-gray-200">{stats.totalDamage.toLocaleString()}</span></div>
            </div>

            {/* Bottom-Center: Sleek Weapon & Throttle Dock */}
            <div className="flex items-center gap-4 px-6 py-2.5 rounded-xl bg-gray-950/85 border border-cyan-500/30 text-xs shadow-[0_0_20px_rgba(0,240,255,0.12)]">
              {/* Active Weapon Indicator + Level Pips */}
              <div className="flex items-center gap-2">
                <span className="text-gray-400 uppercase text-[10px] tracking-wider">Primary:</span>
                <span className="text-cyan-300 font-extrabold tracking-wide font-mono-numbers flex items-center gap-1.5">
                  {stats.currentWeapon === 'RAILGUN'
                    ? '⚡ KINETIC RAILGUN'
                    : stats.currentWeapon === 'TWIN_PLASMA'
                    ? '✨ TWIN PLASMA'
                    : '💥 SCATTER SHOT'}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-cyan-900/60 text-cyan-300 font-bold text-[10px] border border-cyan-500/40 font-mono-numbers">
                  Lv.{stats.weaponLevel}
                </span>
              </div>

              <div className="h-4 w-px bg-gray-700" />

              {/* Boost Throttle */}
              <div className="flex items-center gap-2">
                <span className="text-gray-400 uppercase text-[10px] tracking-wider">Boost:</span>
                <div className="w-24 h-2 bg-gray-900 rounded overflow-hidden p-0.5 border border-gray-700">
                  <div
                    className="h-full bg-cyan-400 rounded transition-all duration-100"
                    style={{ width: `${(stats.boost / stats.maxBoost) * 100}%` }}
                  />
                </div>
                <span className="font-mono-numbers text-[11px] text-cyan-300">
                  {stats.boost}%
                </span>
              </div>
            </div>

            {/* Bottom-Right: Tactical Holographic Radar (Minimap) */}
            <div className="flex flex-col items-center">
              <div className="relative w-28 h-28 rounded-full bg-gray-950/90 border-2 border-cyan-500/40 p-1 shadow-[0_0_20px_rgba(0,240,255,0.15)] flex items-center justify-center">
                {/* Radar Grid Circles & Crosshairs */}
                <div className="absolute inset-2 rounded-full border border-cyan-500/20" />
                <div className="absolute inset-5 rounded-full border border-cyan-500/20" />
                <div className="absolute inset-x-0 top-1/2 h-px bg-cyan-500/20" />
                <div className="absolute inset-y-0 left-1/2 w-px bg-cyan-500/20" />

                {/* Radar Blips */}
                {radarData.blips.map((blip, idx) => {
                  // Map -1..1 to 0..100%
                  const left = 50 + blip.x * 44;
                  const top = 50 + blip.y * 44;

                  if (blip.type === 'player') {
                    return (
                      <div
                        key={idx}
                        className="absolute w-2.5 h-2.5 transform -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${left}%`, top: `${top}%` }}
                      >
                        <div
                          className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[8px] border-b-cyan-300"
                          style={{
                            transform: `rotate(${(-radarData.playerHeading * 180) / Math.PI}deg)`,
                          }}
                        />
                      </div>
                    );
                  } else if (blip.type === 'boss') {
                    return (
                      <div
                        key={idx}
                        className="absolute w-3.5 h-3.5 bg-red-500 rounded-sm transform -translate-x-1/2 -translate-y-1/2 shadow-[0_0_8px_#ff0055]"
                        style={{ left: `${left}%`, top: `${top}%` }}
                      />
                    );
                  } else if (blip.type === 'titan') {
                    return (
                      <div
                        key={idx}
                        className="absolute w-2.5 h-2.5 bg-amber-400 rounded-full transform -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${left}%`, top: `${top}%` }}
                      />
                    );
                  } else if (blip.type === 'pickup') {
                    return (
                      <div
                        key={idx}
                        className="absolute w-2 h-2 bg-yellow-300 rotate-45 transform -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${left}%`, top: `${top}%` }}
                      />
                    );
                  } else {
                    return (
                      <div
                        key={idx}
                        className="absolute w-1.5 h-1.5 bg-red-400 rounded-full transform -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${left}%`, top: `${top}%` }}
                      />
                    );
                  }
                })}

                <div className="absolute bottom-1 text-[8px] text-cyan-400 font-bold uppercase tracking-widest flex items-center gap-0.5">
                  <Radio className="w-2.5 h-2.5" /> RADAR
                </div>
              </div>
            </div>
          </div>

          {/* Virtual Mobile Touch Controls */}
          {isTouchDevice && (
            <div className="absolute inset-x-4 bottom-4 flex justify-between items-end pointer-events-auto">
              <div
                onTouchStart={handleJoystickTouchStart}
                onTouchMove={handleJoystickTouchMove}
                onTouchEnd={handleJoystickTouchEnd}
                className="relative w-28 h-28 rounded-full bg-gray-950/70 border-2 border-cyan-500/40 flex items-center justify-center touch-none shadow-[0_0_20px_rgba(0,240,255,0.2)]"
              >
                <div
                  className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-500 shadow-lg pointer-events-none transition-transform duration-75"
                  style={{
                    transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
                  }}
                />
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onTouchStart={() => engineRef.current?.setVirtualFire(true)}
                  onTouchEnd={() => engineRef.current?.setVirtualFire(false)}
                  className="w-16 h-16 rounded-full bg-cyan-500/90 active:bg-cyan-400 text-black font-extrabold flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.4)] cursor-pointer text-sm"
                >
                  FIRE
                </button>
                <div className="flex gap-2">
                  <button
                    onTouchStart={() => engineRef.current?.setVirtualBoost(true)}
                    onTouchEnd={() => engineRef.current?.setVirtualBoost(false)}
                    className="w-12 h-12 rounded-full bg-blue-600/90 active:bg-blue-500 text-white font-bold flex items-center justify-center text-xs shadow-md"
                  >
                    BOOST
                  </button>
                  <button
                    onClick={handleTriggerShockwave}
                    className="w-12 h-12 rounded-full bg-purple-600/90 active:bg-purple-500 text-white font-bold flex items-center justify-center text-xs shadow-md"
                  >
                    EMP
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          STATE 3: PAUSE MODAL
          ========================================================================= */}
      {gameState === 'PAUSED' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75">
          <div className="w-full max-w-md p-8 rounded-2xl bg-gray-950 border border-cyan-500/40 shadow-[0_0_50px_rgba(0,240,255,0.25)] text-center">
            <h2 className="text-3xl font-extrabold text-cyan-400 tracking-wider mb-2">SIMULATION PAUSED</h2>
            <p className="text-gray-400 text-sm mb-6">Tactical combat calculations suspended</p>

            <div className="bg-gray-900/80 rounded-xl p-4 mb-6 text-left text-xs text-gray-300 space-y-2 border border-gray-800">
              <div className="flex justify-between">
                <span className="text-gray-400">Current Wave:</span>
                <span className="text-cyan-400 font-bold font-mono-numbers">WAVE {stats.wave}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Current Score:</span>
                <span className="text-cyan-400 font-bold font-mono-numbers">{stats.score.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Enemies Destroyed:</span>
                <span className="text-cyan-400 font-bold font-mono-numbers">{stats.kills}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Weapon Upgrade:</span>
                <span className="text-yellow-400 font-bold font-mono-numbers">{stats.currentWeapon} Lv.{stats.weaponLevel}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleResumeGame}
                className="w-full py-3.5 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold uppercase rounded-lg shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5 fill-black" /> Resume Combat
              </button>
              <button
                onClick={handleRestartGame}
                className="w-full py-3 bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-200 font-bold uppercase rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Restart Sector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          STATE 4: GAME OVER MODAL (Comprehensive Mission Debriefing)
          ========================================================================= */}
      {gameState === 'GAMEOVER' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85">
          <div className="w-full max-w-lg p-8 rounded-2xl bg-gray-950 border border-red-500/50 shadow-[0_0_60px_rgba(255,50,50,0.35)] text-center animate-in fade-in zoom-in duration-200">
            <div className="inline-block px-3 py-1 rounded-full bg-red-950/80 border border-red-500/40 text-red-400 text-xs font-bold tracking-widest uppercase mb-3">
              SKIMMER DESTROYED
            </div>
            <h2 className="text-4xl font-extrabold text-white tracking-wider mb-2">MISSION FAILED</h2>
            <p className="text-gray-400 text-sm mb-6">Combat report logged to orbital command</p>

            <div className="bg-gray-900/90 rounded-xl p-5 mb-8 grid grid-cols-2 gap-4 text-left border border-gray-800">
              <div>
                <span className="text-gray-400 text-xs block mb-1">FINAL SCORE</span>
                <span className="text-2xl font-extrabold text-cyan-400 font-mono-numbers">
                  {stats.score.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-gray-400 text-xs block mb-1">HIGH SCORE</span>
                <span className="text-2xl font-extrabold text-yellow-400 font-mono-numbers">
                  {stats.highScore.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-gray-400 text-xs block mb-1">SECTOR REACHED</span>
                <span className="text-xl font-bold text-white font-mono-numbers">
                  WAVE {stats.wave}
                </span>
              </div>
              <div>
                <span className="text-gray-400 text-xs block mb-1">HOSTILES NEUTRALIZED</span>
                <span className="text-xl font-bold text-white font-mono-numbers">
                  {stats.kills}
                </span>
              </div>
              <div>
                <span className="text-gray-400 text-xs block mb-1">COMBAT ACCURACY</span>
                <span className="text-xl font-bold text-cyan-300 font-mono-numbers">
                  {accuracyPct}%
                </span>
              </div>
              <div>
                <span className="text-gray-400 text-xs block mb-1">TOTAL DAMAGE</span>
                <span className="text-xl font-bold text-purple-300 font-mono-numbers">
                  {stats.totalDamage.toLocaleString()}
                </span>
              </div>
            </div>

            <button
              onClick={handleRestartGame}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold uppercase rounded-lg shadow-[0_0_30px_rgba(0,240,255,0.5)] transition-all cursor-pointer flex items-center justify-center gap-2 text-base transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <RefreshCw className="w-5 h-5" /> Redeploy Skimmer (SPACE / ENTER)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
