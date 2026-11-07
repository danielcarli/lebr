/*
 * LEBR — Laboratório de Estruturas Brasil
 * Copyright (C) 2026 Daniel Michelon De Carli
 *
 * Feito com uso da inteligência artificial Claude Opus 5.5, sob a orientação de Daniel Michelon De Carli.
 *
 * Este programa é software livre: você pode redistribuí-lo e/ou modificá-lo nos termos da GNU General Public
 * License, versão 3, publicada pela Free Software Foundation. É distribuído na esperança de ser útil, mas SEM
 * NENHUMA GARANTIA, nem mesmo a garantia implícita de COMERCIALIZAÇÃO ou de ADEQUAÇÃO A UMA FINALIDADE
 * ESPECÍFICA. Veja o arquivo LICENSE ou <https://www.gnu.org/licenses/gpl-3.0.html>.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 */
/**
 * Vista 3D isolada da armadura de um elemento (0.32) — Three.js, com um único contexto WebGL reaproveitado entre as
 * vistas (a tela do elemento é redesenhada a cada cálculo; um contexto por desenho esgotaria o limite do navegador).
 *
 * Arrastar gira, Shift+arrastar (ou botão direito) desloca, a roda aproxima. Passar o mouse sobre uma barra mostra a
 * posição (N) e destaca a linha correspondente na lista de ferros, como no desenho 2D.
 */
import * as THREE from '../assets/vendor/three/three.module.min.js';
import { h } from './dom.js';
import { icone } from './icones.js';
import { limitesDoModelo } from '../../modules/comum/armadura3d.js';

const CORES = {
  positiva: 0xb85438, construtiva: 0xc98a6e, negativa: 0x2f5fa3, 'porta-estribo': 0x7b8fae, pele: 0x6f8f3a, 'torção': 0x8c5fb0,
  estribo: 0x6d6a66, longitudinal: 0xb85438, arranque: 0x2f5fa3, suplementar: 0x8c5fb0, 'distribuição': 0x7b8fae,
};
/** Tema blueprint: cores claras e saturadas, com contraste sobre o papel azul. */
const CORES_AZUL = {
  positiva: 0xffb347, construtiva: 0xffd9a8, negativa: 0x7fe3ff, 'porta-estribo': 0xd6e2f3, pele: 0xbdf08c, 'torção': 0xe6b3ff,
  estribo: 0xffffff, longitudinal: 0xffb347, arranque: 0x7fe3ff, suplementar: 0xe6b3ff, 'distribuição': 0xd6e2f3,
};
const corBarra = (t) => ((document.documentElement.dataset.tema === 'blueprint' ? CORES_AZUL : CORES)[t] ?? 0x888888);
const NOMES = {
  positiva: 'Positiva', construtiva: 'Construtiva', negativa: 'Negativa', 'porta-estribo': 'Porta-estribo', pele: 'Pele', 'torção': 'Torção',
  estribo: 'Estribo', longitudinal: 'Longitudinal', arranque: 'Arranque', suplementar: 'Grampo', 'distribuição': 'Distribuição',
};

let renderer = null;   // compartilhado
let dono = null;       // vista que está com o canvas

function obterRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  }
  return renderer;
}

/**
 * @param {{caixas, barras}} modelo   ver modules/comum/armadura3d.js
 * @param {{altura?:number, aoDestacar?:(id:string|null)=>void, legenda?:string}} [op]
 */
export function vistaArmadura3D(modelo, { altura = 440, aoDestacar } = {}) {
  const palco = h('div', { class: 'v3a-palco', style: { height: `${altura}px` } });
  const dica = h('div', { class: 'v3a-dica' });
  const estado = { concreto: true, estribos: true };
  const raiz = h('div', { class: 'vista-3d-armadura' });

  const cena = new THREE.Scene();
  cena.add(new THREE.HemisphereLight(0xffffff, 0x8a8076, 1.6));
  const sol = new THREE.DirectionalLight(0xffffff, 1.4); sol.position.set(1, -1.4, 2); cena.add(sol);
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 100000);
  camera.up.set(0, 0, 1);

  // concreto: caixas transparentes com as arestas
  const grupoConcreto = new THREE.Group();
  for (const c of modelo.caixas) {
    const d = c.max.map((v, i) => v - c.min[i]);
    let g;
    if (c.forma === 'cilindro') {
      // cilindro de eixo z (o CylinderGeometry do three é em y): gira para ficar de pé no z
      g = new THREE.CylinderGeometry(d[0] / 2, d[0] / 2, d[2], 40, 1);
      g.rotateX(Math.PI / 2);
    } else g = new THREE.BoxGeometry(...d);
    const apoio = c.tipo !== 'concreto';
    const azul = document.documentElement.dataset.tema === 'blueprint';   // tema blueprint: arestas brancas no papel azul
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: azul ? 0xe8f0fb : apoio ? 0xb9b2a8 : 0xd8d2c8, transparent: true, opacity: apoio ? 0.07 : 0.14, depthWrite: false }));
    m.position.set(...c.min.map((v, i) => v + d[i] / 2));
    const arestas = new THREE.LineSegments(new THREE.EdgesGeometry(g, c.forma === 'cilindro' ? 30 : 1), new THREE.LineBasicMaterial({ color: azul ? 0xffffff : apoio ? 0xa69c8e : 0x857664, transparent: true, opacity: apoio ? 0.4 : 0.9 }));
    arestas.position.copy(m.position);
    grupoConcreto.add(m, arestas);
  }
  cena.add(grupoConcreto);

  // barras: tubos pelo eixo (raio = ø/2, com um mínimo para enxergar as finas de longe)
  const grupoBarras = new THREE.Group(), grupoEstribos = new THREE.Group();
  const materiais = new Map();
  const mat = (tipo) => {
    if (!materiais.has(tipo)) materiais.set(tipo, new THREE.MeshStandardMaterial({ color: corBarra(tipo), roughness: 0.55, metalness: 0.25 }));
    return materiais.get(tipo);
  };
  const destaqueMat = new THREE.MeshStandardMaterial({ color: 0xffb000, emissive: 0x553300, roughness: 0.4 });
  const malhas = [];
  for (const b of modelo.barras) {
    const pts = b.pts.map((p) => new THREE.Vector3(...p));
    if (pts.length < 2) continue;
    const raio = Math.max(b.phi / 20, 0.22);
    const curva = new THREE.CurvePath();
    for (let i = 0; i < pts.length - 1; i++) if (pts[i].distanceTo(pts[i + 1]) > 1e-6) curva.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
    if (!curva.curves.length) continue;
    const geo = new THREE.TubeGeometry(curva, Math.max(1, curva.curves.length) * 2, raio, 8, false);
    const malha = new THREE.Mesh(geo, mat(b.tipo));
    malha.userData = { id: b.id, N: b.N, tipo: b.tipo, phi: b.phi };
    (b.tipo === 'estribo' ? grupoEstribos : grupoBarras).add(malha);
    malhas.push(malha);
  }
  cena.add(grupoBarras, grupoEstribos);

  // câmera: órbita em torno do centro do modelo
  const { min, max } = limitesDoModelo(modelo);
  const centro = new THREE.Vector3(...min.map((v, i) => (v + max[i]) / 2));
  const tamanho = Math.max(...max.map((v, i) => v - min[i]), 50);
  const vista = modelo.vista ?? {};
  const orbita = { teta: vista.teta ?? -Math.PI / 4, fi: vista.fi ?? 1.05, dist: tamanho * 1.5, alvo: centro.clone() };
  const posicionar = () => {
    const { teta, fi, dist, alvo } = orbita;
    camera.position.set(alvo.x + dist * Math.sin(fi) * Math.cos(teta), alvo.y + dist * Math.sin(fi) * Math.sin(teta), alvo.z + dist * Math.cos(fi));
    camera.lookAt(alvo);
  };
  /** distância que faz a caixa do modelo caber no quadro, na direção atual da câmera */
  const distanciaQueCabe = () => {
    const w = palco.clientWidth || 600, hh = palco.clientHeight || altura;
    const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), th = tv * (w / hh);
    const { teta, fi } = orbita;
    const frente = new THREE.Vector3(Math.sin(fi) * Math.cos(teta), Math.sin(fi) * Math.sin(teta), Math.cos(fi)); // do alvo para a câmera
    const direita = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), frente).normalize();
    if (direita.lengthSq() < 1e-9) direita.set(1, 0, 0);
    const cima = new THREE.Vector3().crossVectors(frente, direita).normalize();
    let d = 0;
    for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
      const v = new THREE.Vector3(x, y, z).sub(centro);
      const z0 = v.dot(frente);
      d = Math.max(d, Math.abs(v.dot(direita)) / th + z0, Math.abs(v.dot(cima)) / tv + z0);
    }
    return d * 1.1;
  };
  const enquadrar = () => {
    orbita.teta = vista.teta ?? -Math.PI / 4; orbita.fi = vista.fi ?? 1.05; orbita.alvo.copy(centro);
    orbita.dist = distanciaQueCabe(); desenhar();
  };

  function tomarCanvas() {
    const r = obterRenderer();
    if (dono !== raiz || r.domElement.parentNode !== palco) { palco.prepend(r.domElement); dono = raiz; }
    return r;
  }
  function desenhar() {
    if (!palco.isConnected) return;
    const r = tomarCanvas();
    const w = palco.clientWidth || 600, hh = palco.clientHeight || altura;
    if (r.domElement.width !== Math.round(w * r.getPixelRatio()) || r.domElement.height !== Math.round(hh * r.getPixelRatio())) r.setSize(w, hh, false);
    r.domElement.style.width = '100%'; r.domElement.style.height = '100%';
    camera.aspect = w / hh; camera.updateProjectionMatrix();
    posicionar();
    r.render(cena, camera);
  }

  // interação
  const raycaster = new THREE.Raycaster();
  let arrasto = null, sobre = null;
  palco.addEventListener('pointerdown', (e) => { arrasto = { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button === 2 }; palco.setPointerCapture(e.pointerId); });
  palco.addEventListener('pointerup', (e) => { arrasto = null; palco.releasePointerCapture?.(e.pointerId); });
  palco.addEventListener('contextmenu', (e) => e.preventDefault());
  palco.addEventListener('pointermove', (e) => {
    if (arrasto) {
      const dx = e.clientX - arrasto.x, dy = e.clientY - arrasto.y;
      arrasto.x = e.clientX; arrasto.y = e.clientY;
      if (arrasto.pan) {
        const k = orbita.dist / (palco.clientHeight || 400);
        const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
        const direita = new THREE.Vector3().crossVectors(dir, camera.up).normalize();
        const cima = new THREE.Vector3().crossVectors(direita, dir).normalize();
        orbita.alvo.addScaledVector(direita, -dx * k).addScaledVector(cima, dy * k);
      } else {
        orbita.teta -= dx * 0.008;
        orbita.fi = Math.min(Math.PI - 0.05, Math.max(0.05, orbita.fi - dy * 0.008));
      }
      desenhar();
      return;
    }
    // barra sob o mouse
    const r = palco.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const alvo = raycaster.intersectObjects(malhas.filter((m) => m.parent.visible), false)[0]?.object ?? null;
    const id = alvo?.userData.id ?? null;
    if (id !== sobre) {
      sobre = id;
      for (const m of malhas) m.material = m.userData.id === id ? destaqueMat : mat(m.userData.tipo);
      dica.textContent = alvo ? `${alvo.userData.N ?? ''} · ${NOMES[alvo.userData.tipo] ?? alvo.userData.tipo} · ø ${String(alvo.userData.phi).replace('.', ',')}` : '';
      dica.classList.toggle('visivel', !!alvo);
      aoDestacar?.(id);
      desenhar();
    }
  });
  palco.addEventListener('pointerleave', () => { if (sobre) { sobre = null; for (const m of malhas) m.material = mat(m.userData.tipo); dica.classList.remove('visivel'); aoDestacar?.(null); desenhar(); } });
  palco.addEventListener('wheel', (e) => { e.preventDefault(); orbita.dist = Math.min(tamanho * 8, Math.max(tamanho * 0.15, orbita.dist * (e.deltaY > 0 ? 1.12 : 0.89))); desenhar(); }, { passive: false });
  const ro = new ResizeObserver(() => desenhar());
  ro.observe(palco);

  const alternar = (chave, grupo, rotulo) => {
    const b = h('button', { class: ['v3a-bt', 'ligado'], onClick: () => { estado[chave] = !estado[chave]; grupo.visible = estado[chave]; b.classList.toggle('ligado', estado[chave]); desenhar(); } }, rotulo);
    return b;
  };
  const tipos = [...new Set(modelo.barras.map((b) => b.tipo))];
  raiz.append(
    h('div', { class: 'v3a-barra' },
      alternar('concreto', grupoConcreto, 'Concreto'),
      grupoEstribos.children.length ? alternar('estribos', grupoEstribos, 'Estribos') : '',
      h('button', { class: 'v3a-bt', title: 'Voltar à vista inicial', onClick: enquadrar }, icone('cubo', { tamanho: 13, traco: 1.8 }), 'Enquadrar'),
      h('span', { class: 'v3a-legenda' }, tipos.map((t) => h('span', { class: 'v3a-leg' }, h('i', { style: { background: `#${corBarra(t).toString(16).padStart(6, '0')}` } }), NOMES[t] ?? t))),
      h('span', { class: 'v3a-ajuda' }, 'arrastar gira · Shift+arrastar desloca · roda aproxima')),
    h('div', { class: 'v3a-moldura' }, palco, dica),
  );
  requestAnimationFrame(() => requestAnimationFrame(enquadrar));
  // ao sair da tela, libera a geometria (o contexto WebGL é compartilhado e fica)
  const vigia = setInterval(() => {
    if (raiz.isConnected) return;
    clearInterval(vigia); ro.disconnect();
    cena.traverse((o) => { o.geometry?.dispose(); });
    for (const m of materiais.values()) m.dispose();
    destaqueMat.dispose();
    if (dono === raiz) dono = null;
  }, 3000);
  raiz.destacar = (id) => { for (const m of malhas) m.material = m.userData.id === id ? destaqueMat : mat(m.userData.tipo); desenhar(); };
  return raiz;
}
