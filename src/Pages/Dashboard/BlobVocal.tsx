// Assistant Fondateur — forme 3D d'état (2026-08-13).
//
// Reprend la sphère du portfolio : icosaèdre subdivisé déplacé le long de ses
// normales par un bruit simplex, cœur sombre et rebord lumineux par effet de
// Fresnel. Elle porte la couleur et l'agitation de l'état en cours.
//
// Trois formes seulement s'y ajoutent, chacune liée à un outil : le cylindre à
// bourrelets pendant une lecture de la base, l'histogramme pendant la
// construction d'un graphique, la pile d'ouvrages pendant la production d'un
// document. Deux tentatives plus ambitieuses ont été écartées — une dizaine de
// solides modelés à la main, puis les icônes du client extrudées au pixel près
// depuis leur profil polaire. Les deux étaient géométriquement justes, mais à
// 360 pixels, en rotation et sous le rebord lumineux, on ne les distinguait
// plus les unes des autres. Trois formes franches valent mieux que vingt
// approximatives.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { StatutVocal } from '../../lib/useAssistantVocal';

/** Formes disponibles. Les libelles viennent du serveur
 *  (services/assistantFormes.service.js) ; un nom inconnu retombe sur la sphere. */
export const FORMES = { sphere: 0, base: 1, graphe: 2, livre: 3 } as const;
export type NomForme = keyof typeof FORMES;

/** Une forme reconnaissable doit rester lisible : le relief de bruit s'efface
 *  presque entierement des qu'on quitte la sphere, et l'objet grossit un peu
 *  pour compenser son encombrement moindre. */
const RELIEF_FORME = 0.026;
const ECHELLE_FORME = 1.24;

const BRUIT_SIMPLEX = /* glsl */ `
  vec3 mod289(vec3 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
  vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
               i.z + vec4(0.0, i1.z, i2.z, 1.0))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0))
             + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
`;

const SOMMET = /* glsl */ `
  uniform float uTime;
  uniform float uDistort;
  uniform float uFrequency;
  uniform float uSpeed;
  uniform int   uFormeA;    // forme quittee
  uniform int   uFormeB;    // forme visee
  uniform float uMorph;     // 0 -> 1 : progression de A vers B
  uniform float uMontage;   // 0 -> 1 : hauteur des barres pendant l'assemblage

  varying vec3 vNormal;
  varying vec3 vView;
  varying float vNoise;

  ${BRUIT_SIMPLEX}

  float fbm(vec3 p){
    float f = 0.0;
    f += 0.5  * snoise(p);
    f += 0.25 * snoise(p * 2.0 + 1.7);
    return f;
  }

  // ── Bibliotheque de solides ─────────────────────────────────────────────
  //
  // Chaque forme est une UNION de primitives convexes, et le point de surface
  // dans la direction d est la SORTIE la plus lointaine parmi elles. Ce procede
  // ne vaut que pour des unions « etoilees » depuis le centre — dont chaque
  // point est visible de l'origine — ce qui est vrai ici puisque toutes
  // s'appuient sur un volume central contenant l'origine, et que les elements
  // empiles se CHEVAUCHENT. Un intervalle serait comble par l'union et
  // produirait une membrane parasite.

  float sortieBoite(vec3 d, vec3 c, vec3 e){
    vec3 inv = 1.0 / (abs(d) + 1e-6) * sign(d + 1e-9);
    vec3 n = inv * c;
    vec3 k = abs(inv) * e;
    float tF = min(min((n + k).x, (n + k).y), (n + k).z);
    float tN = max(max((n - k).x, (n - k).y), (n - k).z);
    return (tF < tN || tF < 0.0) ? -1.0 : tF;
  }

  float sortieCylindreY(vec3 d, vec3 c, float r, float hh){
    vec2 dxz = d.xz;
    float a = dot(dxz, dxz);
    float tLat = 1e9;
    if (a > 1e-6) {
      float b = dot(dxz, c.xz);
      float cc = dot(c.xz, c.xz) - r * r;
      float h = b * b - a * cc;
      if (h < 0.0) return -1.0;
      tLat = (b + sqrt(h)) / a;
    }
    float tCap = abs(d.y) < 1e-6 ? 1e9 : (c.y + sign(d.y) * hh) / d.y;
    float t = min(tLat, tCap);
    return t < 0.0 ? -1.0 : t;
  }

  // Base de donnees : cylindre a bourrelets. Ce sont les trois renflements qui
  // font lire « disques empiles » plutot que « boite de conserve ».
  float rayonBase(vec3 d){
    float R = 0.74;
    float H = 0.66;
    float radial = max(length(d.xz), 1e-4);
    float vertical = max(abs(d.y), 1e-4);
    float t = min(R / radial, H / vertical);
    float onde = 0.055 * cos(d.y * t / H * 9.4248);
    return min((R + onde) / radial, H / vertical);
  }

  // Histogramme : trois gradins qui montent depuis une dalle plate.
  float hauteurColonne(float x){
    if (x < -0.28) return 0.30;
    if (x <  0.28) return 0.55;
    return 0.84;
  }

  float rayonGraphe(vec3 d){
    float X = 0.80;
    float Z = 0.30;
    float ax = max(abs(d.x), 1e-4);
    float ay = max(abs(d.y), 1e-4);
    float az = max(abs(d.z), 1e-4);
    float murs = min(X / ax, Z / az);
    float t = murs;
    // Le sommet depend de x, qui depend lui-meme du rayon cherche : trois
    // iterations suffisent, la hauteur etant constante par palier.
    for (int i = 0; i < 3; i++) {
      float plafond = d.y > 0.0
        ? mix(0.16, hauteurColonne(d.x * t), uMontage)
        : 0.60;
      t = min(murs, plafond / ay);
    }
    return t;
  }

  // Ouvrages empiles. Trois volumes decales en X : c'est le decalage qui les
  // distingue les uns des autres. Un simple pave se lisait comme une planche.
  float rayonLivre(vec3 d){
    float t = sortieBoite(d, vec3( 0.00, -0.31, 0.0), vec3(0.74, 0.16, 0.52));
    t = max(t, sortieBoite(d, vec3( 0.07,  0.00, 0.0), vec3(0.68, 0.16, 0.47)));
    t = max(t, sortieBoite(d, vec3(-0.06,  0.31, 0.0), vec3(0.72, 0.16, 0.50)));
    return max(t, 0.05);
  }

  // Aiguillage : la forme est un uniforme, donc le branchement est identique
  // pour tous les sommets — aucune divergence de flux dans le nuanceur.
  float rayonForme(int forme, vec3 d){
    if (forme == 1) return rayonBase(d);
    if (forme == 2) return rayonGraphe(d);
    if (forme == 3) return rayonLivre(d);
    return 1.0;                                   // 0 : sphere de rayon 1
  }

  vec3 deplacer(vec3 p){
    vec3 d = normalize(p);
    // Interpolation du RAYON, pas d'une position quelconque : chaque sommet
    // garde sa direction, ce qui interdit tout croisement de surface.
    float t = mix(rayonForme(uFormeA, d), rayonForme(uFormeB, d), uMorph);
    float n = fbm(p * uFrequency + uTime * uSpeed);
    return d * t + d * n * uDistort;
  }

  void main(){
    // Normale recalculee sur la surface deformee : garder celle de la sphere
    // d'origine aplatirait tout le relief a l'eclairage.
    vec3 nrm = normalize(position);
    vec3 tangent = normalize(
      cross(nrm, abs(nrm.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0))
    );
    vec3 bitangent = normalize(cross(nrm, tangent));
    float eps = 0.02;

    vec3 p0 = deplacer(position);
    vec3 p1 = deplacer(position + tangent   * eps);
    vec3 p2 = deplacer(position + bitangent * eps);
    vec3 nouvelleNormale = normalize(cross(p1 - p0, p2 - p0));

    vNoise = fbm(position * uFrequency + uTime * uSpeed);
    vNormal = normalize(normalMatrix * nouvelleNormale);

    vec4 mv = modelViewMatrix * vec4(p0, 1.0);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColorCore;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform float uFresnelPower;

  varying vec3 vNormal;
  varying vec3 vView;
  varying float vNoise;

  void main(){
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vView);
    float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), uFresnelPower);

    float t = clamp(vNoise * 0.5 + 0.5, 0.0, 1.0);
    vec3 grad = mix(uColorA, uColorB, t);
    grad = mix(grad, uColorC, smoothstep(0.4, 1.0, t));

    // Coeur sombre, rebord lumineux.
    vec3 color = mix(uColorCore, grad, fres);
    color += grad * pow(fres, 2.0) * 0.6;
    color += uColorA * smoothstep(0.55, 1.0, t) * 0.15;

    gl_FragColor = vec4(color, 1.0);
  }
`;

interface Profil {
  /** Cœur — volontairement très sombre : son contraste avec le rebord est ce
   *  qui produit la lecture « volume » sur un fond clair. */
  coeur: string;
  /** Dégradé du rebord, des creux vers les crêtes. */
  a: string;
  b: string;
  c: string;
  /** Relief de bruit, appliqué seulement à la sphère au repos. */
  distorsion: number;
  /** Vitesse de défilement du bruit. */
  vitesse: number;
  /** Vitesse de rotation. */
  rotation: number;
}

const PROFILS_ETAT: Record<StatutVocal, Profil> = {
  inactif:      { coeur: '#141d33', a: '#8792ab', b: '#aab3c6', c: '#cdd4e2', distorsion: 0.16, vitesse: 0.10, rotation: 0.08 },
  connexion:    { coeur: '#141d33', a: '#7f93bb', b: '#9fb0d0', c: '#c6d1e6', distorsion: 0.20, vitesse: 0.30, rotation: 0.20 },
  ecoute:       { coeur: '#171a26', a: '#e0b455', b: '#c08f2e', c: '#f4e2b6', distorsion: 0.20, vitesse: 0.16, rotation: 0.11 },
  reflexion:    { coeur: '#0c1730', a: '#4f92dd', b: '#1e4d82', c: '#a8c6ec', distorsion: 0.030, vitesse: 0.55, rotation: 0.34 },
  construction: { coeur: '#1d1330', a: '#9d7ae0', b: '#6d4bb8', c: '#d3c3f2', distorsion: 0.022, vitesse: 0.30, rotation: 0.24 },
  parle:        { coeur: '#0f2119', a: '#3fae7e', b: '#237a53', c: '#a9dcc4', distorsion: 0.20, vitesse: 0.22, rotation: 0.13 },
  erreur:       { coeur: '#2a1512', a: '#c46a55', b: '#9c3d2c', c: '#e8b6aa', distorsion: 0.12, vitesse: 0.06, rotation: 0.04 },
};

export default function BlobVocal({ statut, forme }: { statut: StatutVocal; forme: NomForme }) {
  const monture = useRef<HTMLDivElement>(null);
  const statutRef = useRef<StatutVocal>(statut);
  const formeRef = useRef<NomForme>(forme);
  useEffect(() => { statutRef.current = statut; }, [statut]);
  useEffect(() => { formeRef.current = forme; }, [forme]);

  useEffect(() => {
    const hote = monture.current;
    if (!hote) return;

    const sobre = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);

    let rendu: THREE.WebGLRenderer;
    try {
      rendu = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // WebGL indisponible — l'écran reste utilisable sans la forme
    }
    rendu.setPixelRatio(ratio);
    rendu.setClearAlpha(0);
    rendu.domElement.style.width = '100%';
    rendu.domElement.style.height = '100%';
    rendu.domElement.style.display = 'block';
    hote.appendChild(rendu.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 3.8);

    const groupe = new THREE.Group();
    scene.add(groupe);

    const depart = PROFILS_ETAT.inactif;
    const uniformes = {
      uTime: { value: 0 },
      uDistort: { value: depart.distorsion },
      uFrequency: { value: 1.35 },
      uSpeed: { value: depart.vitesse },
      uFormeA: { value: 0 },
      uFormeB: { value: 0 },
      uMorph: { value: 1 },
      uMontage: { value: 0 },
      uFresnelPower: { value: 2.1 },
      uColorCore: { value: new THREE.Color(depart.coeur) },
      uColorA: { value: new THREE.Color(depart.a) },
      uColorB: { value: new THREE.Color(depart.b) },
      uColorC: { value: new THREE.Color(depart.c) },
    };

    const geometrie = new THREE.IcosahedronGeometry(1, 22);
    const matiere = new THREE.ShaderMaterial({
      vertexShader: SOMMET,
      fragmentShader: FRAGMENT,
      uniforms: uniformes,
    });
    groupe.add(new THREE.Mesh(geometrie, matiere));

    const redimensionner = () => {
      const { width, height } = hote.getBoundingClientRect();
      if (!width || !height) return;
      rendu.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    redimensionner();
    const observateur = new ResizeObserver(redimensionner);
    observateur.observe(hote);

    const courant: Profil = { ...depart };
    const coeur = new THREE.Color(depart.coeur);
    const cA = new THREE.Color(depart.a);
    const cB = new THREE.Color(depart.b);
    const cC = new THREE.Color(depart.c);
    // Couleurs cibles réutilisées d'une image à l'autre : en allouer quatre par
    // image, soixante fois par seconde, occupe le ramasse-miettes pour rien.
    const cibleCoeur = new THREE.Color();
    const cibleA = new THREE.Color();
    const cibleB = new THREE.Color();
    const cibleC = new THREE.Color();

    let horloge = 0;
    let animation = 0;
    let dernierT = performance.now();
    let montage = 0;
    // Mue en cours : uFormeA -> uFormeB. Une fois arrivee, la cible devient la
    // nouvelle origine, ce qui evite de melanger trois formes a la fois.
    let formeA: number = FORMES.sphere;
    let formeB: number = FORMES.sphere;
    let morph = 1;

    const boucle = (maintenant: number) => {
      animation = requestAnimationFrame(boucle);
      // Δt réel : une constante par image doublerait la vitesse sur un 120 Hz.
      const dt = Math.min((maintenant - dernierT) / 1000, 0.05);
      dernierT = maintenant;

      const cible = PROFILS_ETAT[statutRef.current];

      const voulue = FORMES[formeRef.current] ?? FORMES.sphere;
      if (voulue !== formeB) {
        formeA = morph >= 1 ? formeB : formeA;
        formeB = voulue;
        morph = 0;
      }
      morph = Math.min(morph + dt * 1.9, 1);

      // Les barres poussent une fois la forme en place, et retombent a plat des
      // qu'on la quitte : c'est ce geste qui donne « en construction ».
      const monte = formeB === FORMES.graphe ? 1 : 0;
      montage += (monte - montage) * (1 - Math.exp(-dt * (monte ? 1.6 : 6)));

      const k = 1 - Math.exp(-dt * 3);
      courant.distorsion += (cible.distorsion - courant.distorsion) * k;
      courant.vitesse += (cible.vitesse - courant.vitesse) * k;
      courant.rotation += (cible.rotation - courant.rotation) * k;
      coeur.lerp(cibleCoeur.set(cible.coeur), k);
      cA.lerp(cibleA.set(cible.a), k);
      cB.lerp(cibleB.set(cible.b), k);
      cC.lerp(cibleC.set(cible.c), k);

      if (!sobre) horloge += dt;

      // Part de forme reconnaissable actuellement a l'ecran : sert a effacer le
      // relief et a compenser l'echelle sans dependre du statut.
      const partForme = formeB === FORMES.sphere
        ? (formeA === FORMES.sphere ? 0 : 1 - morph)
        : morph + (formeA === FORMES.sphere ? 0 : 1 - morph);

      uniformes.uTime.value = horloge;
      uniformes.uDistort.value = courant.distorsion * (1 - partForme) + RELIEF_FORME * partForme;
      uniformes.uSpeed.value = courant.vitesse;
      uniformes.uFormeA.value = formeA;
      uniformes.uFormeB.value = formeB;
      uniformes.uMorph.value = morph;
      uniformes.uMontage.value = montage;
      uniformes.uColorCore.value.copy(coeur);
      uniformes.uColorA.value.copy(cA);
      uniformes.uColorB.value.copy(cB);
      uniformes.uColorC.value.copy(cC);

      if (!sobre) {
        groupe.rotation.y += dt * courant.rotation;
        groupe.rotation.x = -0.16 + Math.sin(horloge * 0.35) * 0.10;
      }
      groupe.scale.setScalar(1 + (ECHELLE_FORME - 1) * partForme);

      rendu.render(scene, camera);
    };
    animation = requestAnimationFrame(boucle);

    return () => {
      cancelAnimationFrame(animation);
      observateur.disconnect();
      geometrie.dispose();
      matiere.dispose();
      // Sans forceContextLoss, ouvrir et refermer l'écran épuise les contextes
      // WebGL du navigateur (Chrome en autorise seize simultanément).
      rendu.forceContextLoss();
      rendu.dispose();
      rendu.domElement.remove();
    };
  }, []);

  return <div ref={monture} className="mv-blob" aria-hidden="true" />;
}
