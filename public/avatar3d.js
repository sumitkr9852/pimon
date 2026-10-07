// Procedural low-poly avatar builder — zero downloads, pure Three.js.
import * as THREE from 'three';

export const AVATARS = {
  baddie: { label: 'BADDIE', body: 0x17171c, eye: 0xff3b30, eyeGlow: true, extra: 'horns' },
  mogger: { label: 'MOGGER', body: 0xc8ff3d, eye: 0x0a0a0a, extra: 'shades' },
  alpha:  { label: 'ALPHA',  body: 0xffc93d, eye: 0x0a0a0a, extra: 'crown' },
  ghost:  { label: 'GHOST',  body: 0xe8e8ea, eye: 0x3d5bff, extra: null },
};

export function buildAvatar(key) {
  const v = AVATARS[key] || AVATARS.ghost;
  const g = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: v.body, roughness: 0.55, metalness: 0.15 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.6, 8, 20), bodyMat);
  g.add(body);

  // belly patch
  const belly = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 20, 16),
    new THREE.MeshStandardMaterial({ color: v.body, roughness: 0.7 })
  );
  belly.scale.set(1, 1.15, 0.55);
  belly.position.set(0, -0.18, 0.3);
  g.add(belly);

  // eyes
  const pupils = [];
  [-1, 1].forEach((s) => {
    const white = new THREE.Mesh(
      new THREE.SphereGeometry(0.115, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
    );
    white.position.set(s * 0.19, 0.32, 0.4);
    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, 12, 10),
      new THREE.MeshStandardMaterial({
        color: v.eye, roughness: 0.25,
        emissive: v.eyeGlow ? v.eye : 0x000000, emissiveIntensity: v.eyeGlow ? 1.6 : 0,
      })
    );
    pupil.position.set(s * 0.19, 0.32, 0.5);
    pupil.userData.base = pupil.position.clone();
    g.add(white, pupil);
    pupils.push(pupil);
  });

  // extras
  if (v.extra === 'horns') {
    const hm = new THREE.MeshStandardMaterial({ color: 0xff3b30, roughness: 0.4, emissive: 0xff3b30, emissiveIntensity: 0.5 });
    [-1, 1].forEach((s) => {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.42, 10), hm);
      horn.position.set(s * 0.34, 0.78, 0);
      horn.rotation.z = -s * 0.5;
      g.add(horn);
    });
  } else if (v.extra === 'shades') {
    const sm = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.25, metalness: 0.4 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.1), sm);
    bar.position.set(0, 0.34, 0.48);
    g.add(bar);
    [-1, 1].forEach((s) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.3), sm);
      arm.position.set(s * 0.36, 0.34, 0.36);
      g.add(arm);
    });
  } else if (v.extra === 'crown') {
    const cm = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.3, metalness: 0.8 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.16, 12), cm);
    band.position.set(0, 0.82, 0);
    g.add(band);
    for (let i = -1; i <= 1; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 8), cm);
      spike.position.set(i * 0.2, 0.98, 0);
      g.add(spike);
    }
  }

  g.userData = { pupils, body, variant: key };
  return g;
}

// idle vibe + mouse-track pupils. t = seconds, mouse = {x,y} in -1..1
export function animateAvatar(g, t, mouse, energy = 0) {
  const { pupils, body } = g.userData;
  const bob = Math.sin(t * 2.2) * 0.05;
  const sway = Math.sin(t * 1.4) * 0.04;
  g.position.y = (g.userData.groundY || 0) + bob + energy * 0.15;
  g.rotation.z = sway * 0.4;
  body.scale.y = 1 + Math.sin(t * 2.2 + 1) * 0.02;
  pupils.forEach((p) => {
    p.position.x = p.userData.base.x + (mouse?.x || 0) * 0.035;
    p.position.y = p.userData.base.y + (mouse?.y || 0) * 0.03;
  });
}

// jump state machine — call startJump once, then stepJump each frame until done
export function startJump(g) {
  if (g.userData.jumping) return;
  g.userData.jumping = true;
  g.userData.jumpT = 0;
}
export function stepJump(g, dt) {
  const u = g.userData;
  if (!u.jumping) return false;
  u.jumpT += dt / 0.65;
  const t = Math.min(u.jumpT, 1);
  const h = 1.15;
  u.jumpY = 4 * h * t * (1 - t);
  // squash & stretch
  const stretch = Math.sin(t * Math.PI);
  u.body.scale.set(1 - stretch * 0.12, 1 + stretch * 0.18, 1 - stretch * 0.12);
  if (t >= 1) {
    u.jumping = false;
    u.jumpY = 0;
    u.landT = 0; // landing squash
  }
  return u.jumping;
}
export function stepLand(g, dt) {
  const u = g.userData;
  if (u.landT === undefined || u.landT > 1) return;
  u.landT += dt / 0.22;
  const k = Math.max(0, 1 - (u.landT || 0));
  u.body.scale.set(1 + k * 0.18, 1 - k * 0.22, 1 + k * 0.18);
}
