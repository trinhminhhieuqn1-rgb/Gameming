import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { sound } from './audio';
import {
  createBeamPylonMesh,
  createBossDreadnoughtMesh,
  createGridFloorTexture,
  createPickupMesh,
  createPlayerMesh,
  createSwarmDroneMesh,
  createTelegraphGroundCircle,
  createTelegraphLine,
  createTitanWalkerMesh,
  Materials,
} from './models';
import {
  EnemyEntity,
  EnemyType,
  FloatingText,
  GameState,
  MortarWarning,
  Particle,
  PickupItem,
  PlayerStats,
  Projectile,
  WeaponType,
} from './types';

// Module-level reusable math helpers to prevent garbage collection in the render loop
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _vec3C = new THREE.Vector3();

export interface RadarBlip {
  x: number; // -1 to 1 normalized radar coords
  y: number; // -1 to 1 normalized radar coords
  type: 'player' | 'drone' | 'titan' | 'pylon' | 'boss' | 'pickup';
}

export class GameEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock: THREE.Clock;
  private isSoftwareGl: boolean = false;
  private frameId: number = 0;
  private isDestroyed: boolean = false;

  // Game State
  private state: GameState = 'TITLE';
  private onStateChange: (state: GameState) => void;
  private onStatsUpdate: (stats: PlayerStats) => void;

  // Player Entity & Kinematics
  private playerMesh: THREE.Group;
  private playerPos = new THREE.Vector3(0, 0.5, 0);
  private playerVel = new THREE.Vector3(0, 0, 0);
  private playerHeading: number = 0; // In radians
  private playerBank: number = 0;
  private playerPitch: number = 0;
  private isBoosting: boolean = false;
  private boostEnergy: number = 100;
  private maxBoost: number = 100;
  private health: number = 100;
  private maxHealth: number = 100;
  private shield: number = 100;
  private maxShield: number = 100;
  private shieldRegenTimer: number = 0;
  private primaryCooldown: number = 0;
  private shockwaveCooldown: number = 1; // 1 = ready
  private currentWeapon: WeaponType = 'RAILGUN';
  private weaponLevels: Record<WeaponType, number> = {
    RAILGUN: 1,
    TWIN_PLASMA: 1,
    SCATTER_SHOT: 1,
  };

  // Score & Combat Telemetry
  private score: number = 0;
  private highScore: number = 0;
  private wave: number = 1;
  private kills: number = 0;
  private combo: number = 0;
  private comboTimer: number = 0;
  private totalDamage: number = 0;
  private shotsFired: number = 0;
  private shotsHit: number = 0;

  // Boss Encounter State
  private bossActive: boolean = false;
  private bossEntity: EnemyEntity | null = null;
  private bossHealth: number = 0;
  private bossMaxHealth: number = 1800;
  private bossName: string = 'COLOSSUS PRIME';

  // Hitstop and Screen Shake
  private hitstopDuration: number = 0;
  private cameraShake: number = 0;

  // Input Handling
  private keysHeld: Record<string, boolean> = {};
  private mouseAimTarget = new THREE.Vector3(0, 0, 10);
  private raycaster = new THREE.Raycaster();
  private mouseCoords = new THREE.Vector2(0, 0);
  private floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private isMouseDown: boolean = false;

  // Touch virtual controls
  private touchMove = { x: 0, y: 0, active: false };

  // Arena & Boundary
  private readonly ARENA_RADIUS = 72;

  // Entities
  private enemies: EnemyEntity[] = [];
  private projectiles: Projectile[] = [];
  private pickups: PickupItem[] = [];
  private particles: Particle[] = [];
  private mortars: MortarWarning[] = [];
  private floatingTexts: FloatingText[] = [];
  private nextEntityId: number = 1;

  // Lighting & Environment
  private playerLight: THREE.PointLight;
  private boundaryPylons: THREE.Group[] = [];

  // Title screen camera orbit
  private titleOrbitAngle: number = 0;

  constructor(
    container: HTMLElement,
    onStateChange: (state: GameState) => void,
    onStatsUpdate: (stats: PlayerStats) => void
  ) {
    this.container = container;
    this.onStateChange = onStateChange;
    this.onStatsUpdate = onStatsUpdate;

    if (typeof window !== 'undefined') {
      this.highScore = parseInt(localStorage.getItem('neo_valkyrie_hi') || '0', 10);
    }

    // 1. Detect software WebGL guard
    this.isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    // 2. Initialize Three.js renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    // 3. Scene and Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030712);
    this.scene.fog = new THREE.FogExp2(0x030712, 0.015);

    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      280
    );
    this.camera.position.set(0, 10, -18);
    this.camera.lookAt(0, 0, 0);

    this.clock = new THREE.Clock();

    // 4. Studio Environment Reflection
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    } catch {
      // Fallback
    }

    // 5. Lighting Setup (Warm Key + Cool Hemisphere + Horizon Fog)
    const hemiLight = new THREE.HemisphereLight(0x4466aa, 0x050c18, 0.95);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffeedd, 1.85);
    keyLight.position.set(25, 45, -25);
    if (!this.isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 2048;
      keyLight.shadow.mapSize.height = 2048;
      keyLight.shadow.camera.near = 10;
      keyLight.shadow.camera.far = 130;
      keyLight.shadow.camera.left = -50;
      keyLight.shadow.camera.right = 50;
      keyLight.shadow.camera.top = 50;
      keyLight.shadow.camera.bottom = -50;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x00d8ff, 1.3);
    rimLight.position.set(-35, 25, 35);
    this.scene.add(rimLight);

    // 6. Build Arena & Scenery
    this.setupArena();

    // 7. Player Mesh
    this.playerMesh = createPlayerMesh();
    this.playerMesh.position.copy(this.playerPos);
    this.scene.add(this.playerMesh);

    // Player underglow light
    this.playerLight = new THREE.PointLight(0x00f0ff, 2.8, 14);
    this.playerLight.position.set(0, 0.4, 0);
    this.playerMesh.add(this.playerLight);

    // 8. Event Listeners
    this.bindEvents();

    // 9. Start Game Loop
    this.tick();
  }

  private setupArena() {
    // Ground Floor
    const floorGeo = new THREE.PlaneGeometry(260, 260);
    floorGeo.rotateX(-Math.PI / 2);
    const floorTexture = createGridFloorTexture();
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.4,
      metalness: 0.6,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = !this.isSoftwareGl;
    this.scene.add(floor);

    // Combat Zone Boundary Ring
    const boundaryRingGeo = new THREE.RingGeometry(this.ARENA_RADIUS - 0.4, this.ARENA_RADIUS + 0.4, 64);
    boundaryRingGeo.rotateX(-Math.PI / 2);
    const boundaryRingMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const boundaryRing = new THREE.Mesh(boundaryRingGeo, boundaryRingMat);
    boundaryRing.position.y = 0.05;
    this.scene.add(boundaryRing);

    // Perimeter Forcefield Pylons
    const numPylons = 16;
    for (let i = 0; i < numPylons; i++) {
      const angle = (i / numPylons) * Math.PI * 2;
      const x = Math.cos(angle) * this.ARENA_RADIUS;
      const z = Math.sin(angle) * this.ARENA_RADIUS;

      const pylon = new THREE.Group();
      const spireGeo = new THREE.CylinderGeometry(0.5, 0.9, 8, 6);
      const spireMesh = new THREE.Mesh(spireGeo, Materials.hullDark);
      spireMesh.position.y = 4;
      spireMesh.castShadow = true;
      pylon.add(spireMesh);

      const beaconGeo = new THREE.OctahedronGeometry(0.7, 0);
      const beaconMesh = new THREE.Mesh(beaconGeo, Materials.cyanGlow);
      beaconMesh.position.y = 8.5;
      pylon.add(beaconMesh);

      pylon.position.set(x, 0, z);
      this.scene.add(pylon);
      this.boundaryPylons.push(pylon);
    }

    // Outer cyber-monolith skyline
    const outerGeo = new THREE.BoxGeometry(4, 30, 4);
    for (let i = 0; i < 32; i++) {
      const angle = (i / 32) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const dist = this.ARENA_RADIUS + 25 + Math.random() * 35;
      const height = 15 + Math.random() * 40;
      const monolith = new THREE.Mesh(
        outerGeo,
        new THREE.MeshStandardMaterial({
          color: 0x08101a,
          metalness: 0.9,
          roughness: 0.3,
        })
      );
      monolith.scale.set(1 + Math.random() * 1.5, height / 30, 1 + Math.random() * 1.5);
      monolith.position.set(Math.cos(angle) * dist, height / 2, Math.sin(angle) * dist);
      this.scene.add(monolith);
    }
  }

  private bindEvents() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);
    window.addEventListener('resize', this.handleResize);

    const dom = this.renderer.domElement;
    dom.addEventListener('pointermove', this.handlePointerMove);
    dom.addEventListener('pointerdown', this.handlePointerDown);
    dom.addEventListener('pointerup', this.handlePointerUp);
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private unbindEvents() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('resize', this.handleResize);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    this.keysHeld[key] = true;

    if (e.code === 'Space') {
      this.keysHeld['space'] = true;
      e.preventDefault();
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      this.keysHeld['shift'] = true;
    }

    if (this.state === 'TITLE') {
      if (e.key === 'Enter' || e.code === 'Space') {
        this.startGame();
      }
    } else if (this.state === 'PLAYING') {
      if (e.key === 'Escape' || e.key === 'p') {
        this.pauseGame();
      } else if (e.key === 'e' || e.key === 'q') {
        this.triggerShockwave();
      }
    } else if (this.state === 'PAUSED') {
      if (e.key === 'Escape' || e.key === 'p') {
        this.resumeGame();
      }
    } else if (this.state === 'GAMEOVER' || this.state === 'VICTORY') {
      if (e.key === 'Enter' || e.code === 'Space') {
        this.restartGame();
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    this.keysHeld[key] = false;
    if (e.code === 'Space') this.keysHeld['space'] = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keysHeld['shift'] = false;
  };

  private handleWindowBlur = () => {
    this.keysHeld = {};
    this.isMouseDown = false;
    this.touchMove.active = false;
    if (this.state === 'PLAYING') {
      this.pauseGame();
    }
  };

  private handleResize = () => {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private handlePointerMove = (e: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouseCoords.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseCoords.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    // Raycast against ground plane for precise mouse cursor aiming
    this.raycaster.setFromCamera(this.mouseCoords, this.camera);
    this.raycaster.ray.intersectPlane(this.floorPlane, this.mouseAimTarget);
  };

  private handlePointerDown = (e: PointerEvent) => {
    sound.ensureRunning();
    if (this.state === 'TITLE') {
      this.startGame();
      return;
    }
    if (e.button === 0) {
      this.isMouseDown = true;
    } else if (e.button === 2) {
      // Right click: Shockwave
      this.triggerShockwave();
    }
  };

  private handlePointerUp = (e: PointerEvent) => {
    if (e.button === 0) {
      this.isMouseDown = false;
    }
  };

  // Virtual Touch Joystick input handlers for mobile support
  public setVirtualMove(x: number, y: number, active: boolean) {
    this.touchMove.x = x;
    this.touchMove.y = y;
    this.touchMove.active = active;
  }

  public setVirtualFire(active: boolean) {
    this.isMouseDown = active;
  }

  public setVirtualBoost(active: boolean) {
    this.keysHeld['shift'] = active;
  }

  // Floating Damage Numbers
  public addFloatingText(text: string, position: THREE.Vector3, color = '#00f0ff', size = 16) {
    this.floatingTexts.push({
      id: this.nextEntityId++,
      text,
      position: position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.2, (Math.random() - 0.5) * 0.8)),
      color,
      size,
      life: 0,
      maxLife: 1.1,
    });
  }

  public getFloatingTexts(): FloatingText[] {
    return this.floatingTexts;
  }

  // Radar Blips for Tactical Minimap
  public getRadarBlips(): { blips: RadarBlip[]; playerHeading: number } {
    const blips: RadarBlip[] = [];
    const maxR = this.ARENA_RADIUS;

    // Player at center
    blips.push({ x: this.playerPos.x / maxR, y: this.playerPos.z / maxR, type: 'player' });

    // Enemies
    this.enemies.forEach((e) => {
      blips.push({
        x: e.position.x / maxR,
        y: e.position.z / maxR,
        type: e.type === 'COLOSSUS_BOSS' ? 'boss' : e.type === 'TITAN_WALKER' ? 'titan' : e.type === 'BEAM_PYLON' ? 'pylon' : 'drone',
      });
    });

    // Pickups
    this.pickups.forEach((p) => {
      blips.push({ x: p.position.x / maxR, y: p.position.z / maxR, type: 'pickup' });
    });

    return { blips, playerHeading: this.playerHeading };
  }

  // State transitions
  public startGame() {
    sound.ensureRunning();
    this.state = 'PLAYING';
    this.onStateChange('PLAYING');
    this.resetGameplayVariables();
    this.spawnWave(1);
  }

  public pauseGame() {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED';
    this.onStateChange('PAUSED');
    sound.stopEngine();
  }

  public resumeGame() {
    if (this.state !== 'PAUSED') return;
    this.state = 'PLAYING';
    this.onStateChange('PLAYING');
  }

  public restartGame() {
    this.startGame();
  }

  public triggerShockwave() {
    if (this.state !== 'PLAYING' || this.shockwaveCooldown < 1) return;

    this.shockwaveCooldown = 0;
    sound.playShockwave();
    this.triggerScreenShake(0.65);
    this.hitstopDuration = 0.06;
    this.addFloatingText('EMP OVERDRIVE!', this.playerPos, '#a855f7', 22);

    // Visual expanding shockwave ring
    const ringGeo = new THREE.RingGeometry(0.5, 1.2, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(this.playerPos);
    ring.position.y = 0.2;
    this.scene.add(ring);

    // Expand shockwave animation
    const startTime = performance.now();
    const radius = 22;
    const animateRing = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      const progress = elapsed / 0.55;
      if (progress < 1) {
        const scale = 1 + progress * radius;
        ring.scale.set(scale, scale, scale);
        ringMat.opacity = 0.95 * (1 - progress);
        requestAnimationFrame(animateRing);
      } else {
        this.scene.remove(ring);
        ringGeo.dispose();
        ringMat.dispose();
      }
    };
    animateRing();

    // Damage & stun all enemies within blast radius
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      const dist = enemy.position.distanceTo(this.playerPos);
      if (dist <= radius) {
        const dmg = enemy.type === 'COLOSSUS_BOSS' ? 180 : 130;
        enemy.health -= dmg;
        this.totalDamage += dmg;
        this.addFloatingText(`-${dmg}`, enemy.position, '#a855f7', 20);

        if (enemy.type !== 'COLOSSUS_BOSS') {
          enemy.velocity.add(
            _vec3A.copy(enemy.position).sub(this.playerPos).normalize().multiplyScalar(16)
          );
        }
        this.spawnParticleBurst(enemy.position, 0x00f0ff, 14);
        if (enemy.health <= 0) {
          this.destroyEnemy(i);
        }
      }
    }

    // Destroy all incoming enemy projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (!this.projectiles[i].isPlayer) {
        const p = this.projectiles[i];
        if (p.position.distanceTo(this.playerPos) <= radius) {
          this.spawnParticleBurst(p.position, 0xff007f, 4);
          this.scene.remove(p.mesh);
          this.projectiles.splice(i, 1);
        }
      }
    }
  }

  private resetGameplayVariables() {
    this.playerPos.set(0, 0.5, 0);
    this.playerVel.set(0, 0, 0);
    this.playerHeading = 0;
    this.playerBank = 0;
    this.health = this.maxHealth;
    this.shield = this.maxShield;
    this.boostEnergy = this.maxBoost;
    this.shockwaveCooldown = 1;
    this.score = 0;
    this.wave = 1;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.totalDamage = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.currentWeapon = 'RAILGUN';
    this.weaponLevels = { RAILGUN: 1, TWIN_PLASMA: 1, SCATTER_SHOT: 1 };
    this.bossActive = false;
    this.bossEntity = null;
    sound.setBossMusic(false);

    // Clear old entities
    this.clearAllEntities();
  }

  private clearAllEntities() {
    this.enemies.forEach((e) => {
      this.scene.remove(e.mesh);
      if (e.telegraphMesh) this.scene.remove(e.telegraphMesh);
    });
    this.enemies = [];

    this.projectiles.forEach((p) => this.scene.remove(p.mesh));
    this.projectiles = [];

    this.pickups.forEach((p) => this.scene.remove(p.mesh));
    this.pickups = [];

    this.mortars.forEach((m) => this.scene.remove(m.mesh));
    this.mortars = [];

    this.floatingTexts = [];
    this.bossActive = false;
    this.bossEntity = null;
  }

  private spawnWave(waveNum: number) {
    this.wave = waveNum;
    this.clearAllEntities();

    // Wave 5, 10, 15... is BOSS WAVE!
    const isBossWave = waveNum % 5 === 0;

    if (isBossWave) {
      this.bossActive = true;
      this.bossMaxHealth = 1400 + waveNum * 250;
      this.bossHealth = this.bossMaxHealth;
      this.bossName = `COLOSSUS PRIME [MK-${Math.floor(waveNum / 5)}]`;
      sound.setBossMusic(true);
      sound.playBossAlarm();
      this.triggerScreenShake(0.8);
      this.addFloatingText('⚠️ WARNING: TITAN CLASS THREAT DETECTED', new THREE.Vector3(0, 5, 0), '#ff0055', 26);

      // Spawn Colossus Boss at perimeter
      const bossPos = new THREE.Vector3(0, 3.5, 36);
      this.spawnBoss(bossPos);

      // Spawn supporting scout escort drones
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const dist = 26;
        const pos = new THREE.Vector3(Math.cos(angle) * dist, 1.4, Math.sin(angle) * dist);
        this.spawnEnemy('SWARM_DRONE', pos);
      }
    } else {
      this.bossActive = false;
      this.bossEntity = null;
      sound.setBossMusic(false);

      // Standard escalating combat waves
      const droneCount = 3 + waveNum * 2;
      const walkerCount = waveNum >= 3 ? Math.floor(waveNum / 2) : 0;
      const pylonCount = waveNum >= 2 ? Math.min(3, Math.floor(waveNum / 2)) : 0;

      for (let i = 0; i < droneCount; i++) {
        const angle = (i / droneCount) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 24 + Math.random() * 22;
        const pos = new THREE.Vector3(Math.cos(angle) * dist, 1.2, Math.sin(angle) * dist);
        this.spawnEnemy('SWARM_DRONE', pos);
      }

      for (let i = 0; i < walkerCount; i++) {
        const angle = ((i + 0.5) / (walkerCount + 1)) * Math.PI * 2;
        const dist = 34 + Math.random() * 10;
        const pos = new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
        this.spawnEnemy('TITAN_WALKER', pos);
      }

      for (let i = 0; i < pylonCount; i++) {
        const angle = (i / pylonCount) * Math.PI * 2 + Math.PI / 4;
        const dist = 24 + Math.random() * 12;
        const pos = new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
        this.spawnEnemy('BEAM_PYLON', pos);
      }
    }

    // Spawn an initial powerup drop
    this.spawnPickup(
      new THREE.Vector3((Math.random() - 0.5) * 22, 0, (Math.random() - 0.5) * 22),
      'WEAPON'
    );
  }

  private spawnBoss(position: THREE.Vector3) {
    const mesh = createBossDreadnoughtMesh();
    mesh.position.copy(position);
    this.scene.add(mesh);

    const telegraphMesh = createTelegraphLine();
    this.scene.add(telegraphMesh);

    const boss: EnemyEntity = {
      id: this.nextEntityId++,
      type: 'COLOSSUS_BOSS',
      mesh,
      health: this.bossMaxHealth,
      maxHealth: this.bossMaxHealth,
      radius: 4.8,
      speed: 4.5,
      stateTimer: 0,
      attackTimer: 0,
      attackTelegraph: 0,
      telegraphMesh,
      position: mesh.position,
      velocity: new THREE.Vector3(0, 0, 0),
      targetPosition: new THREE.Vector3(0, 3.5, 0),
      bossPhase: 1,
    };

    this.enemies.push(boss);
    this.bossEntity = boss;
  }

  private spawnEnemy(type: EnemyType, position: THREE.Vector3) {
    let mesh: THREE.Group;
    let health = 100;
    let radius = 1.2;
    let speed = 9;
    let telegraphMesh: THREE.Line | undefined;

    if (type === 'SWARM_DRONE') {
      mesh = createSwarmDroneMesh();
      health = 45 + this.wave * 12;
      radius = 1.1;
      speed = 10 + Math.min(this.wave, 7);
      telegraphMesh = createTelegraphLine();
      this.scene.add(telegraphMesh);
    } else if (type === 'TITAN_WALKER') {
      mesh = createTitanWalkerMesh();
      health = 290 + this.wave * 50;
      radius = 2.4;
      speed = 3.6;
    } else {
      mesh = createBeamPylonMesh();
      health = 160 + this.wave * 28;
      radius = 1.8;
      speed = 0;
      telegraphMesh = createTelegraphLine();
      this.scene.add(telegraphMesh);
    }

    mesh.position.copy(position);
    this.scene.add(mesh);

    const enemy: EnemyEntity = {
      id: this.nextEntityId++,
      type,
      mesh,
      health,
      maxHealth: health,
      radius,
      speed,
      stateTimer: Math.random() * 2,
      attackTimer: Math.random() * 1.5,
      attackTelegraph: 0,
      telegraphMesh,
      position: mesh.position,
      velocity: new THREE.Vector3(0, 0, 0),
      targetPosition: new THREE.Vector3().copy(position),
    };

    this.enemies.push(enemy);
  }

  private spawnPickup(position: THREE.Vector3, forceType?: 'SHIELD' | 'WEAPON' | 'ENERGY') {
    const types: ('SHIELD' | 'WEAPON' | 'ENERGY')[] = ['SHIELD', 'WEAPON', 'ENERGY'];
    const type = forceType || types[Math.floor(Math.random() * types.length)];
    const mesh = createPickupMesh(type);
    mesh.position.copy(position);
    this.scene.add(mesh);

    const weapons: WeaponType[] = ['TWIN_PLASMA', 'SCATTER_SHOT', 'RAILGUN'];
    const weaponPayload = type === 'WEAPON' ? weapons[Math.floor(Math.random() * weapons.length)] : undefined;

    this.pickups.push({
      id: this.nextEntityId++,
      type,
      weaponPayload,
      mesh,
      position: mesh.position,
      radius: 1.4,
      life: 30,
    });
  }

  private firePlayerWeapon() {
    if (this.primaryCooldown > 0) return;

    const forward = _vec3A.set(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.playerHeading);
    const speed = 72;
    const currentLvl = this.weaponLevels[this.currentWeapon];
    this.shotsFired++;

    if (this.currentWeapon === 'RAILGUN') {
      sound.playRailgun(currentLvl > 1);
      this.primaryCooldown = Math.max(0.1, 0.16 - currentLvl * 0.02);

      // Single or dual piercing kinetic bolt
      const count = currentLvl >= 3 ? 2 : 1;
      const offsets = currentLvl >= 3 ? [-0.4, 0.4] : [0];

      offsets.forEach((sideOffset) => {
        const right = _vec3B.set(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.playerHeading);
        const spawnPos = new THREE.Vector3()
          .copy(this.playerPos)
          .addScaledVector(forward, 1.8)
          .addScaledVector(right, sideOffset);
        spawnPos.y = 0.55;

        const boltGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6);
        boltGeo.rotateX(Math.PI / 2);
        const boltMesh = new THREE.Mesh(boltGeo, Materials.cyanGlow);
        boltMesh.position.copy(spawnPos);
        boltMesh.quaternion.copy(this.playerMesh.quaternion);
        this.scene.add(boltMesh);

        this.projectiles.push({
          id: this.nextEntityId++,
          mesh: boltMesh,
          isPlayer: true,
          position: spawnPos,
          velocity: forward.clone().multiplyScalar(speed),
          radius: 0.55,
          damage: 48 + currentLvl * 12,
          life: 0,
          maxLife: 1.5,
          color: 0x00f0ff,
        });
      });
    } else if (this.currentWeapon === 'TWIN_PLASMA') {
      sound.playPlasma(currentLvl > 1);
      this.primaryCooldown = Math.max(0.07, 0.11 - currentLvl * 0.015);

      const sideOffsets = currentLvl >= 3 ? [-0.8, -0.3, 0.3, 0.8] : [-0.6, 0.6];
      sideOffsets.forEach((sideOffset) => {
        const right = _vec3B.set(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.playerHeading);
        const spawnPos = new THREE.Vector3()
          .copy(this.playerPos)
          .addScaledVector(forward, 1.4)
          .addScaledVector(right, sideOffset);
        spawnPos.y = 0.55;

        const boltGeo = new THREE.SphereGeometry(0.24, 8, 8);
        const boltMesh = new THREE.Mesh(boltGeo, Materials.neonPink);
        boltMesh.position.copy(spawnPos);
        this.scene.add(boltMesh);

        this.projectiles.push({
          id: this.nextEntityId++,
          mesh: boltMesh,
          isPlayer: true,
          position: spawnPos,
          velocity: forward.clone().multiplyScalar(speed * 0.96),
          radius: 0.45,
          damage: 28 + currentLvl * 6,
          life: 0,
          maxLife: 1.4,
          color: 0xff007f,
        });
      });
    } else if (this.currentWeapon === 'SCATTER_SHOT') {
      sound.playRailgun(true);
      this.primaryCooldown = Math.max(0.22, 0.32 - currentLvl * 0.03);
      this.triggerScreenShake(0.18);

      const spreadAngles =
        currentLvl >= 3
          ? [-0.36, -0.24, -0.12, 0, 0.12, 0.24, 0.36]
          : [-0.28, -0.14, 0, 0.14, 0.28];

      spreadAngles.forEach((angleOffset) => {
        const dir = forward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angleOffset);
        const boltGeo = new THREE.ConeGeometry(0.12, 1.0, 6);
        boltGeo.rotateX(Math.PI / 2);
        const boltMesh = new THREE.Mesh(boltGeo, Materials.goldUpgrade);
        const spawnPos = new THREE.Vector3().copy(this.playerPos).addScaledVector(dir, 1.5);
        spawnPos.y = 0.55;
        boltMesh.position.copy(spawnPos);
        boltMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
        this.scene.add(boltMesh);

        this.projectiles.push({
          id: this.nextEntityId++,
          mesh: boltMesh,
          isPlayer: true,
          position: spawnPos,
          velocity: dir.multiplyScalar(speed * 0.9),
          radius: 0.45,
          damage: 26 + currentLvl * 5,
          life: 0,
          maxLife: 0.8,
          color: 0xffd700,
        });
      });
    }
  }

  private fireEnemyProjectile(origin: THREE.Vector3, direction: THREE.Vector3, speed = 28, damage = 16) {
    sound.playEnemyLaser();
    const geo = new THREE.SphereGeometry(0.3, 8, 8);
    const mesh = new THREE.Mesh(geo, Materials.enemyCrimson);
    mesh.position.copy(origin);
    this.scene.add(mesh);

    this.projectiles.push({
      id: this.nextEntityId++,
      mesh,
      isPlayer: false,
      position: mesh.position,
      velocity: direction.clone().normalize().multiplyScalar(speed),
      radius: 0.5,
      damage,
      life: 0,
      maxLife: 4.5,
      color: 0xff1133,
    });
  }

  private spawnMortarTarget(targetPos: THREE.Vector3, radius = 5.5, duration = 2.2) {
    const mesh = createTelegraphGroundCircle(radius);
    mesh.position.set(targetPos.x, 0.04, targetPos.z);
    this.scene.add(mesh);

    this.mortars.push({
      id: this.nextEntityId++,
      position: mesh.position,
      radius,
      currentProgress: 0,
      duration,
      mesh,
    });
  }

  private spawnParticleBurst(position: THREE.Vector3, colorHex: number, count = 16) {
    const color = new THREE.Color(colorHex);
    for (let i = 0; i < count; i++) {
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 14,
        Math.random() * 9 + 1,
        (Math.random() - 0.5) * 14
      );
      this.particles.push({
        position: position.clone(),
        velocity: vel,
        color,
        size: Math.random() * 0.25 + 0.1,
        life: 0,
        maxLife: Math.random() * 0.6 + 0.3,
        decay: Math.random() * 2 + 1.5,
      });
    }
  }

  private triggerScreenShake(intensity: number) {
    this.cameraShake = Math.max(this.cameraShake, intensity);
  }

  private destroyEnemy(index: number) {
    const enemy = this.enemies[index];
    const isBoss = enemy.type === 'COLOSSUS_BOSS';

    sound.playExplosion(isBoss ? 'large' : enemy.type === 'TITAN_WALKER' ? 'large' : 'medium');
    this.spawnParticleBurst(
      enemy.position,
      isBoss ? 0xff0055 : enemy.type === 'TITAN_WALKER' ? 0xffaa00 : 0xff2244,
      isBoss ? 64 : enemy.type === 'TITAN_WALKER' ? 36 : 18
    );
    this.triggerScreenShake(isBoss ? 1.0 : enemy.type === 'TITAN_WALKER' ? 0.7 : 0.35);
    this.hitstopDuration = isBoss ? 0.1 : enemy.type === 'TITAN_WALKER' ? 0.07 : 0.04;

    this.scene.remove(enemy.mesh);
    if (enemy.telegraphMesh) this.scene.remove(enemy.telegraphMesh);

    // Scoring & Combo
    this.kills++;
    this.combo++;
    this.comboTimer = 3.5;
    const basePts = isBoss ? 5000 : enemy.type === 'TITAN_WALKER' ? 650 : enemy.type === 'BEAM_PYLON' ? 350 : 150;
    const earnedPts = basePts * Math.min(this.combo, 10);
    this.score += earnedPts;

    if (isBoss) {
      this.bossActive = false;
      this.bossEntity = null;
      sound.setBossMusic(false);
      this.addFloatingText('🏆 BOSS DESTROYED! +5,000', enemy.position, '#ffd700', 26);
      // Spawn multiple powerup caches
      this.spawnPickup(new THREE.Vector3(enemy.position.x - 3, 0, enemy.position.z), 'SHIELD');
      this.spawnPickup(new THREE.Vector3(enemy.position.x + 3, 0, enemy.position.z), 'WEAPON');
      this.spawnPickup(new THREE.Vector3(enemy.position.x, 0, enemy.position.z + 3), 'ENERGY');
    }

    if (this.score > this.highScore) {
      this.highScore = this.score;
      if (typeof window !== 'undefined') {
        localStorage.setItem('neo_valkyrie_hi', String(this.highScore));
      }
    }

    // Chance to drop powerup
    if (!isBoss && (Math.random() < 0.35 || enemy.type === 'TITAN_WALKER')) {
      this.spawnPickup(enemy.position);
    }

    this.enemies.splice(index, 1);

    // Check wave complete
    if (this.enemies.length === 0) {
      this.score += this.wave * 1000;
      sound.playPickup();
      this.addFloatingText(`WAVE ${this.wave} CLEARED!`, this.playerPos, '#00f0ff', 24);
      setTimeout(() => {
        if (this.state === 'PLAYING') {
          this.spawnWave(this.wave + 1);
        }
      }, 1500);
    }
  }

  private damagePlayer(amount: number) {
    if (this.state !== 'PLAYING') return;

    this.triggerScreenShake(0.5);
    this.hitstopDuration = 0.05;

    // Shield absorbs first
    if (this.shield > 0) {
      sound.playShieldHit();
      const absorbed = Math.min(this.shield, amount);
      this.shield -= absorbed;
      amount -= absorbed;
      this.shieldRegenTimer = 4.0;
    }

    if (amount > 0) {
      sound.playHit();
      this.health -= amount;
      this.spawnParticleBurst(this.playerPos, 0x00f0ff, 10);
      this.addFloatingText(`-${amount}`, this.playerPos, '#ef4444', 20);

      if (this.health <= 25) {
        sound.playWarning();
      }

      if (this.health <= 0) {
        this.health = 0;
        this.gameOver();
      }
    }
  }

  private gameOver() {
    this.state = 'GAMEOVER';
    this.onStateChange('GAMEOVER');
    sound.playExplosion('large');
    sound.stopEngine();
    sound.setBossMusic(false);
    this.triggerScreenShake(1.0);
    this.spawnParticleBurst(this.playerPos, 0x00f0ff, 45);
  }

  // Main simulation tick
  private tick = () => {
    if (this.isDestroyed) return;

    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);

    // Hitstop simulation pause
    if (this.hitstopDuration > 0) {
      this.hitstopDuration -= dt;
      this.renderer.render(this.scene, this.camera);
      this.frameId = requestAnimationFrame(this.tick);
      return;
    }

    if (this.state === 'TITLE') {
      this.updateTitleScreen(dt);
    } else if (this.state === 'PLAYING') {
      this.updatePlayingSimulation(dt);
    }

    // Render Scene
    this.renderer.render(this.scene, this.camera);

    this.frameId = requestAnimationFrame(this.tick);
  };

  private updateTitleScreen(dt: number) {
    this.titleOrbitAngle += dt * 0.35;
    const radius = 9.5;
    this.camera.position.set(
      Math.sin(this.titleOrbitAngle) * radius,
      4.2 + Math.sin(this.titleOrbitAngle * 2) * 0.6,
      Math.cos(this.titleOrbitAngle) * radius
    );
    this.camera.lookAt(0, 0.8, 0);

    const time = this.clock.getElapsedTime();
    this.playerMesh.position.y = 0.55 + Math.sin(time * 3.5) * 0.08;
    this.playerMesh.rotation.y = time * 0.2;

    this.boundaryPylons.forEach((p, idx) => {
      p.rotation.y += dt * (idx % 2 === 0 ? 0.4 : -0.4);
    });
  }

  private updatePlayingSimulation(dt: number) {
    const time = this.clock.getElapsedTime();

    // 1. Process Player Input & Movement
    let inputX = 0;
    let inputZ = 0;

    if (this.keysHeld['w'] || this.keysHeld['arrowup']) inputZ += 1;
    if (this.keysHeld['s'] || this.keysHeld['arrowdown']) inputZ -= 1;
    if (this.keysHeld['a'] || this.keysHeld['arrowleft']) inputX -= 1;
    if (this.keysHeld['d'] || this.keysHeld['arrowright']) inputX += 1;

    if (this.touchMove.active) {
      inputX += this.touchMove.x;
      inputZ += -this.touchMove.y;
    }

    this.isBoosting =
      (this.keysHeld['shift'] || false) &&
      this.boostEnergy > 5 &&
      (Math.abs(inputX) > 0.1 || Math.abs(inputZ) > 0.1);

    if (this.isBoosting) {
      this.boostEnergy = Math.max(0, this.boostEnergy - dt * 38);
      if (Math.random() < 0.4) sound.playBoost();
    } else {
      this.boostEnergy = Math.min(this.maxBoost, this.boostEnergy + dt * 18);
    }

    const accel = this.isBoosting ? 65 : 38;
    const maxSpeed = this.isBoosting ? 26 : 16;
    const drag = 0.88;

    _vec3A.set(inputX, 0, inputZ);
    if (_vec3A.lengthSq() > 1) _vec3A.normalize();

    this.playerVel.x += _vec3A.x * accel * dt;
    this.playerVel.z += _vec3A.z * accel * dt;
    this.playerVel.multiplyScalar(Math.pow(drag, dt * 60));

    const currentSpeed = this.playerVel.length();
    if (currentSpeed > maxSpeed) {
      this.playerVel.multiplyScalar(maxSpeed / currentSpeed);
    }

    this.playerPos.addScaledVector(this.playerVel, dt);

    const distFromCenter = Math.hypot(this.playerPos.x, this.playerPos.z);
    if (distFromCenter > this.ARENA_RADIUS - 2) {
      const angle = Math.atan2(this.playerPos.z, this.playerPos.x);
      this.playerPos.x = Math.cos(angle) * (this.ARENA_RADIUS - 2);
      this.playerPos.z = Math.sin(angle) * (this.ARENA_RADIUS - 2);
      this.playerVel.multiplyScalar(0.4);
      sound.playHit();
    }

    const aimDir = _vec3B.copy(this.mouseAimTarget).sub(this.playerPos);
    aimDir.y = 0;
    if (aimDir.lengthSq() > 0.5) {
      const targetHeading = Math.atan2(aimDir.x, aimDir.z);
      let diff = targetHeading - this.playerHeading;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.playerHeading += diff * Math.min(1, dt * 14);
    }

    const lateralSpeed =
      this.playerVel.x * Math.cos(this.playerHeading) - this.playerVel.z * Math.sin(this.playerHeading);
    const targetBank = -lateralSpeed * 0.045;
    this.playerBank = THREE.MathUtils.damp(this.playerBank, targetBank, 10, dt);

    const forwardSpeed =
      this.playerVel.z * Math.cos(this.playerHeading) + this.playerVel.x * Math.sin(this.playerHeading);
    const targetPitch = forwardSpeed * 0.02;
    this.playerPitch = THREE.MathUtils.damp(this.playerPitch, targetPitch, 8, dt);

    this.playerMesh.position.set(
      this.playerPos.x,
      0.5 + Math.sin(time * 5) * 0.06,
      this.playerPos.z
    );
    this.playerMesh.rotation.set(this.playerPitch, this.playerHeading, this.playerBank);

    sound.updateEngine(currentSpeed / maxSpeed, this.isBoosting);

    if (this.isBoosting || currentSpeed > 10) {
      const rearOffset = _vec3C
        .set(0, 0, -1.8)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), this.playerHeading)
        .add(this.playerPos);
      this.spawnParticleBurst(rearOffset, 0x00f0ff, 2);
    }

    // 2. Firing System
    if (this.primaryCooldown > 0) {
      this.primaryCooldown = Math.max(0, this.primaryCooldown - dt);
    }
    if (this.keysHeld['space'] || this.isMouseDown) {
      this.firePlayerWeapon();
    }

    if (this.shockwaveCooldown < 1) {
      this.shockwaveCooldown = Math.min(1, this.shockwaveCooldown + dt * 0.12);
    }

    if (this.shieldRegenTimer > 0) {
      this.shieldRegenTimer -= dt;
    } else if (this.shield < this.maxShield) {
      this.shield = Math.min(this.maxShield, this.shield + dt * 12);
    }

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
      }
    }

    // 3. Update Enemies & Boss
    this.updateEnemies(dt, time);

    // 4. Update Mortars & Hazards
    this.updateMortars(dt);

    // 5. Update Projectiles & Collisions
    this.updateProjectiles(dt);

    // 6. Update Pickups
    this.updatePickups(dt, time);

    // 7. Update Particles
    this.updateParticles(dt);

    // 8. Update Floating Damage Texts
    this.updateFloatingTexts(dt);

    // 9. Update Camera Follow & Decay Shake
    this.updateCamera(dt, currentSpeed);

    // 10. Sync Stats with React UI
    this.onStatsUpdate({
      health: Math.round(this.health),
      maxHealth: this.maxHealth,
      shield: Math.round(this.shield),
      maxShield: this.maxShield,
      boost: Math.round(this.boostEnergy),
      maxBoost: this.maxBoost,
      shockwaveCooldown: this.shockwaveCooldown,
      currentWeapon: this.currentWeapon,
      weaponLevel: this.weaponLevels[this.currentWeapon],
      score: this.score,
      highScore: this.highScore,
      wave: this.wave,
      kills: this.kills,
      combo: this.combo,
      comboTimer: this.comboTimer,
      totalDamage: this.totalDamage,
      shotsFired: this.shotsFired,
      shotsHit: this.shotsHit,
      bossActive: this.bossActive,
      bossHealth: this.bossEntity ? Math.max(0, Math.round(this.bossEntity.health)) : 0,
      bossMaxHealth: this.bossMaxHealth,
      bossName: this.bossName,
    });
  }

  private updateEnemies(dt: number, time: number) {
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      e.stateTimer += dt;
      e.attackTimer += dt;

      const toPlayer = _vec3A.copy(this.playerPos).sub(e.position);
      const dist = toPlayer.length();

      if (e.type === 'COLOSSUS_BOSS') {
        // Boss AI: Floating colossal dreadnought
        const shieldRing = e.mesh.getObjectByName('boss_shield_ring');
        if (shieldRing) shieldRing.rotation.z += dt * (e.bossPhase === 2 ? 3.5 : 1.8);

        // Core pulse
        const core = e.mesh.getObjectByName('boss_plasma_core') as THREE.Mesh | undefined;
        if (core && core.material) {
          (core.material as THREE.MeshStandardMaterial).emissiveIntensity =
            e.bossPhase === 2 ? 3.5 + Math.sin(time * 10) * 1.5 : 2.0 + Math.sin(time * 4) * 0.8;
        }

        // Check Phase 2 Trigger (below 50% HP)
        if (e.bossPhase === 1 && e.health <= e.maxHealth * 0.5) {
          e.bossPhase = 2;
          sound.playBossAlarm();
          this.triggerScreenShake(0.85);
          this.addFloatingText('⚡ BOSS ENRAGED: PHASE 2', e.position, '#ff0033', 26);
        }

        // Orbit around center arena
        const orbitSpeed = e.bossPhase === 2 ? 0.35 : 0.22;
        const orbitR = 28;
        const targetX = Math.cos(time * orbitSpeed) * orbitR;
        const targetZ = Math.sin(time * orbitSpeed) * orbitR;

        _vec3B.set(targetX, 3.8 + Math.sin(time * 2) * 0.5, targetZ).sub(e.position);
        e.velocity.addScaledVector(_vec3B, dt * 6);
        e.velocity.multiplyScalar(0.94);
        e.position.addScaledVector(e.velocity, dt);

        // Face player
        e.mesh.lookAt(this.playerPos.x, 3.5, this.playerPos.z);

        // Attack Cycle 1: Spinal Twin Hyper-Beams
        if (e.attackTimer > (e.bossPhase === 2 ? 2.2 : 3.4)) {
          e.attackTelegraph = Math.min(1, (e.attackTimer - 2.2) / 0.8);
          if (e.telegraphMesh) {
            e.telegraphMesh.visible = true;
            e.telegraphMesh.position.set(e.position.x, 3.2, e.position.z);
            e.telegraphMesh.lookAt(this.playerPos.x, 0.5, this.playerPos.z);
          }

          if (e.attackTimer > (e.bossPhase === 2 ? 3.0 : 4.2)) {
            e.attackTimer = 0;
            e.attackTelegraph = 0;
            if (e.telegraphMesh) e.telegraphMesh.visible = false;

            const beamDir = _vec3A.copy(this.playerPos).sub(e.position).normalize();
            // Fire twin heavy plasma balls
            [-1.8, 1.8].forEach((offset) => {
              const right = _vec3B.set(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), e.mesh.rotation.y);
              const spawnP = e.position.clone().addScaledVector(right, offset).add(new THREE.Vector3(0, 0, 2));
              this.fireEnemyProjectile(spawnP, beamDir, 36, 26);
            });

            // Mortar barrage in Phase 2
            if (e.bossPhase === 2) {
              this.spawnMortarTarget(this.playerPos, 6.5, 1.8);
            }
          }
        }
      } else if (e.type === 'SWARM_DRONE') {
        const orbitRadius = 14;
        const orbitAngle = time * 0.8 + e.id * 1.5;
        const targetX = this.playerPos.x + Math.cos(orbitAngle) * orbitRadius;
        const targetZ = this.playerPos.z + Math.sin(orbitAngle) * orbitRadius;

        _vec3B.set(targetX, 1.4 + Math.sin(time * 3 + e.id) * 0.4, targetZ).sub(e.position);
        e.velocity.addScaledVector(_vec3B, dt * 14);
        e.velocity.multiplyScalar(0.92);
        e.position.addScaledVector(e.velocity, dt);

        e.mesh.lookAt(this.playerPos.x, e.position.y, this.playerPos.z);

        if (e.attackTimer > 2.8 && dist < 30) {
          e.attackTelegraph = Math.min(1, (e.attackTimer - 2.8) / 0.8);
          if (e.telegraphMesh) {
            e.telegraphMesh.visible = true;
            e.telegraphMesh.position.copy(e.position);
            e.telegraphMesh.lookAt(this.playerPos);
          }

          if (e.attackTimer > 3.6) {
            e.attackTimer = 0;
            e.attackTelegraph = 0;
            if (e.telegraphMesh) e.telegraphMesh.visible = false;
            this.fireEnemyProjectile(e.position, toPlayer.clone().normalize(), 32, 14);
          }
        } else if (e.telegraphMesh) {
          e.telegraphMesh.visible = false;
        }
      } else if (e.type === 'TITAN_WALKER') {
        if (dist > 10) {
          _vec3B.copy(toPlayer).normalize();
          e.velocity.set(_vec3B.x * e.speed, 0, _vec3B.z * e.speed);
          e.position.addScaledVector(e.velocity, dt);
        }

        e.mesh.lookAt(this.playerPos.x, 0, this.playerPos.z);

        const stepCycle = time * 3;
        const leftLeg = e.mesh.children[2];
        const rightLeg = e.mesh.children[3];
        if (leftLeg && rightLeg) {
          leftLeg.rotation.x = Math.sin(stepCycle) * 0.35;
          rightLeg.rotation.x = -Math.sin(stepCycle) * 0.35;
        }

        if (e.attackTimer > 4.2) {
          e.attackTimer = 0;
          sound.playRailgun(true);
          const leadPos = _vec3C
            .copy(this.playerPos)
            .addScaledVector(this.playerVel, 1.2);
          this.spawnMortarTarget(leadPos, 6.0, 2.2);
        }
      } else if (e.type === 'BEAM_PYLON') {
        const ring1 = e.mesh.getObjectByName('pylon_ring1');
        const ring2 = e.mesh.getObjectByName('pylon_ring2');
        if (ring1) ring1.rotation.z += dt * 2.5;
        if (ring2) ring2.rotation.z -= dt * 3.2;

        if (e.attackTimer > 3.2) {
          e.attackTelegraph = Math.min(1, (e.attackTimer - 3.2) / 1.0);
          if (e.telegraphMesh) {
            e.telegraphMesh.visible = true;
            e.telegraphMesh.position.set(e.position.x, 3.6, e.position.z);
            e.telegraphMesh.lookAt(this.playerPos.x, 0.5, this.playerPos.z);
          }

          if (e.attackTimer > 4.2) {
            e.attackTimer = 0;
            e.attackTelegraph = 0;
            if (e.telegraphMesh) e.telegraphMesh.visible = false;
            const beamDir = _vec3A.copy(this.playerPos).sub(e.position).normalize();
            this.fireEnemyProjectile(
              new THREE.Vector3(e.position.x, 3.6, e.position.z),
              beamDir,
              45,
              28
            );
          }
        } else if (e.telegraphMesh) {
          e.telegraphMesh.visible = false;
        }
      }

      // Check collision with player
      if (dist < e.radius + 1.2) {
        this.damagePlayer(18);
        this.playerVel.add(_vec3B.copy(this.playerPos).sub(e.position).normalize().multiplyScalar(14));
      }
    }
  }

  private updateMortars(dt: number) {
    for (let i = this.mortars.length - 1; i >= 0; i--) {
      const m = this.mortars[i];
      m.currentProgress += dt / m.duration;

      const scale = 0.2 + m.currentProgress * 0.8;
      m.mesh.scale.set(scale, scale, scale);

      if (m.currentProgress >= 1) {
        sound.playExplosion('large');
        this.spawnParticleBurst(m.position, 0xff3300, 30);
        this.triggerScreenShake(0.6);

        const dist = Math.hypot(this.playerPos.x - m.position.x, this.playerPos.z - m.position.z);
        if (dist <= m.radius) {
          this.damagePlayer(35);
        }

        this.scene.remove(m.mesh);
        this.mortars.splice(i, 1);
      }
    }
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life += dt;
      p.position.addScaledVector(p.velocity, dt);

      if (p.life > p.maxLife || p.position.length() > this.ARENA_RADIUS + 5) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.isPlayer) {
        let hit = false;
        for (let eIdx = this.enemies.length - 1; eIdx >= 0; eIdx--) {
          const enemy = this.enemies[eIdx];
          if (p.position.distanceTo(enemy.position) < p.radius + enemy.radius) {
            enemy.health -= p.damage;
            this.totalDamage += p.damage;
            this.shotsHit++;
            sound.playHit();
            this.spawnParticleBurst(p.position, p.color, 6);

            // Floating damage numbers
            this.addFloatingText(`-${p.damage}`, enemy.position, '#00f0ff', 16);

            if (enemy.health <= 0) {
              this.destroyEnemy(eIdx);
            }
            hit = true;
            break;
          }
        }

        if (hit) {
          this.scene.remove(p.mesh);
          this.projectiles.splice(i, 1);
        }
      } else {
        if (p.position.distanceTo(this.playerPos) < p.radius + 1.2) {
          this.damagePlayer(p.damage);
          this.scene.remove(p.mesh);
          this.projectiles.splice(i, 1);
        }
      }
    }
  }

  private updatePickups(dt: number, time: number) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.life -= dt;

      p.mesh.rotation.y = time * 2.2;
      const core = p.mesh.getObjectByName('pickup_core');
      const ring = p.mesh.getObjectByName('pickup_ring');
      if (core) core.rotation.x = time * 1.8;
      if (ring) ring.rotation.z = -time * 2.5;

      p.mesh.position.y = 0.5 + Math.sin(time * 3 + p.id) * 0.15;

      if (p.position.distanceTo(this.playerPos) < p.radius + 1.2) {
        sound.playPickup();
        this.spawnParticleBurst(p.position, 0xffd700, 20);

        if (p.type === 'SHIELD') {
          this.shield = this.maxShield;
          this.health = Math.min(this.maxHealth, this.health + 30);
          this.addFloatingText('+SHIELD RESTORED', this.playerPos, '#00f0ff', 18);
        } else if (p.type === 'WEAPON' && p.weaponPayload) {
          if (this.currentWeapon === p.weaponPayload) {
            this.weaponLevels[p.weaponPayload] = Math.min(3, this.weaponLevels[p.weaponPayload] + 1);
            this.addFloatingText(`⚡ ${p.weaponPayload} LV.${this.weaponLevels[p.weaponPayload]}!`, this.playerPos, '#ffd700', 20);
          } else {
            this.currentWeapon = p.weaponPayload;
            this.addFloatingText(`EQUIPPED: ${p.weaponPayload}`, this.playerPos, '#ffd700', 18);
          }
        } else if (p.type === 'ENERGY') {
          this.shockwaveCooldown = 1;
          this.boostEnergy = this.maxBoost;
          this.addFloatingText('+OVERDRIVE CHARGED', this.playerPos, '#a855f7', 18);
        }

        this.score += 250;
        this.scene.remove(p.mesh);
        this.pickups.splice(i, 1);
      } else if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.pickups.splice(i, 1);
      }
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.position.addScaledVector(p.velocity, dt);
      p.velocity.y -= 9.8 * dt;

      if (p.life >= p.maxLife || p.position.y <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private updateFloatingTexts(dt: number) {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life += dt;
      ft.position.y += dt * 1.8; // Float upwards

      // Project 3D position to 2D screen coordinates
      _vec3A.copy(ft.position).project(this.camera);

      // Check if in front of camera
      if (_vec3A.z < 1) {
        ft.screenX = ((_vec3A.x + 1) * width) / 2;
        ft.screenY = ((-_vec3A.y + 1) * height) / 2;
        ft.opacity = Math.max(0, 1 - ft.life / ft.maxLife);
      } else {
        ft.opacity = 0;
      }

      if (ft.life >= ft.maxLife) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  private updateCamera(dt: number, currentSpeed: number) {
    const followOffset = _vec3A
      .set(0, 5.2, -8.5)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), this.playerHeading);

    const targetCamPos = _vec3B.copy(this.playerPos).add(followOffset);

    if (this.cameraShake > 0) {
      targetCamPos.x += (Math.random() - 0.5) * this.cameraShake * 1.2;
      targetCamPos.y += (Math.random() - 0.5) * this.cameraShake * 1.2;
      targetCamPos.z += (Math.random() - 0.5) * this.cameraShake * 1.2;
      this.cameraShake = Math.max(0, this.cameraShake - dt * 2.2);
    }

    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetCamPos.x, 8, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetCamPos.y, 8, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetCamPos.z, 8, dt);

    const targetFOV = 60 + (currentSpeed / 25) * 12;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFOV, 6, dt);
    this.camera.updateProjectionMatrix();

    const lookTarget = _vec3C
      .copy(this.playerPos)
      .addScaledVector(this.playerVel, 0.25);
    lookTarget.y = 1.0;
    this.camera.lookAt(lookTarget);
  }

  public destroy() {
    this.isDestroyed = true;
    cancelAnimationFrame(this.frameId);
    this.unbindEvents();
    sound.stopEngine();
    sound.setBossMusic(false);
    this.clearAllEntities();
    this.renderer.dispose();
  }
}
