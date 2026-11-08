import * as THREE from 'three';

/**
 * Procedural Canvas Texture Generators (100% code-driven, zero external assets).
 */
export function createGridFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Deep obsidian sci-fi arena base
  ctx.fillStyle = '#060a14';
  ctx.fillRect(0, 0, 1024, 1024);

  // Hexagonal and grid vector circuit lines
  ctx.strokeStyle = 'rgba(0, 220, 255, 0.12)';
  ctx.lineWidth = 2;
  const step = 64;

  for (let x = 0; x <= 1024; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1024);
    ctx.stroke();
  }
  for (let y = 0; y <= 1024; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  // Major glowing runway lines and cyber accents
  ctx.strokeStyle = 'rgba(0, 255, 200, 0.35)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, 512);
  ctx.lineTo(1024, 512);
  ctx.moveTo(512, 0);
  ctx.lineTo(512, 1024);
  ctx.stroke();

  // Concentric target/arena combat rings in center
  ctx.strokeStyle = 'rgba(255, 0, 128, 0.25)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(512, 512, 180, 0, Math.PI * 2);
  ctx.arc(512, 512, 360, 0, Math.PI * 2);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
  gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Shared reusable materials
 */
export const Materials = {
  hullWhite: new THREE.MeshStandardMaterial({
    color: 0xecf0f1,
    metalness: 0.85,
    roughness: 0.2,
  }),
  hullDark: new THREE.MeshStandardMaterial({
    color: 0x1a252f,
    metalness: 0.9,
    roughness: 0.3,
  }),
  cyanGlow: new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00f0ff,
    emissiveIntensity: 2.2,
    metalness: 0.2,
    roughness: 0.1,
  }),
  neonPink: new THREE.MeshStandardMaterial({
    color: 0xff007f,
    emissive: 0xff007f,
    emissiveIntensity: 2.5,
    metalness: 0.1,
    roughness: 0.2,
  }),
  amberWarning: new THREE.MeshStandardMaterial({
    color: 0xffaa00,
    emissive: 0xffaa00,
    emissiveIntensity: 2.0,
    metalness: 0.2,
    roughness: 0.3,
  }),
  canopyGlass: new THREE.MeshStandardMaterial({
    color: 0x0b253a,
    metalness: 0.95,
    roughness: 0.05,
    transparent: true,
    opacity: 0.8,
  }),
  gunMetal: new THREE.MeshStandardMaterial({
    color: 0x2c3e50,
    metalness: 0.92,
    roughness: 0.25,
  }),
  enemyArmor: new THREE.MeshStandardMaterial({
    color: 0x221316,
    metalness: 0.88,
    roughness: 0.35,
  }),
  enemyCrimson: new THREE.MeshStandardMaterial({
    color: 0xff2244,
    emissive: 0xff1133,
    emissiveIntensity: 2.4,
    metalness: 0.3,
    roughness: 0.2,
  }),
  goldUpgrade: new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xff9900,
    emissiveIntensity: 1.8,
    metalness: 0.9,
    roughness: 0.15,
  }),
};

/**
 * 9-part Composite Player Hover-Skimmer (Group)
 */
export function createPlayerMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'player_hovercraft';

  // Part 1: Main aerodynamic faceted chassis/hull
  const hullShape = new THREE.Shape();
  hullShape.moveTo(0, 2.2);
  hullShape.lineTo(0.9, 0.8);
  hullShape.lineTo(1.1, -1.2);
  hullShape.lineTo(0.6, -1.8);
  hullShape.lineTo(-0.6, -1.8);
  hullShape.lineTo(-1.1, -1.2);
  hullShape.lineTo(-0.9, 0.8);
  hullShape.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 0.45,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.08,
    bevelThickness: 0.08,
  });
  hullGeo.rotateX(Math.PI / 2);
  hullGeo.translate(0, 0.4, 0);
  const hullMesh = new THREE.Mesh(hullGeo, Materials.hullWhite);
  hullMesh.castShadow = true;
  group.add(hullMesh);

  // Part 2: Cockpit glass canopy
  const canopyGeo = new THREE.SphereGeometry(0.55, 16, 12);
  canopyGeo.scale(0.7, 0.45, 1.4);
  const canopyMesh = new THREE.Mesh(canopyGeo, Materials.canopyGlass);
  canopyMesh.position.set(0, 0.68, 0.1);
  canopyMesh.castShadow = true;
  group.add(canopyMesh);

  // Part 3 & 4: Dual Anti-Gravity Nacelles with glowing plasma rings
  const nacelleGeo = new THREE.CylinderGeometry(0.28, 0.28, 1.8, 12);
  nacelleGeo.rotateX(Math.PI / 2);
  const ringGeo = new THREE.TorusGeometry(0.3, 0.04, 8, 16);

  const leftNacelle = new THREE.Mesh(nacelleGeo, Materials.hullDark);
  leftNacelle.position.set(-1.15, 0.4, -0.1);
  leftNacelle.castShadow = true;

  const leftRing = new THREE.Mesh(ringGeo, Materials.cyanGlow);
  leftRing.position.set(0, 0, 0);
  leftNacelle.add(leftRing);
  group.add(leftNacelle);

  const rightNacelle = new THREE.Mesh(nacelleGeo, Materials.hullDark);
  rightNacelle.position.set(1.15, 0.4, -0.1);
  rightNacelle.castShadow = true;

  const rightRing = new THREE.Mesh(ringGeo, Materials.cyanGlow);
  rightRing.position.set(0, 0, 0);
  rightNacelle.add(rightRing);
  group.add(rightNacelle);

  // Part 5 & 6: Twin Kinetic Rail-Cannons
  const gunGeo = new THREE.BoxGeometry(0.12, 0.12, 1.6);
  gunGeo.translate(0, 0, 0.7);
  const leftGun = new THREE.Mesh(gunGeo, Materials.gunMetal);
  leftGun.position.set(-0.55, 0.42, 0.6);
  leftGun.castShadow = true;
  group.add(leftGun);

  const rightGun = new THREE.Mesh(gunGeo, Materials.gunMetal);
  rightGun.position.set(0.55, 0.42, 0.6);
  rightGun.castShadow = true;
  group.add(rightGun);

  // Part 7: Aerodynamic stabilization rear fins
  const finGeo = new THREE.BoxGeometry(0.06, 0.6, 0.7);
  finGeo.rotateX(0.25);
  const leftFin = new THREE.Mesh(finGeo, Materials.cyanGlow);
  leftFin.position.set(-0.85, 0.7, -1.3);
  group.add(leftFin);

  const rightFin = new THREE.Mesh(finGeo, Materials.cyanGlow);
  rightFin.position.set(0.85, 0.7, -1.3);
  group.add(rightFin);

  // Part 8: Rear dual thruster nozzles with glowing plasma emitters
  const nozzleGeo = new THREE.ConeGeometry(0.2, 0.4, 12);
  nozzleGeo.rotateX(-Math.PI / 2);
  const leftNozzle = new THREE.Mesh(nozzleGeo, Materials.cyanGlow);
  leftNozzle.position.set(-0.4, 0.4, -1.9);
  group.add(leftNozzle);

  const rightNozzle = new THREE.Mesh(nozzleGeo, Materials.cyanGlow);
  rightNozzle.position.set(0.4, 0.4, -1.9);
  group.add(rightNozzle);

  // Part 9: Shield Holo-Ring (visible when shield is active or damaged)
  const shieldGeo = new THREE.TorusGeometry(1.9, 0.03, 8, 32);
  shieldGeo.rotateX(Math.PI / 2);
  const shieldMesh = new THREE.Mesh(shieldGeo, Materials.cyanGlow);
  shieldMesh.name = 'shield_ring';
  shieldMesh.position.set(0, 0.45, 0);
  group.add(shieldMesh);

  // Contact shadow directly beneath craft
  const shadowGeo = new THREE.PlaneGeometry(3.6, 4.4);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: createContactShadowTexture(),
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.set(0, 0.02, 0);
  group.add(shadowMesh);

  return group;
}

/**
 * 5-part Composite Swarm Drone (Group)
 */
export function createSwarmDroneMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'enemy_drone';

  // Part 1: Central diamond core
  const coreGeo = new THREE.OctahedronGeometry(0.55, 0);
  const coreMesh = new THREE.Mesh(coreGeo, Materials.enemyArmor);
  coreMesh.position.y = 0.55;
  coreMesh.castShadow = true;
  group.add(coreMesh);

  // Part 2: Glowing menacing optic eye
  const eyeGeo = new THREE.SphereGeometry(0.18, 12, 12);
  const eyeMesh = new THREE.Mesh(eyeGeo, Materials.enemyCrimson);
  eyeMesh.position.set(0, 0.55, 0.45);
  group.add(eyeMesh);

  // Part 3 & 4: Angled swept rotor wings
  const wingGeo = new THREE.BoxGeometry(1.2, 0.05, 0.35);
  wingGeo.rotateZ(0.2);
  const leftWing = new THREE.Mesh(wingGeo, Materials.gunMetal);
  leftWing.position.set(-0.7, 0.65, 0);
  group.add(leftWing);

  const rightWing = new THREE.Mesh(wingGeo.clone().rotateZ(-0.4), Materials.gunMetal);
  rightWing.position.set(0.7, 0.65, 0);
  group.add(rightWing);

  // Part 5: Twin exhaust stinger
  const stingerGeo = new THREE.ConeGeometry(0.12, 0.4, 8);
  stingerGeo.rotateX(Math.PI / 2);
  const stingerMesh = new THREE.Mesh(stingerGeo, Materials.enemyCrimson);
  stingerMesh.position.set(0, 0.55, -0.6);
  group.add(stingerMesh);

  // Contact shadow
  const shadowGeo = new THREE.PlaneGeometry(1.6, 1.6);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: createContactShadowTexture(),
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.set(0, 0.02, 0);
  group.add(shadowMesh);

  return group;
}

/**
 * 8-part Composite Titan Walker (Group)
 */
export function createTitanWalkerMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'enemy_titan';

  // Part 1: Heavy hexagonal torso
  const torsoGeo = new THREE.CylinderGeometry(1.1, 1.3, 1.4, 6);
  const torsoMesh = new THREE.Mesh(torsoGeo, Materials.enemyArmor);
  torsoMesh.position.y = 2.1;
  torsoMesh.castShadow = true;
  group.add(torsoMesh);

  // Part 2: Glowing plasma reactor core
  const reactorGeo = new THREE.SphereGeometry(0.48, 16, 16);
  const reactorMesh = new THREE.Mesh(reactorGeo, Materials.amberWarning);
  reactorMesh.position.set(0, 2.1, 0.7);
  group.add(reactorMesh);

  // Part 3 & 4: Left & Right hydraulic leg struts and armored foot pads
  const legGeo = new THREE.BoxGeometry(0.35, 1.6, 0.45);
  const footGeo = new THREE.BoxGeometry(0.7, 0.3, 1.0);

  const leftLeg = new THREE.Group();
  const leftStrut = new THREE.Mesh(legGeo, Materials.gunMetal);
  leftStrut.position.y = 0.9;
  const leftFoot = new THREE.Mesh(footGeo, Materials.enemyArmor);
  leftFoot.position.set(0, 0.15, 0.1);
  leftLeg.add(leftStrut);
  leftLeg.add(leftFoot);
  leftLeg.position.set(-1.1, 0, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Group();
  const rightStrut = new THREE.Mesh(legGeo, Materials.gunMetal);
  rightStrut.position.y = 0.9;
  const rightFoot = new THREE.Mesh(footGeo, Materials.enemyArmor);
  rightFoot.position.set(0, 0.15, 0.1);
  rightLeg.add(rightStrut);
  rightLeg.add(rightFoot);
  rightLeg.position.set(1.1, 0, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);

  // Part 5: Left shoulder kinetic flak cannon
  const cannonGeo = new THREE.CylinderGeometry(0.18, 0.22, 1.6, 8);
  cannonGeo.rotateX(Math.PI / 2);
  const leftCannon = new THREE.Mesh(cannonGeo, Materials.gunMetal);
  leftCannon.position.set(-1.3, 2.7, 0.4);
  leftCannon.castShadow = true;
  group.add(leftCannon);

  // Part 6: Right shoulder mortar launcher barrel
  const mortarGeo = new THREE.CylinderGeometry(0.28, 0.32, 1.4, 8);
  mortarGeo.rotateX(Math.PI / 3);
  const rightMortar = new THREE.Mesh(mortarGeo, Materials.gunMetal);
  rightMortar.position.set(1.3, 2.7, -0.1);
  rightMortar.castShadow = true;
  group.add(rightMortar);

  // Part 7: Armored Command Visor
  const visorGeo = new THREE.BoxGeometry(1.2, 0.25, 0.5);
  const visorMesh = new THREE.Mesh(visorGeo, Materials.enemyCrimson);
  visorMesh.position.set(0, 2.7, 0.7);
  group.add(visorMesh);

  // Part 8: Exhaust cooling stacks
  const stackGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.8, 6);
  const stack1 = new THREE.Mesh(stackGeo, Materials.gunMetal);
  stack1.position.set(-0.4, 2.9, -0.6);
  const stack2 = new THREE.Mesh(stackGeo, Materials.gunMetal);
  stack2.position.set(0.4, 2.9, -0.6);
  group.add(stack1);
  group.add(stack2);

  // Contact shadow
  const shadowGeo = new THREE.PlaneGeometry(3.6, 3.6);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: createContactShadowTexture(),
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.set(0, 0.02, 0);
  group.add(shadowMesh);

  return group;
}

/**
 * 6-part Composite Beam Pylon (Group)
 */
export function createBeamPylonMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'enemy_pylon';

  // Part 1: Tiered crystalline foundation
  const baseGeo = new THREE.CylinderGeometry(1.2, 1.8, 0.7, 6);
  const baseMesh = new THREE.Mesh(baseGeo, Materials.enemyArmor);
  baseMesh.position.y = 0.35;
  baseMesh.castShadow = true;
  group.add(baseMesh);

  // Part 2: Middle floating energy torus ring (will rotate)
  const ringGeo1 = new THREE.TorusGeometry(1.4, 0.08, 8, 24);
  ringGeo1.rotateX(Math.PI / 2);
  const ring1 = new THREE.Mesh(ringGeo1, Materials.neonPink);
  ring1.name = 'pylon_ring1';
  ring1.position.y = 1.6;
  group.add(ring1);

  // Part 3: Upper counter-rotating energy ring
  const ringGeo2 = new THREE.TorusGeometry(0.9, 0.07, 8, 24);
  ringGeo2.rotateX(Math.PI / 2);
  const ring2 = new THREE.Mesh(ringGeo2, Materials.neonPink);
  ring2.name = 'pylon_ring2';
  ring2.position.y = 2.6;
  group.add(ring2);

  // Part 4: Central crystalline focus spire
  const spireGeo = new THREE.ConeGeometry(0.6, 3.2, 5);
  const spireMesh = new THREE.Mesh(spireGeo, Materials.hullDark);
  spireMesh.position.y = 1.9;
  spireMesh.castShadow = true;
  group.add(spireMesh);

  // Part 5: Top emitter crystal
  const topGeo = new THREE.OctahedronGeometry(0.45, 0);
  const topMesh = new THREE.Mesh(topGeo, Materials.enemyCrimson);
  topMesh.position.y = 3.6;
  topMesh.name = 'pylon_emitter';
  group.add(topMesh);

  // Part 6: Glowing ground runes / circuit lines
  const runeGeo = new THREE.RingGeometry(1.8, 2.2, 16);
  runeGeo.rotateX(-Math.PI / 2);
  const runeMesh = new THREE.Mesh(runeGeo, Materials.neonPink);
  runeMesh.position.y = 0.03;
  group.add(runeMesh);

  return group;
}

/**
 * Powerup Pickup Mesh
 */
export function createPickupMesh(type: 'SHIELD' | 'WEAPON' | 'ENERGY'): THREE.Group {
  const group = new THREE.Group();
  group.name = `pickup_${type}`;

  const mat =
    type === 'SHIELD'
      ? Materials.cyanGlow
      : type === 'WEAPON'
      ? Materials.goldUpgrade
      : Materials.neonPink;

  // Polyhedral core
  const coreGeo = new THREE.IcosahedronGeometry(0.4, 0);
  const coreMesh = new THREE.Mesh(coreGeo, mat);
  coreMesh.name = 'pickup_core';
  coreMesh.position.y = 0.7;
  group.add(coreMesh);

  // Orbiting rings
  const ringGeo = new THREE.TorusGeometry(0.6, 0.03, 8, 16);
  const ringMesh = new THREE.Mesh(ringGeo, mat);
  ringMesh.name = 'pickup_ring';
  ringMesh.position.y = 0.7;
  group.add(ringMesh);

  // Glow halo light
  const light = new THREE.PointLight(
    type === 'SHIELD' ? 0x00f0ff : type === 'WEAPON' ? 0xffd700 : 0xff007f,
    1.5,
    6
  );
  light.position.y = 0.7;
  group.add(light);

  return group;
}

/**
 * Telegraph Windup Line (for sniper drones/pylons)
 */
export function createTelegraphLine(): THREE.Line {
  const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 50)];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0xff0033,
    transparent: true,
    opacity: 0.6,
    linewidth: 2,
  });
  const line = new THREE.Line(geometry, material);
  line.visible = false;
  return line;
}

/**
 * Telegraph Target Circle (for Mortars/Titan bombs)
 */
export function createTelegraphGroundCircle(radius: number): THREE.Mesh {
  const geo = new THREE.RingGeometry(radius * 0.1, radius, 32);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff1144,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.04;
  return mesh;
}

/**
 * 12-part Composite Colossus Boss Dreadnought (Group)
 */
export function createBossDreadnoughtMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'enemy_colossus_boss';

  // Part 1: Heavy armored hexagonal battle chassis
  const hullShape = new THREE.Shape();
  hullShape.moveTo(0, 5.0);
  hullShape.lineTo(2.8, 1.8);
  hullShape.lineTo(3.4, -2.5);
  hullShape.lineTo(1.8, -4.5);
  hullShape.lineTo(-1.8, -4.5);
  hullShape.lineTo(-3.4, -2.5);
  hullShape.lineTo(-2.8, 1.8);
  hullShape.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 1.6,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.25,
    bevelThickness: 0.25,
  });
  hullGeo.rotateX(Math.PI / 2);
  hullGeo.translate(0, 3.2, 0);
  const hullMesh = new THREE.Mesh(hullGeo, Materials.enemyArmor);
  hullMesh.castShadow = true;
  group.add(hullMesh);

  // Part 2: Command Bridge Superstructure
  const bridgeGeo = new THREE.BoxGeometry(2.2, 1.2, 3.2);
  const bridgeMesh = new THREE.Mesh(bridgeGeo, Materials.hullDark);
  bridgeMesh.position.set(0, 4.4, -0.6);
  bridgeMesh.castShadow = true;
  group.add(bridgeMesh);

  // Part 3: Glowing Menacing Sensor Visor / Optics
  const visorGeo = new THREE.BoxGeometry(2.0, 0.35, 0.4);
  const visorMesh = new THREE.Mesh(visorGeo, Materials.enemyCrimson);
  visorMesh.position.set(0, 4.4, 0.95);
  group.add(visorMesh);

  // Part 4: Central Exposed Plasma Core (vulnerable zone)
  const coreGeo = new THREE.SphereGeometry(1.2, 16, 16);
  const coreMesh = new THREE.Mesh(coreGeo, Materials.amberWarning);
  coreMesh.name = 'boss_plasma_core';
  coreMesh.position.set(0, 3.2, 0.2);
  group.add(coreMesh);

  // Part 5: Rotating Heavy Orbital Deflector Shield Ring
  const shieldRingGeo = new THREE.TorusGeometry(4.8, 0.16, 8, 32);
  shieldRingGeo.rotateX(Math.PI / 2);
  const shieldRing = new THREE.Mesh(shieldRingGeo, Materials.neonPink);
  shieldRing.name = 'boss_shield_ring';
  shieldRing.position.set(0, 3.2, 0);
  group.add(shieldRing);

  // Part 6 & 7: Twin Spinal Hyper-Beam Cannons
  const cannonGeo = new THREE.CylinderGeometry(0.35, 0.45, 4.8, 10);
  cannonGeo.rotateX(Math.PI / 2);
  const leftCannon = new THREE.Mesh(cannonGeo, Materials.gunMetal);
  leftCannon.position.set(-2.0, 3.2, 3.2);
  leftCannon.castShadow = true;
  group.add(leftCannon);

  const rightCannon = new THREE.Mesh(cannonGeo, Materials.gunMetal);
  rightCannon.position.set(2.0, 3.2, 3.2);
  rightCannon.castShadow = true;
  group.add(rightCannon);

  // Part 8 & 9: Massive Twin Vector Thrusters
  const thrusterGeo = new THREE.CylinderGeometry(0.8, 1.1, 2.6, 12);
  thrusterGeo.rotateX(Math.PI / 2);
  const leftThruster = new THREE.Mesh(thrusterGeo, Materials.gunMetal);
  leftThruster.position.set(-1.8, 3.2, -4.2);
  group.add(leftThruster);

  const rightThruster = new THREE.Mesh(thrusterGeo, Materials.gunMetal);
  rightThruster.position.set(1.8, 3.2, -4.2);
  group.add(rightThruster);

  // Thruster Flame Rings
  const flameRingGeo = new THREE.TorusGeometry(0.85, 0.1, 8, 16);
  const leftFlame = new THREE.Mesh(flameRingGeo, Materials.enemyCrimson);
  leftFlame.position.set(-1.8, 3.2, -5.5);
  group.add(leftFlame);

  const rightFlame = new THREE.Mesh(flameRingGeo, Materials.enemyCrimson);
  rightFlame.position.set(1.8, 3.2, -5.5);
  group.add(rightFlame);

  // Part 10: Quad Stabilization Wings
  const wingGeo = new THREE.BoxGeometry(2.4, 0.15, 1.6);
  wingGeo.rotateZ(0.2);
  const leftWing = new THREE.Mesh(wingGeo, Materials.enemyArmor);
  leftWing.position.set(-3.6, 3.6, -1.2);
  group.add(leftWing);

  const rightWing = new THREE.Mesh(wingGeo.clone().rotateZ(-0.4), Materials.enemyArmor);
  rightWing.position.set(3.6, 3.6, -1.2);
  group.add(rightWing);

  // Part 11: Forward Missile Pods
  const podGeo = new THREE.BoxGeometry(0.9, 0.6, 1.8);
  const leftPod = new THREE.Mesh(podGeo, Materials.gunMetal);
  leftPod.position.set(-1.0, 3.8, 2.4);
  group.add(leftPod);

  const rightPod = new THREE.Mesh(podGeo, Materials.gunMetal);
  rightPod.position.set(1.0, 3.8, 2.4);
  group.add(rightPod);

  // Part 12: Huge Contact Shadow
  const shadowGeo = new THREE.PlaneGeometry(12, 14);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: createContactShadowTexture(),
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.set(0, 0.02, 0);
  group.add(shadowMesh);

  return group;
}
