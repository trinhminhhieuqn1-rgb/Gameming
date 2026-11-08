import * as THREE from 'three';

export type GameState = 'TITLE' | 'PLAYING' | 'PAUSED' | 'GAMEOVER' | 'VICTORY';

export type WeaponType = 'RAILGUN' | 'TWIN_PLASMA' | 'SCATTER_SHOT';

export interface PlayerStats {
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  boost: number;
  maxBoost: number;
  shockwaveCooldown: number; // 0 to 1 ratio (1 = ready)
  currentWeapon: WeaponType;
  weaponLevel: number;
  score: number;
  highScore: number;
  wave: number;
  kills: number;
  combo: number;
  comboTimer: number;
  totalDamage: number;
  shotsFired: number;
  shotsHit: number;
  bossActive: boolean;
  bossHealth: number;
  bossMaxHealth: number;
  bossName: string;
}

export type EnemyType = 'SWARM_DRONE' | 'TITAN_WALKER' | 'BEAM_PYLON' | 'COLOSSUS_BOSS';

export interface EnemyEntity {
  id: number;
  type: EnemyType;
  mesh: THREE.Group;
  health: number;
  maxHealth: number;
  radius: number;
  speed: number;
  stateTimer: number;
  attackTimer: number;
  attackTelegraph: number; // 0 to 1, indicates telegraph windup
  telegraphMesh?: THREE.Mesh | THREE.Line;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  targetPosition: THREE.Vector3;
  bossPhase?: number;
}

export interface Projectile {
  id: number;
  mesh: THREE.Mesh | THREE.Group;
  isPlayer: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  damage: number;
  life: number;
  maxLife: number;
  color: number;
}

export interface PickupItem {
  id: number;
  type: 'SHIELD' | 'WEAPON' | 'ENERGY';
  weaponPayload?: WeaponType;
  mesh: THREE.Group;
  position: THREE.Vector3;
  radius: number;
  life: number;
}

export interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  life: number;
  maxLife: number;
  decay: number;
}

export interface MortarWarning {
  id: number;
  position: THREE.Vector3;
  radius: number;
  currentProgress: number; // 0 to 1
  duration: number;
  mesh: THREE.Mesh;
}

export interface FloatingText {
  id: number;
  text: string;
  position: THREE.Vector3;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  screenX?: number;
  screenY?: number;
  opacity?: number;
}
