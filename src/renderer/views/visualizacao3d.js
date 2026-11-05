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
 * Visualização 3D da estrutura montada (Three.js, embutido em assets/vendor/three).
 *
 * Planta (x, y) → cena (x, −z); cotas → eixo vertical y da cena.
 * Lajes e vigas têm a face superior na cota do pavimento; pilares descem da cota
 * do pavimento pelo seu comprimento. Só os elementos posicionados aparecem.
 */
import * as THREE from '../assets/vendor/three/three.module.min.js';
import { h, limpar } from '../ui/dom.js';
import * as ui from '../ui/componentes.js';
import { icone } from '../ui/icones.js';
import { estado } from '../core/estado.js';
import { modulos } from '../core/modulos.js';
import { num } from '../core/formatar.js';
import { estadoDoResultado } from './elemento.js';
import {
  pavimentosOrdenados, pavimento, tipoDe, dimensoesLaje, espessuraLaje, eixoViga, secaoViga, secaoPilar, escadaNaPlanta,
} from '../core/montagem.js';
import { porticoDoEdificio, ventoDoProjeto, plantaDoEdificio, ROTULO_ACAO } from '../../modules/comum/portico-edificio.js';
import { CASOS_VENTO } from '../../engine/combinacoes.js';
import { deformadaBarra } from '../../engine/portico.js';

/** Estado da câmera e das opções (sobrevive aos redesenhos). */
const vista = { projeto: null, alvo: null, raio: 18, teta: -0.9, fi: 0.95, cores: 'verificacao', lajesTransp: false, ocultos: new Set(), afastar: 0, deformada: false, casoDef: 'GQ', fatorDef: 1, vento: false, casoVento: 'V1' };

// painel de controles visível ou recolhido (lembrado entre sessões)
const PREF_PAINEL = 'lebr.3d.painel';
try { vista.painelVisivel = localStorage.getItem(PREF_PAINEL) !== 'oculto'; } catch { vista.painelVisivel = true; }

let alternarAtual = null; // alternador do painel da vista aberta
/** Esconde ou mostra o painel de controles do 3D (na vista aberta, ou só a preferência). */
export function alternarPainel3D() {
  if (alternarAtual) return alternarAtual();
  vista.painelVisivel = !vista.painelVisivel;
  try { localStorage.setItem(PREF_PAINEL, vista.painelVisivel ? 'visivel' : 'oculto'); } catch { /* armazenamento indisponível */ }
}

/** Ajusta opções da vista antes de abrir a aba (ex.: { vento: true } vindo da tela de vento). */
export function opcoes3D(o) { Object.assign(vista, o); }

const CORES = {
  concreto: '#c8c2b8', madeira: '#b58654', aco: '#8d97a3',
  laje: '#d9d3c7', viga: '#9a948a', pilar: '#5f5a53', sapata: '#b3ab9e', estaca: '#8a8378',
  atende: '#9fae93', desatualizado: '#d8d2c6',
};

export function aba3D(acoes) {
  return {
    id: 'visualizacao3d',
    icone: 'cubo',
    titulo: () => 'Visualização 3D',
    render: (container) => renderizar(container, acoes),
  };
}

function corDoTema(nome, padrao) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  return v || padrao;
}

function renderizar(container, acoes) {
  const p = estado.projeto;
  if (!p) return;
  const chave = p.meta?.criadoEm ?? p.meta?.nome;
  if (vista.projeto !== chave) Object.assign(vista, { projeto: chave, alvo: null, ocultos: new Set() });

  container.classList.add('editor-cheio');
  const palco = h('div', { class: 'v3d-palco' });
  const dica = h('div', { class: 'v3d-dica' });
  const cartao = h('div', { class: 'v3d-cartao' });
  const painel = h('div', { class: 'v3d-painel' });
  const botaoMostrar = h('button', { class: 'v3d-mostrar', title: 'Mostrar o painel de controles', 'aria-label': 'Mostrar o painel de controles', onClick: () => alternarPainel(true) },
    icone('lateral', { tamanho: 15 }), h('span', null, 'Controles'));
  const raiz = h('div', { class: ['v3d', !vista.painelVisivel && 'sem-painel'] }, palco, painel, botaoMostrar, cartao, dica);
  container.append(raiz);
  /** Esconde ou mostra o painel de controles lateral; a cena ganha a largura toda. */
  function alternarPainel(visivel = !vista.painelVisivel) {
    vista.painelVisivel = visivel;
    try { localStorage.setItem(PREF_PAINEL, visivel ? 'visivel' : 'oculto'); } catch { /* armazenamento indisponível */ }
    raiz.classList.toggle('sem-painel', !visivel);
    (visivel ? painel.querySelector('.v3d-ocultar') : botaoMostrar)?.focus({ preventScroll: true });
  }
  alternarAtual = () => alternarPainel();

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  } catch (err) {
    painel.remove(); cartao.remove(); dica.remove();
    limpar(palco).append(ui.vazio({ icone: 'alerta', titulo: 'WebGL indisponível', texto: `A placa de vídeo ou o driver não oferece WebGL (${err.message}). Atualize o driver de vídeo; a montagem em planta (F6) continua disponível.` }));
    return { destruir() { container.classList.remove('editor-cheio'); } };
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  palco.append(renderer.domElement);

  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 2000);
  cena.add(new THREE.HemisphereLight(0xffffff, 0x8a8174, 1.6));
  const sol = new THREE.DirectionalLight(0xffffff, 1.6);
  sol.position.set(12, 22, 8);
  cena.add(sol);
  const contra = new THREE.DirectionalLight(0xffffff, 0.45);
  contra.position.set(-10, 8, -14);
  cena.add(contra);

  const grupo = new THREE.Group();
  cena.add(grupo);
  let malhas = [];          // { mesh, el }
  let limites = new THREE.Box3();
  let selecionado = null;

  /* ------------------------------------------------------------ cena */
  function cor(el, t) {
    const mod = modulos.obter(el.modulo);
    if (vista.cores === 'verificacao') {
      const st = estadoDoResultado(el);
      if (st.tipo === 'falha') return corDoTema('--acento', '#B85438');
      if (st.tipo === 'ok') return CORES.atende;
      return CORES.desatualizado;
    }
    if (vista.cores === 'tipo') return CORES[t];
    const mat = (mod?.material ?? '').toLowerCase();
    return mat.includes('madeira') ? CORES.madeira : mat.includes('aço') ? CORES.aco : CORES.concreto;
  }

  function construir() {
    for (const m of malhas) { m.mesh.geometry.dispose(); m.mesh.material.dispose(); m.linhas.geometry.dispose(); m.linhas.material.dispose(); }
    for (const l of linhasDef) { l.geometry.dispose(); l.material.dispose(); }
    linhasDef = [];
    for (const o of objetosVento) descartar(o);
    objetosVento = [];
    grupo.clear();
    malhas = [];
    limites = new THREE.Box3();
    const proj = estado.projeto;
    const pavs = pavimentosOrdenados(proj);
    const deslocamento = (pavId) => pavs.findIndex((x) => x.id === pavId) * vista.afastar;
    const corBorda = new THREE.Color(corDoTema('--tinta', '#161514'));

    /** Espessura (cm) das lajes que apoiam na viga — base da viga invertida; 10 cm sem laje ligada. */
    const espessuraApoiada = (viga) => {
      const ids = new Set((viga.cargas ?? []).filter((c) => c?.tipo === 'elemento').map((c) => c.elementoId));
      const hs = proj.elementos.filter((e) => ids.has(e.id) && tipoDe(e, modulos) === 'laje').map((e) => espessuraLaje(e));
      return hs.length ? Math.max(...hs) : 10;
    };
    for (const el of proj.elementos) {
      const pos = el.posicao;
      const pav = pos && pavimento(proj, pos.pavimento);
      const t = tipoDe(el, modulos);
      if (!pav || !t || vista.ocultos.has(pav.id)) continue;
      if (t === 'escada') { desenharEscada3D(el, pav); continue; }
      if (t === 'reservatorio') { desenharReservatorio3D(el, pav); continue; }
      const cota = pav.cota + deslocamento(pav.id);
      const ang = ((pos.angulo ?? 0) * Math.PI) / 180;
      let geo, centro;
      if (t === 'laje') {
        const { lx, ly } = dimensoesLaje(el);
        const e = espessuraLaje(el) / 100;
        geo = new THREE.BoxGeometry(lx, e, ly);
        const c = [lx / 2, ly / 2];
        centro = [pos.x + c[0] * Math.cos(ang) - c[1] * Math.sin(ang), pos.y + c[0] * Math.sin(ang) + c[1] * Math.cos(ang), cota - e / 2];
      } else if (t === 'viga') {
        const eixo = eixoViga(el);
        const { b, h: hv } = secaoViga(el);
        geo = new THREE.BoxGeometry(Math.max(eixo.L, 0.05), hv / 100, b / 100);
        // invertida: a face inferior fica na face inferior da laje (a viga sobe acima do piso)
        const hf = el.invertida ? espessuraApoiada(el) / 100 : 0;
        centro = [(eixo.a[0] + eixo.b[0]) / 2, (eixo.a[1] + eixo.b[1]) / 2, el.invertida ? cota - hf + hv / 200 : cota - hv / 200];
      } else {
        const { bx, by } = secaoPilar(el);
        const L = el.comprimento ?? 2.8;
        geo = new THREE.BoxGeometry(bx / 100, L, by / 100);
        centro = [pos.x, pos.y, cota - L / 2];
      }
      const transparente = (t === 'laje' && vista.lajesTransp) || vista.deformada;
      const mat = new THREE.MeshStandardMaterial({ color: cor(el, t), roughness: 0.92, metalness: 0, transparent: transparente, opacity: transparente ? (vista.deformada ? 0.18 : 0.35) : 1, depthWrite: !transparente });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(centro[0], centro[2], -centro[1]);
      mesh.rotation.y = ang;
      mesh.userData.id = el.id;
      const linhas = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: corBorda, transparent: true, opacity: 0.42 }));
      mesh.add(linhas);
      grupo.add(mesh);
      malhas.push({ mesh, el, linhas, cor: mat.color.clone() });
      limites.expandByObject(mesh);
    }

    /** Reservatório: fundo, quatro paredes e tampa, do fundo na cota do pavimento para cima. */
    function desenharReservatorio3D(el, pav) {
      const e = (Number(el.e) || 15) / 100, hf = (Number(el.hf) || 15) / 100, ht = el.tampa !== false ? (Number(el.ht) || 10) / 100 : 0;
      const a = Number(el.a) || 2, b = Number(el.b) || 3, H = Number(el.H) || 1.5;
      const Lx = a + e, Ly = b + e;
      const z0 = pav.cota + deslocamento(pav.id);
      const { x = 0, y = 0, angulo = 0 } = el.posicao;
      const ang = (angulo * Math.PI) / 180, cs = Math.cos(ang), sn = Math.sin(ang);
      const T = (u, v) => [x + u * cs - v * sn, y + u * sn + v * cs];
      const mat = new THREE.MeshStandardMaterial({ color: cor(el, 'laje'), roughness: 0.92, metalness: 0, transparent: vista.deformada, opacity: vista.deformada ? 0.18 : 1 });
      const peca = (dx, dz, dy, u, v, zc) => {
        const geo = new THREE.BoxGeometry(dx, dz, dy);
        const mesh = new THREE.Mesh(geo, mat.clone());
        const c = T(u, v);
        mesh.position.set(c[0], zc, -c[1]);
        mesh.rotation.y = ang;
        mesh.userData.id = el.id;
        const linhas = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: corBorda, transparent: true, opacity: 0.42 }));
        mesh.add(linhas);
        grupo.add(mesh);
        malhas.push({ mesh, el, linhas, cor: mesh.material.color.clone() });
        limites.expandByObject(mesh);
      };
      const W = Lx + e, D = Ly + e;
      peca(W, hf, D, Lx / 2, Ly / 2, z0 + hf / 2);                                   // fundo
      peca(W, H, e, Lx / 2, 0, z0 + hf + H / 2); peca(W, H, e, Lx / 2, Ly, z0 + hf + H / 2); // paredes A
      peca(e, H, Ly - e, 0, Ly / 2, z0 + hf + H / 2); peca(e, H, Ly - e, Lx, Ly / 2, z0 + hf + H / 2); // paredes B
      if (ht) peca(W, ht, D, Lx / 2, Ly / 2, z0 + hf + H + ht / 2);                  // tampa
    }

    /** Escada: um bloco por degrau, patamares como lajes, do nível de baixo ao de chegada. */
    function desenharEscada3D(el, pav) {
      const pl = escadaNaPlanta(el, proj);
      if (!pl) return;
      const g = pl.geometria, e = g.dg.e / 100, p = g.dg.p / 100, hl = (Number(el.h) || 12) / 100;
      const z0 = pl.cotaBase + deslocamento(pav.id) - (pavs.findIndex((x) => x.id === pav.id) > 0 ? vista.afastar : 0);
      const transparente = vista.deformada;
      const mat = new THREE.MeshStandardMaterial({ color: cor(el, 'laje'), roughness: 0.92, metalness: 0, transparent: transparente, opacity: transparente ? 0.18 : 1, depthWrite: !transparente });
      const bloco = (r, zTopo, alt) => {
        const geo = new THREE.BoxGeometry(Math.max(r.x1 - r.x0, 0.01), Math.max(alt, 0.01), Math.max(r.y1 - r.y0, 0.01));
        const mesh = new THREE.Mesh(geo, mat.clone());
        const c = pl.T([(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2]);
        mesh.position.set(c[0], zTopo - alt / 2, -c[1]);
        mesh.rotation.y = (pl.angulo * Math.PI) / 180;
        mesh.userData.id = el.id;
        const linhas = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: corBorda, transparent: true, opacity: 0.42 }));
        mesh.add(linhas);
        grupo.add(mesh);
        malhas.push({ mesh, el, linhas, cor: mesh.material.color.clone() });
        limites.expandByObject(mesh);
      };
      let z = z0;
      const patamar = (nivel) => g.geo.patamares.find((x) => x.nivel === nivel);
      const pi = patamar('inferior');
      if (pi) bloco(pi, z, hl);
      g.geo.lances.forEach((l, i) => {
        const n = l.espelhos - 1;
        for (let k = 1; k <= n; k++) {
          const zt = z + k * e;
          let r;
          if (l.sentido[1] > 0) r = { x0: l.x0, x1: l.x1, y0: l.y0 + (k - 1) * p, y1: l.y0 + k * p };
          else if (l.sentido[1] < 0) r = { x0: l.x0, x1: l.x1, y0: l.y1 - k * p, y1: l.y1 - (k - 1) * p };
          else r = { y0: l.y0, y1: l.y1, x0: l.x0 + (k - 1) * p, x1: l.x0 + k * p };
          bloco(r, zt, e + hl);
        }
        z += l.espelhos * e;
        if (i === 0 && g.geo.lances.length > 1) { const pm = patamar('intermediario'); if (pm) bloco(pm, z, hl); }
      });
      const ps = patamar('superior');
      if (ps) bloco(ps, z, hl);
    }

    // sapatas sob os pilares ligados (topo na base do pilar)
    for (const sp of proj.elementos.filter((e) => e.modulo === 'concreto.sapata' && e.pilarId)) {
      const pl = proj.elementos.find((e) => e.id === sp.pilarId);
      const pav = pl?.posicao && pavimento(proj, pl.posicao.pavimento);
      if (!pav || vista.ocultos.has(pav.id)) continue;
      const r = sp.resultado && !sp.resultado.erro ? sp.resultado : null;
      const A = (r?.A ?? sp.geometria?.A ?? 150) / 100, B = (r?.B ?? sp.geometria?.B ?? 150) / 100, hs = (r?.h ?? sp.geometria?.h ?? 50) / 100;
      const topo = pav.cota + deslocamento(pav.id) - (pl.comprimento ?? 2.8);
      const geo = new THREE.BoxGeometry(A, hs, B);
      const transparente = vista.deformada;
      const mat = new THREE.MeshStandardMaterial({ color: cor(sp, 'sapata'), roughness: 0.92, metalness: 0, transparent: transparente, opacity: transparente ? 0.18 : 1, depthWrite: !transparente });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pl.posicao.x, topo - hs / 2, -pl.posicao.y);
      mesh.rotation.y = ((pl.posicao.angulo ?? 0) * Math.PI) / 180;
      mesh.userData.id = sp.id;
      const linhas = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: corBorda, transparent: true, opacity: 0.42 }));
      mesh.add(linhas);
      grupo.add(mesh);
      malhas.push({ mesh, el: sp, linhas, cor: mat.color.clone() });
      limites.expandByObject(mesh);
    }

    // blocos sobre estacas: o bloco sob o pilar e as estacas do arranjo calculado
    for (const b of proj.elementos.filter((e) => e.modulo === 'concreto.bloco' && e.pilarId)) {
      const pl = proj.elementos.find((e) => e.id === b.pilarId);
      const pav = pl?.posicao && pavimento(proj, pl.posicao.pavimento);
      if (!pav || vista.ocultos.has(pav.id)) continue;
      const r = b.resultado && !b.resultado.erro ? b.resultado : null;
      const A = (r?.A ?? b.geometria?.A ?? 160) / 100, B = (r?.B ?? b.geometria?.B ?? 70) / 100, hb = (r?.h ?? b.geometria?.h ?? 60) / 100;
      const topo = pav.cota + deslocamento(pav.id) - (pl.comprimento ?? 2.8);
      const ang = ((pl.posicao.angulo ?? 0) * Math.PI) / 180;
      const transparente = vista.deformada;
      const peca = (geo, cx, cy, z, chave, segs) => {
        const mat = new THREE.MeshStandardMaterial({ color: cor(b, chave), roughness: 0.92, metalness: 0, transparent: transparente, opacity: transparente ? 0.18 : 1, depthWrite: !transparente });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(cx, z, -cy);
        mesh.rotation.y = ang;
        mesh.userData.id = b.id;
        const linhas = new THREE.LineSegments(new THREE.EdgesGeometry(geo, segs), new THREE.LineBasicMaterial({ color: corBorda, transparent: true, opacity: 0.42 }));
        mesh.add(linhas);
        grupo.add(mesh);
        malhas.push({ mesh, el: b, linhas, cor: mat.color.clone() });
        limites.expandByObject(mesh);
      };
      peca(new THREE.BoxGeometry(A, hb, B), pl.posicao.x, pl.posicao.y, topo - hb / 2, 'sapata');
      const L = b.estaca?.L ?? 8, rr = (r?.estaca?.D ?? b.estaca?.D ?? 30) / 200;
      for (const p of r?.pos ?? []) {
        const u = p.x / 100, v = p.y / 100;
        const x = pl.posicao.x + u * Math.cos(ang) - v * Math.sin(ang), y = pl.posicao.y + u * Math.sin(ang) + v * Math.cos(ang);
        peca(new THREE.CylinderGeometry(rr, rr, L, 18), x, y, topo - hb + 0.1 - L / 2, 'estaca', 40);
      }
    }

    // estacas: do topo (arrasamento, abaixo do terreno) até a ponta
    for (const ea of proj.elementos.filter((e) => e.modulo === 'geotecnia.estaca')) {
      const pl = ea.pilarId ? proj.elementos.find((e) => e.id === ea.pilarId) : null;
      const pav = pl?.posicao ? pavimento(proj, pl.posicao.pavimento) : null;
      if (pav && vista.ocultos.has(pav.id)) continue;
      const c = pl?.posicao ? [pl.posicao.x, pl.posicao.y] : [ea.local?.x ?? 0, ea.local?.y ?? 0];
      const L = ea.L ?? 8, rr = (ea.D ?? 40) / 200, topo = -(ea.topo ?? 1.5);
      const geo = new THREE.CylinderGeometry(rr, rr, L, 18);
      const mat = new THREE.MeshStandardMaterial({ color: cor(ea, 'estaca'), roughness: 0.92, metalness: 0, transparent: vista.deformada, opacity: vista.deformada ? 0.18 : 1 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(c[0], topo - L / 2, -c[1]);
      mesh.userData.id = ea.id;
      const linhas = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 40), new THREE.LineBasicMaterial({ color: corBorda, transparent: true, opacity: 0.42 }));
      mesh.add(linhas);
      grupo.add(mesh);
      malhas.push({ mesh, el: ea, linhas, cor: mat.color.clone() });
      limites.expandByObject(mesh);
    }

    if (vista.deformada) desenharDeformada();
    if (vista.vento) desenharVento(deslocamento);

    // chão: grade sob o nível mais baixo dos pilares
    if (!limites.isEmpty()) {
      const tam = limites.getSize(new THREE.Vector3());
      const lado = Math.ceil(Math.max(tam.x, tam.z, 6) / 2) * 2 + 8;
      const grade = new THREE.GridHelper(lado, lado, new THREE.Color(corDoTema('--filete', '#cbc4b7')), new THREE.Color(corDoTema('--filete', '#cbc4b7')));
      const c = limites.getCenter(new THREE.Vector3());
      grade.position.set(Math.round(c.x), limites.min.y - 0.001, Math.round(c.z));
      grade.material.transparent = true; grade.material.opacity = 0.7;
      grupo.add(grade);
    }
    if (selecionado && !malhas.some((m) => m.el.id === selecionado)) selecionado = null;
    destacar();
    desenharPainel();
  }

  /* ------------------------------------------------------------ deformada do pórtico espacial */
  let infoDef = null;
  let linhasDef = [];
  function desenharDeformada() {
    infoDef = null;
    const proj = estado.projeto;
    const g = porticoDoEdificio(proj, modulos);
    if (g.erro) { infoDef = { erro: g.erro, pavimentos: g.pavimentos ?? [] }; return; }
    const res = g.resultado;
    if (vista.casoDef !== 'GQ' && !res.porCaso[vista.casoDef]) vista.casoDef = 'GQ'; // caso de vento com o vento desligado
    const r = vista.casoDef === 'GQ' ? res.combinar({ G: 1, Q: 1 }, 'G + Q') : res.porCaso[vista.casoDef];
    const curvas = r.barras.map((b) => ({ id: b.id, pts: deformadaBarra(b._rb, 10) }));
    let umax = 0, onde = null;
    for (const d of r.deslocamentos) { const u = Math.hypot(d.u[0], d.u[1], d.u[2]); if (u > umax) { umax = u; onde = d.id; } }
    const tam = limites.isEmpty() ? 10 : limites.getSize(new THREE.Vector3()).length();
    const escala = umax > 1e-12 ? ((0.06 * tam) / umax) * vista.fatorDef : 1;
    const acento = new THREE.Color(corDoTema('--acento', '#B85438'));
    const cinza = new THREE.Color(corDoTema('--tinta-2', '#4A453F'));
    for (const c of curvas) {
      if (!c.pts.length) continue;
      const pilar = c.pts[0].p[2] !== c.pts[c.pts.length - 1].p[2];
      const pos = c.pts.map((q) => new THREE.Vector3(q.p[0] + escala * q.u[0], q.p[2] + escala * q.u[2], -(q.p[1] + escala * q.u[1])));
      const linha = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pos), new THREE.LineBasicMaterial({ color: pilar ? cinza : acento }));
      grupo.add(linha);
      linhasDef.push(linha);
      // eixo indeformado, tracejado leve
      const orig = c.pts.map((q) => new THREE.Vector3(q.p[0], q.p[2], -q.p[1]));
      const base = new THREE.Line(new THREE.BufferGeometry().setFromPoints([orig[0], orig[orig.length - 1]]), new THREE.LineDashedMaterial({ color: cinza, dashSize: 0.15, gapSize: 0.1, transparent: true, opacity: 0.5 }));
      base.computeLineDistances();
      grupo.add(base);
      linhasDef.push(base);
    }
    infoDef = { umax, onde, escala, caso: r.caso ?? vista.casoDef, pavimentos: g.pavimentos, totais: g.totais, resumo: res.resumo, horizontais: !!g.horizontais?.casos };
  }

  /* ------------------------------------------------------------ forças de vento (NBR 6123) */
  let infoVento = null;
  let objetosVento = [];
  function descartar(o) {
    o.traverse?.((x) => { x.geometry?.dispose(); if (x.material) { x.material.map?.dispose(); x.material.dispose(); } });
  }
  /** Rótulo de texto sempre de frente para a câmera. */
  function rotulo3D(texto, corTxt) {
    const tela = document.createElement('canvas');
    const ctx2 = tela.getContext('2d');
    const fonte = 'bold 44px system-ui, sans-serif';
    ctx2.font = fonte;
    tela.width = Math.ceil(ctx2.measureText(texto).width * 1.08) + 32; tela.height = 64;
    ctx2.font = fonte;
    ctx2.fillStyle = corDoTema('--papel', '#F4F1EC');
    ctx2.globalAlpha = 0.88;
    ctx2.beginPath(); ctx2.roundRect?.(2, 4, tela.width - 4, tela.height - 8, 12); ctx2.fill();
    ctx2.globalAlpha = 1;
    ctx2.fillStyle = corTxt; ctx2.textBaseline = 'middle';
    ctx2.fillText(texto, 12, 34);
    const tex = new THREE.CanvasTexture(tela);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false }));
    const alt = 0.42;
    sp.scale.set((alt * tela.width) / tela.height, alt, 1);
    sp.renderOrder = 10;
    return sp;
  }
  /** Seta sólida (haste + ponta), visível através dos elementos. */
  function seta3D(origem, dir, L, corSeta) {
    const g = new THREE.Group();
    const mat = () => new THREE.MeshBasicMaterial({ color: corSeta, depthTest: false, transparent: true, opacity: 0.95 });
    const cab = Math.min(0.5, 0.35 * L);
    const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, L - cab, 10), mat());
    haste.position.y = (L - cab) / 2;
    const ponta = new THREE.Mesh(new THREE.ConeGeometry(0.16, cab, 14), mat());
    ponta.position.y = L - cab / 2;
    g.add(haste, ponta);
    g.position.copy(origem);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    g.traverse((x) => { x.renderOrder = 9; });
    return g;
  }
  /** Forças horizontais por nível: as do pórtico (vento e/ou desaprumo) ou, sem elas, o vento estimado. */
  function acoesNo3D(proj) {
    const g = porticoDoEdificio(proj, modulos);
    const hz = !g.erro && g.horizontais?.casos ? g.horizontais : null;
    const w = ventoDoProjeto(proj, modulos);
    if (hz) {
      const planta = w.planta ?? plantaDoEdificio(proj, modulos);
      const pavimentos = hz.forcas.map((f) => ({ id: f.id, nome: f.nome, z: hz.zBase + f.h, Fx: f.Fx, Fy: f.Fy }));
      const tot = (k) => pavimentos.reduce((a, f) => a + f[k], 0);
      return { noPortico: true, planta, Lx: planta.Lx, Ly: planta.Ly, pavimentos, totais: { Fx: tot('Fx'), Fy: tot('Fy') }, acao: { x: hz.direcoes.x.acao, y: hz.direcoes.y.acao }, vento: w.erro ? null : w };
    }
    if (w.erro) return w;
    return { noPortico: false, planta: w.planta, Lx: w.Lx, Ly: w.Ly, pavimentos: w.pavimentos, totais: w.totais, acao: { x: 'vento', y: 'vento' }, vento: w };
  }
  function desenharVento(deslocamento) {
    const proj = estado.projeto;
    const v = acoesNo3D(proj);
    infoVento = v;
    if (v.erro) return;
    const cv = CASOS_VENTO.find((c) => c.id === vista.casoVento) ?? CASOS_VENTO[0];
    const r = (cv.angulo * Math.PI) / 180;
    const d = [Math.round(Math.cos(r)), Math.round(Math.sin(r))];
    const { x0, x1, y0, y1, centro } = v.planta;
    const F = (pv) => Math.abs(d[0] ? pv.Fx : pv.Fy);
    const Fmax = Math.max(...v.pavimentos.map(F), 1e-9);
    const Lmax = Math.max(2, 0.35 * Math.max(v.Lx, v.Ly));
    const acento = corDoTema('--acento', '#B85438');
    const corSeta = new THREE.Color(acento);
    // ponto de chegada: meio da face a barlavento
    const face = d[0] > 0 ? [x0, centro[1]] : d[0] < 0 ? [x1, centro[1]] : d[1] > 0 ? [centro[0], y0] : [centro[0], y1];
    for (const pv of v.pavimentos) {
      if (vista.ocultos.has(pv.id)) continue;
      const z = pv.z + deslocamento(pv.id);
      const L = Math.max(0.6, (Lmax * F(pv)) / Fmax);
      const ponta = new THREE.Vector3(face[0] - 0.15 * d[0], z, -(face[1] - 0.15 * d[1]));
      const dir = new THREE.Vector3(d[0], 0, -d[1]);
      const origem = ponta.clone().addScaledVector(dir, -L);
      const seta = seta3D(origem, dir, L, corSeta);
      grupo.add(seta);
      objetosVento.push(seta);
      const rot = rotulo3D(`${num(F(pv), 1)} kN`, acento);
      rot.position.copy(origem).add(new THREE.Vector3(0, 0.28, 0));
      grupo.add(rot);
      objetosVento.push(rot);
    }
  }

  /* ------------------------------------------------------------ câmera (órbita própria) */
  function enquadrar() {
    if (limites.isEmpty()) { vista.alvo = [0, 1.5, 0]; vista.raio = 16; return; }
    const c = limites.getCenter(new THREE.Vector3());
    const r = limites.getSize(new THREE.Vector3()).length() / 2;
    vista.alvo = [c.x, c.y, c.z];
    vista.raio = Math.max(4, (r / Math.sin((camera.fov * Math.PI) / 360)) * 1.05);
  }
  function posicionarCamera() {
    const [ax, ay, az] = vista.alvo;
    const { raio: r, teta, fi } = vista;
    camera.position.set(ax + r * Math.sin(fi) * Math.sin(teta), ay + r * Math.cos(fi), az + r * Math.sin(fi) * Math.cos(teta));
    camera.lookAt(ax, ay, az);
  }

  let pendente = false;
  function desenhar() {
    if (pendente) return;
    pendente = true;
    requestAnimationFrame(() => {
      pendente = false;
      const w = palco.clientWidth, hh = palco.clientHeight;
      if (!w || !hh) return;
      renderer.setSize(w, hh, false);
      camera.aspect = w / hh;
      camera.updateProjectionMatrix();
      cena.background = new THREE.Color(corDoTema('--papel', '#F4F1EC'));
      posicionarCamera();
      renderer.render(cena, camera);
    });
  }

  /* ------------------------------------------------------------ seleção */
  const raio = new THREE.Raycaster();
  function pegar(e) {
    const r = renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raio.setFromCamera(v, camera);
    const hit = raio.intersectObjects(malhas.map((m) => m.mesh), false)[0];
    return hit ? malhas.find((m) => m.mesh === hit.object) : null;
  }
  function destacar() {
    const acento = new THREE.Color(corDoTema('--acento', '#B85438'));
    for (const m of malhas) {
      const sel = m.el.id === selecionado;
      m.mesh.material.emissive = sel ? acento.clone().multiplyScalar(0.55) : new THREE.Color(0x000000);
      m.linhas.material.opacity = sel ? 1 : 0.42;
    }
    desenharCartao();
    desenhar();
  }
  function desenharCartao() {
    limpar(cartao);
    const el = selecionado && estado.elemento(selecionado);
    cartao.classList.toggle('visivel', !!el);
    if (!el) return;
    const mod = modulos.obter(el.modulo);
    const st = estadoDoResultado(el);
    const pav = pavimento(estado.projeto, el.posicao?.pavimento);
    cartao.append(
      h('div', { class: 'v3d-cartao-cab' }, icone(mod?.forma ?? mod?.icone ?? 'documento', { tamanho: 16 }), h('strong', null, el.codigo), h('span', null, el.nome !== el.codigo ? el.nome : ''),
        h('button', { class: 'botao-icone', title: 'Fechar', onClick: () => { selecionado = null; destacar(); } }, icone('fechar', { tamanho: 13 }))),
      h('div', { class: 'v3d-cartao-linha' }, `${mod?.nome ?? el.modulo} · ${pav?.nome ?? ''}`),
      h('div', { class: ['v3d-estado', st.classe] }, st.texto),
      h('div', { class: 'v3d-cartao-acoes' },
        ui.botao({ texto: 'Abrir elemento', icone: 'direita', tipo: 'primario', aoClicar: () => acoes.abrirElemento(el.id) }),
        ui.botao({ texto: 'Na montagem', icone: 'planta', tipo: 'fantasma', aoClicar: () => acoes.abrirMontagem(el.id) })),
    );
  }

  /* ------------------------------------------------------------ painel de opções */
  function desenharPainel() {
    limpar(painel);
    const proj = estado.projeto;
    const semPos = proj.elementos.filter((e) => tipoDe(e, modulos) && !(e.posicao && pavimento(proj, e.posicao.pavimento))).length;
    painel.append(...[
      h('div', { class: 'v3d-painel-cab' },
        h('span', null, 'Controles'),
        h('button', { class: 'botao-icone v3d-ocultar', title: 'Ocultar o painel de controles', 'aria-label': 'Ocultar o painel de controles', onClick: () => alternarPainel(false) }, icone('esquerda', { tamanho: 15 }))),
      h('div', { class: 'v3d-grupo' },
        h('span', { class: 'v3d-rot' }, 'Pavimentos'),
        ...[...pavimentosOrdenados(proj)].reverse().map((pv) => h('label', { class: 'v3d-check' },
          h('input', { type: 'checkbox', checked: !vista.ocultos.has(pv.id), onChange: (e) => { if (e.target.checked) vista.ocultos.delete(pv.id); else vista.ocultos.add(pv.id); construir(); } }),
          h('span', null, pv.nome), h('em', null, `${num(pv.cota, 2)} m`)))),
      h('div', { class: 'v3d-grupo' },
        h('span', { class: 'v3d-rot' }, 'Cores'),
        ui.segmentado({ valor: vista.cores, compacto: true, opcoes: [{ valor: 'verificacao', texto: 'Verificação' }, { valor: 'material', texto: 'Material' }, { valor: 'tipo', texto: 'Tipo' }], aoMudar: (v) => { vista.cores = v; construir(); } }),
        vista.cores === 'verificacao' ? h('div', { class: 'v3d-legenda' },
          h('span', null, h('i', { style: { background: CORES.atende } }), 'Atende'),
          h('span', null, h('i', { style: { background: corDoTema('--acento', '#B85438') } }), 'Não atende'),
          h('span', null, h('i', { style: { background: CORES.desatualizado } }), 'Não calculado')) : null),
      h('div', { class: 'v3d-grupo' },
        ui.alternar({ rotulo: 'Lajes transparentes', valor: vista.lajesTransp, aoMudar: (v) => { vista.lajesTransp = v; construir(); } }),
        ui.alternar({ rotulo: 'Afastar pavimentos', valor: vista.afastar > 0, aoMudar: (v) => { vista.afastar = v ? 1.5 : 0; construir(); enquadrar(); desenhar(); } })),
      h('div', { class: 'v3d-grupo' },
        h('span', { class: 'v3d-rot' }, 'Pórtico espacial'),
        ui.alternar({ rotulo: 'Deformada', valor: vista.deformada, aoMudar: (v) => { vista.deformada = v; if (v) vista.afastar = 0; construir(); } }),
        vista.deformada ? ui.segmentado({ valor: vista.casoDef, compacto: true, opcoes: [{ valor: 'G', texto: 'G' }, { valor: 'Q', texto: 'Q' }, { valor: 'GQ', texto: 'G + Q' }], aoMudar: (v) => { vista.casoDef = v; construir(); } }) : null,
        vista.deformada && infoDef?.horizontais ? ui.segmentado({ valor: vista.casoDef, compacto: true, opcoes: CASOS_VENTO.map((c) => ({ valor: c.id, texto: c.id })), aoMudar: (v) => { vista.casoDef = v; vista.casoVento = v; construir(); } }) : null,
        vista.deformada ? ui.segmentado({ valor: vista.fatorDef, compacto: true, opcoes: [{ valor: 0.5, texto: '½×' }, { valor: 1, texto: '1×' }, { valor: 2, texto: '2×' }, { valor: 4, texto: '4×' }], aoMudar: (v) => { vista.fatorDef = Number(v); construir(); } }) : null,
        vista.deformada && infoDef ? blocoDeformada() : null),
      h('div', { class: 'v3d-grupo' },
        h('span', { class: 'v3d-rot' }, 'Ações horizontais'),
        ui.alternar({ rotulo: 'Vento e desaprumo', valor: vista.vento, aoMudar: (v) => { vista.vento = v; construir(); } }),
        vista.vento ? ui.segmentado({ valor: vista.casoVento, compacto: true, opcoes: CASOS_VENTO.map((c) => ({ valor: c.id, texto: `${c.angulo}°` })), aoMudar: (v) => { vista.casoVento = v; if (/^V/.test(vista.casoDef)) vista.casoDef = v; construir(); } }) : null,
        vista.vento ? blocoVento() : null),
      h('div', { class: 'v3d-grupo v3d-vistas' },
        h('span', { class: 'v3d-rot' }, 'Vista'),
        h('div', { class: 'v3d-botoes' },
          ui.botao({ texto: 'Perspectiva', tipo: 'fantasma', aoClicar: () => girarPara(-0.9, 0.95) }),
          ui.botao({ texto: 'Frente', tipo: 'fantasma', aoClicar: () => girarPara(0, Math.PI / 2 - 0.001) }),
          ui.botao({ texto: 'Lateral', tipo: 'fantasma', aoClicar: () => girarPara(Math.PI / 2, Math.PI / 2 - 0.001) }),
          ui.botao({ texto: 'Topo', tipo: 'fantasma', aoClicar: () => girarPara(0, 0.0001) }),
          ui.botaoIcone({ icone: 'busca', titulo: 'Enquadrar', aoClicar: () => { enquadrar(); desenhar(); } }))),
      acoes.fixar3D ? h('div', { class: 'v3d-grupo' },
        ui.alternar({ rotulo: 'Fixar à direita', dica: 'Mantém a visualização 3D num painel à direita, ao lado dos elementos que você abrir', valor: !!acoes.fixado3D?.(), aoMudar: (v) => acoes.fixar3D(v) })) : null,
      semPos ? h('p', { class: 'v3d-aviso' }, `${semPos} elemento(s) sem posição não aparecem — `, h('button', { class: 'link', onClick: () => acoes.abrirMontagem() }, 'posicionar na montagem')) : null,
    ].filter(Boolean));
    dica.textContent = malhas.length
      ? 'Arraste para girar · botão direito ou Shift + arrastar para deslocar · roda para aproximar · clique seleciona, duplo clique abre'
      : 'Nenhum elemento posicionado ainda. Use a Montagem da estrutura para colocar lajes, vigas e pilares nos pavimentos.';
  }
  function blocoDeformada() {
    if (infoDef.erro) return h('p', { class: 'v3d-aviso' }, `Pórtico indisponível: ${infoDef.erro}`);
    const t = infoDef.totais;
    const ok = Math.abs(t.somaPavG - t.reacoesG) <= 0.01 * Math.max(1, t.somaPavG) && Math.abs(t.somaPavQ - t.reacoesQ) <= 0.01 * Math.max(1, t.somaPavQ);
    return h('div', { class: 'v3d-def' },
      h('p', { class: 'v3d-def-info' }, `Deslocamento máximo ${num(infoDef.umax * 1000, 2)} mm (${(() => { const [pv, no] = (infoDef.onde ?? '').split('/'); return `${pavimento(estado.projeto, pv)?.nome ?? pv} · ${no ?? ''}`; })()}) · desenho ampliado ${num(infoDef.escala, 0)}×`),
      h('table', { class: 'v3d-cargas' },
        h('thead', null, h('tr', null, h('th', null, 'Cargas verticais'), h('th', null, 'G (kN)'), h('th', null, 'Q (kN)'))),
        h('tbody', null,
          ...[...infoDef.pavimentos].reverse().map((pv) => h('tr', null, h('td', null, pv.nome), h('td', null, num(pv.G, 1)), h('td', null, num(pv.Q, 1)))),
          h('tr', { class: 'soma' }, h('td', null, 'Soma'), h('td', null, num(t.somaPavG, 1)), h('td', null, num(t.somaPavQ, 1))),
          h('tr', { class: ['soma', ok ? 'ok' : 'falha'] }, h('td', null, ok ? 'Fundação ✓' : 'Fundação ≠'), h('td', null, num(t.reacoesG, 1)), h('td', null, num(t.reacoesQ, 1))))),
    );
  }
  function blocoVento() {
    const v = infoVento;
    if (!v) return null;
    if (v.erro) return h('p', { class: 'v3d-aviso' }, `Ações horizontais: ${v.erro}`);
    const cv = CASOS_VENTO.find((c) => c.id === vista.casoVento) ?? CASOS_VENTO[0];
    const eixoX = cv.angulo % 180 === 0;
    const acao = v.acao[eixoX ? 'x' : 'y'];
    const w = v.vento;
    const info = [`${cv.id} — ${ROTULO_ACAO[acao] ?? 'Vento'} ${cv.angulo}°`];
    if (w && acao !== 'desaprumo') info.push(`V0 = ${num(w.V0, 1)} m/s · Cat. ${w.categoria} · Ca = ${num(eixoX ? w.direcoes.x.Ca : w.direcoes.y.Ca, 2)}`);
    if (!v.noPortico) info.push('vento desligado no pórtico');
    return h('div', { class: 'v3d-def' },
      h('p', { class: 'v3d-def-info' }, info.join(' · ')),
      h('table', { class: 'v3d-cargas' },
        h('thead', null, h('tr', null, h('th', null, 'Nível'), h('th', null, 'F (kN)'))),
        h('tbody', null,
          ...[...v.pavimentos].reverse().map((pv) => h('tr', null, h('td', null, pv.nome), h('td', null, num(eixoX ? pv.Fx : pv.Fy, 1)))),
          h('tr', { class: 'soma' }, h('td', null, 'Cortante na base'), h('td', null, num(eixoX ? v.totais.Fx : v.totais.Fy, 1))))),
      h('div', { style: { display: 'flex', gap: '16px' } },
        h('button', { class: 'link', onClick: () => acoes.abrirVento?.() }, 'Vento'),
        h('button', { class: 'link', onClick: () => acoes.abrirEstabilidade?.() }, 'Estabilidade global')),
    );
  }
  function girarPara(teta, fi) { vista.teta = teta; vista.fi = fi; desenhar(); }

  /* ------------------------------------------------------------ mouse */
  const tela = renderer.domElement;
  let arrasto = null;
  tela.addEventListener('contextmenu', (e) => e.preventDefault());
  tela.addEventListener('pointerdown', (e) => {
    tela.setPointerCapture(e.pointerId);
    arrasto = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, pan: e.button === 2 || e.shiftKey || e.button === 1 };
  });
  tela.addEventListener('pointermove', (e) => {
    if (!arrasto) {
      const m = pegar(e);
      tela.style.cursor = m ? 'pointer' : 'grab';
      tela.title = m ? `${m.el.codigo} · ${m.el.nome}` : '';
      return;
    }
    const dx = e.clientX - arrasto.x, dy = e.clientY - arrasto.y;
    arrasto.x = e.clientX; arrasto.y = e.clientY;
    if (arrasto.pan) {
      const k = (vista.raio * 1.2) / palco.clientHeight;
      const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
      const dirX = new THREE.Vector3().crossVectors(dir, camera.up).normalize();
      const dirY = new THREE.Vector3().crossVectors(dirX, dir).normalize();
      const [ax, ay, az] = vista.alvo;
      const novo = new THREE.Vector3(ax, ay, az).addScaledVector(dirX, -dx * k).addScaledVector(dirY, dy * k);
      vista.alvo = [novo.x, novo.y, novo.z];
    } else {
      vista.teta -= dx * 0.008;
      vista.fi = Math.max(0.0001, Math.min(Math.PI / 2 - 0.0001 + 0.6, vista.fi - dy * 0.008));
    }
    desenhar();
  });
  tela.addEventListener('pointerup', (e) => {
    const a = arrasto;
    arrasto = null;
    if (a && Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < 4 && e.button === 0) {
      const m = pegar(e);
      selecionado = m?.el.id ?? null;
      destacar();
    }
  });
  tela.addEventListener('dblclick', (e) => { const m = pegar(e); if (m) acoes.abrirElemento(m.el.id); });
  tela.addEventListener('wheel', (e) => {
    e.preventDefault();
    vista.raio = Math.max(1.5, Math.min(800, vista.raio * Math.exp(e.deltaY * 0.0012)));
    desenhar();
  }, { passive: false });

  construir();
  if (!vista.alvo) enquadrar();
  const obs = new ResizeObserver(() => desenhar());
  obs.observe(palco);
  // troca de tema claro/escuro: refaz as cores
  const obsTema = new MutationObserver(() => construir());
  obsTema.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] });
  desenhar();

  return {
    destruir() {
      if (alternarAtual) alternarAtual = null;
      obs.disconnect();
      obsTema.disconnect();
      for (const m of malhas) { m.mesh.geometry.dispose(); m.mesh.material.dispose(); m.linhas.geometry.dispose(); m.linhas.material.dispose(); }
      renderer.dispose();
      container.classList.remove('editor-cheio');
    },
    aoAlterar(info) {
      if (info.historico || info.estrutural || info.elementoId || info.calculo) { construir(); return true; }
      construir();
      return true;
    },
    /** Imagem PNG da vista atual (para relatórios). */
    imagem: () => renderer.domElement.toDataURL('image/png'),
  };
}
