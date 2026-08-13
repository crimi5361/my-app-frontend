// Assistant Fondateur — forme 3D d'état (2026-08-12).
//
// Reprend la sphère du portfolio (Portfolio/src/components/ui/HeroSphere.jsx) :
// icosaèdre subdivisé déplacé le long de ses normales par un bruit simplex 3D,
// cœur sombre et rebord lumineux par effet de Fresnel.
//
// La différence : ici la forme PORTE l'information. Elle ne se contente pas de
// changer de couleur, elle devient l'objet dont il est question — un cylindre à
// bourrelets quand le modèle interroge la base, un histogramme en gradins quand
// il assemble un graphique. Le morphing est calculé dans le vertex shader par
// intersection rayon/solide depuis le centre : chaque sommet de la sphère garde
// sa direction et voit seulement son rayon changer, ce qui donne une transition
// continue et sans repli de surface.
//
// L'animation ne réagit PAS au son : seule une respiration lente subsiste, pour
// que les formes restent lisibles.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { StatutVocal } from '../../lib/useAssistantVocal';

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
  uniform float uBase;      // 0 → 1 : sphère vers base de données
  uniform float uBarres;    // 0 → 1 : vers histogramme
  uniform float uMontage;   // 0 → 1 : hauteur des barres pendant l'assemblage

  varying vec3 vNormal;
  varying vec3 vView;
  varying float vNoise;

  ${BRUIT_SIMPLEX}

  // Bruit fractal (2 octaves) pour un relief plus organique
  float fbm(vec3 p){
    float f = 0.0;
    f += 0.5  * snoise(p);
    f += 0.25 * snoise(p * 2.0 + 1.7);
    return f;
  }

  // ── Base de données : cylindre à bourrelets ─────────────────────────────
  // Intersection du rayon partant du centre avec un cylindre plafonné. Le rayon
  // ondule le long de l'axe : ce sont ces bourrelets qui font lire « disques
  // empilés » plutôt que « boîte de conserve ».
  vec3 formeBase(vec3 d){
    float R = 0.74;
    float H = 0.66;
    float radial = max(length(d.xz), 1e-4);
    float vertical = max(abs(d.y), 1e-4);

    // Première passe pour connaître l'altitude, seconde pour appliquer l'onde.
    float t = min(R / radial, H / vertical);
    float y = d.y * t;
    float onde = 0.055 * cos(y / H * 9.4248);   // 3 bourrelets sur la hauteur
    return d * min((R + onde) / radial, H / vertical);
  }

  // ── Histogramme : trois gradins ─────────────────────────────────────────
  float hauteurColonne(float x){
    if (x < -0.28) return 0.30;
    if (x <  0.28) return 0.55;
    return 0.84;
  }

  // Le sommet des colonnes dépend de x, qui dépend lui-même du rayon cherché :
  // trois itérations suffisent à converger, la hauteur étant constante par palier.
  vec3 formeBarres(vec3 d){
    float X = 0.80;
    float Z = 0.30;
    float bas = 0.60;
    float ax = max(abs(d.x), 1e-4);
    float ay = max(abs(d.y), 1e-4);
    float az = max(abs(d.z), 1e-4);
    float murs = min(X / ax, Z / az);

    float t = murs;
    for (int i = 0; i < 3; i++) {
      float plafond = d.y > 0.0
        ? mix(0.16, hauteurColonne(d.x * t), uMontage)  // les barres poussent
        : bas;
      t = min(murs, plafond / ay);
    }
    return d * t;
  }

  vec3 deplacer(vec3 p){
    vec3 d = normalize(p);
    vec3 cible = mix(p, formeBase(d), uBase);
    cible = mix(cible, formeBarres(d), uBarres);
    float n = fbm(p * uFrequency + uTime * uSpeed);
    return cible + d * n * uDistort;
  }

  void main(){
    // Normale recalculée sur la surface déformée (différences finies) : garder
    // celle de la sphère d'origine aplatirait tout le relief à l'éclairage.
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

    // Cœur sombre, rebord lumineux
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
  /** Part de forme « base de données » (0 = sphère). */
  base: number;
  /** Part de forme « histogramme ». */
  barres: number;
  /** Relief de bruit. Faible dès qu'une forme doit rester reconnaissable. */
  distorsion: number;
  /** Vitesse de défilement du bruit. */
  vitesse: number;
  /** Vitesse de rotation. */
  rotation: number;
  /** Compensation d'échelle : les solides tiennent dans un rayon d'environ 0,84
   *  là où la sphère bruitée atteint 1,2. Sans elle, chaque changement de forme
   *  donnerait l'impression que l'objet rétrécit. */
  echelle: number;
}

const PROFILS: Record<StatutVocal, Profil> = {
  inactif:   { coeur: '#141d33', a: '#8792ab', b: '#aab3c6', c: '#cdd4e2', base: 0, barres: 0, distorsion: 0.16, vitesse: 0.10, rotation: 0.08, echelle: 1.00 },
  connexion: { coeur: '#141d33', a: '#7f93bb', b: '#9fb0d0', c: '#c6d1e6', base: 0, barres: 0, distorsion: 0.20, vitesse: 0.30, rotation: 0.20, echelle: 1.00 },
  ecoute:    { coeur: '#171a26', a: '#e0b455', b: '#c08f2e', c: '#f4e2b6', base: 0, barres: 0, distorsion: 0.20, vitesse: 0.16, rotation: 0.11, echelle: 1.00 },
  // Interrogation de la base : la sphère devient un cylindre à bourrelets. Le
  // relief tombe presque à zéro, sinon la silhouette n'est plus reconnaissable.
  reflexion: { coeur: '#0c1730', a: '#4f92dd', b: '#1e4d82', c: '#a8c6ec', base: 1, barres: 0, distorsion: 0.030, vitesse: 0.55, rotation: 0.34, echelle: 1.28 },
  // Assemblage d'un graphique : trois gradins qui montent.
  construction: { coeur: '#1d1330', a: '#9d7ae0', b: '#6d4bb8', c: '#d3c3f2', base: 0, barres: 1, distorsion: 0.022, vitesse: 0.30, rotation: 0.24, echelle: 1.26 },
  parle:     { coeur: '#0f2119', a: '#3fae7e', b: '#237a53', c: '#a9dcc4', base: 0, barres: 0, distorsion: 0.20, vitesse: 0.22, rotation: 0.13, echelle: 1.00 },
  erreur:    { coeur: '#2a1512', a: '#c46a55', b: '#9c3d2c', c: '#e8b6aa', base: 0, barres: 0, distorsion: 0.12, vitesse: 0.06, rotation: 0.04, echelle: 1.00 },
};

export default function BlobVocal({ statut }: { statut: StatutVocal }) {
  const monture = useRef<HTMLDivElement>(null);
  const statutRef = useRef<StatutVocal>(statut);
  useEffect(() => { statutRef.current = statut; }, [statut]);

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

    const depart = PROFILS.inactif;
    const uniformes = {
      uTime: { value: 0 },
      uDistort: { value: depart.distorsion },
      uFrequency: { value: 1.35 },
      uSpeed: { value: depart.vitesse },
      uBase: { value: 0 },
      uBarres: { value: 0 },
      uMontage: { value: 0 },
      uFresnelPower: { value: 2.1 },
      uColorCore: { value: new THREE.Color(depart.coeur) },
      uColorA: { value: new THREE.Color(depart.a) },
      uColorB: { value: new THREE.Color(depart.b) },
      uColorC: { value: new THREE.Color(depart.c) },
    };

    const geometrie = new THREE.IcosahedronGeometry(1, 24);
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

    // Toutes les grandeurs convergent vers celles du profil courant : sans ce
    // lissage, un changement d'état ferait sauter la forme au lieu de la muer.
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
    let montage = 0;
    let animation = 0;
    let dernierT = performance.now();

    const boucle = (maintenant: number) => {
      animation = requestAnimationFrame(boucle);
      // Δt réel : une constante par image doublerait la vitesse sur un 120 Hz.
      const dt = Math.min((maintenant - dernierT) / 1000, 0.05);
      dernierT = maintenant;

      const etat = statutRef.current;
      const cible = PROFILS[etat];
      const k = 1 - Math.exp(-dt * 3);
      courant.base += (cible.base - courant.base) * k;
      courant.barres += (cible.barres - courant.barres) * k;
      courant.distorsion += (cible.distorsion - courant.distorsion) * k;
      courant.vitesse += (cible.vitesse - courant.vitesse) * k;
      courant.rotation += (cible.rotation - courant.rotation) * k;
      courant.echelle += (cible.echelle - courant.echelle) * k;
      coeur.lerp(cibleCoeur.set(cible.coeur), k);
      cA.lerp(cibleA.set(cible.a), k);
      cB.lerp(cibleB.set(cible.b), k);
      cC.lerp(cibleC.set(cible.c), k);

      // Les barres montent une fois la forme en place, et retombent à plat dès
      // qu'on quitte l'état : c'est ce qui donne le geste « en construction ».
      const monte = etat === 'construction' ? 1 : 0;
      montage += (monte - montage) * (1 - Math.exp(-dt * (monte ? 1.6 : 6)));

      if (!sobre) horloge += dt;

      uniformes.uTime.value = horloge;
      uniformes.uDistort.value = courant.distorsion;
      uniformes.uSpeed.value = courant.vitesse;
      uniformes.uBase.value = courant.base;
      uniformes.uBarres.value = courant.barres;
      uniformes.uMontage.value = montage;
      uniformes.uColorCore.value.copy(coeur);
      uniformes.uColorA.value.copy(cA);
      uniformes.uColorB.value.copy(cB);
      uniformes.uColorC.value.copy(cC);

      if (!sobre) {
        groupe.rotation.y += dt * courant.rotation;
        // Léger balancement : de face, un cylindre et un histogramme sont
        // ambigus ; ce basculement laisse voir le dessus et lève le doute.
        groupe.rotation.x = -0.16 + Math.sin(horloge * 0.35) * 0.10;
      }
      groupe.scale.setScalar(courant.echelle);

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
