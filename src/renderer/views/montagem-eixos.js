/*
 * LEBR — Laboratório de Estruturas Brasil
 * Copyright (C) 2026 Daniel Michelon De Carli
 *
 * Feito com uso da inteligência artificial Claude Opus 5.5, sob a orientação de Daniel Michelon De Carli.
 *
 * Este programa é software livre: você pode redistribuí-lo e/ou modificá-lo nos termos da GNU Affero General
 * Public License, versão 3, publicada pela Free Software Foundation. É distribuído na esperança de ser útil, mas
 * SEM NENHUMA GARANTIA, nem mesmo a garantia implícita de COMERCIALIZAÇÃO ou de ADEQUAÇÃO A UMA FINALIDADE
 * ESPECÍFICA. Veja o arquivo LICENSE ou <https://www.gnu.org/licenses/agpl-3.0.html>.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * Eixos na montagem (0.65): desenho na planta (eixos com o balão do nome, nós nos cruzamentos e cotas entre eixos
 * paralelos), o bloco "Eixos" da lateral (famílias de paralelos com as distâncias) e o cartão do eixo selecionado.
 * A geometria e a edição ficam em core/eixos.js.
 */
import { h, s } from '../ui/dom.js';
import * as ui from '../ui/componentes.js';
import { num } from '../core/formatar.js';
import { listaEixos, familiasDeEixos, nosDosEixos, cotasDosEixos, distanciaAoEixo } from '../core/eixos.js';

const PREF_ACOMPANHAR = 'lebr.montagem.eixosLevamElementos';
/** Mover um eixo leva junto os elementos que estão sobre ele (padrão: sim). */
export const eixosLevamElementos = () => { try { return localStorage.getItem(PREF_ACOMPANHAR) !== 'nao'; } catch { return true; } };
const definirAcompanhar = (v) => { try { localStorage.setItem(PREF_ACOMPANHAR, v ? 'sim' : 'nao'); } catch { /* sem armazenamento */ } };

const PREF_VISIVEIS = 'lebr.montagem.eixosVisiveis';
/** Eixos, cotas e nós à vista na planta (padrão: sim). Ocultos, também deixam de atrair os elementos. */
export const eixosVisiveis = () => { try { return localStorage.getItem(PREF_VISIVEIS) !== 'nao'; } catch { return true; } };
export const definirEixosVisiveis = (v) => { try { localStorage.setItem(PREF_VISIVEIS, v ? 'sim' : 'nao'); } catch { /* sem armazenamento */ } };

/** Deslocamento perpendicular de um eixo por uma seta do teclado: o sinal da seta projetada na normal do eixo. */
export function passoDaSeta(eixo, sx, sy, passo) {
  const p = sx * eixo.n[0] + sy * eixo.n[1];
  return Math.abs(p) < 0.2 ? 0 : Math.sign(p) * passo;
}

/** Distância da duplicação: uns 20 px na escala atual, arredondada ao centímetro (mínimo 1 cm). */
export const distanciaDuplicar = (esc) => Math.max(0.01, Math.round((20 / Math.max(esc, 1e-6)) * 100) / 100);

/** Recorte de uma reta (ponto e direção, em px) no retângulo da tela: [p0, p1] ou null. */
function recortar(p, u, W, H) {
  let t0 = -Infinity, t1 = Infinity;
  for (const [pi, ui_, min, max] of [[p[0], u[0], 0, W], [p[1], u[1], 0, H]]) {
    if (Math.abs(ui_) < 1e-12) { if (pi < min || pi > max) return null; continue; }
    let a = (min - pi) / ui_, b = (max - pi) / ui_;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
  }
  if (t0 > t1) return null;
  return [[p[0] + u[0] * t0, p[1] + u[1] * t0], [p[0] + u[0] * t1, p[1] + u[1] * t1]];
}

/**
 * Camada SVG dos eixos.
 * @param {object} op  { tela, W, H, sel: id do eixo selecionado, previa: {id, d} (eixo sendo arrastado), cotaPrevia }
 */
export function camadaEixos(projeto, { tela, W, H, sel = null, previa = null, cotaPrevia = null }) {
  let l = listaEixos(projeto);
  if (!l.length) return null;
  if (previa) l = l.map((e) => (e.id === previa.id ? { ...e, p: [e.p[0] + e.n[0] * (previa.d - e.d), e.p[1] + e.n[1] * (previa.d - e.d)], d: previa.d } : e));
  const g = s('g', { class: 'mont-eixos' });
  const R = 11;
  for (const e of l) {
    const a = tela(e.p), b = tela([e.p[0] + e.u[0], e.p[1] + e.u[1]]);
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const ut = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    const seg = recortar(a, ut, W, H);
    if (!seg) continue;
    // balão na ponta de cima (verticais e inclinadas) ou da esquerda (horizontais)
    const [p0, p1] = e.tipo === 'horizontal' ? (seg[0][0] <= seg[1][0] ? seg : [seg[1], seg[0]]) : (seg[0][1] <= seg[1][1] ? seg : [seg[1], seg[0]]);
    const dir = [p1[0] - p0[0], p1[1] - p0[1]], Ld = Math.hypot(...dir) || 1;
    const c = [p0[0] + (dir[0] / Ld) * (R + 4), p0[1] + (dir[1] / Ld) * (R + 4)];
    const q0 = [c[0] + (dir[0] / Ld) * R, c[1] + (dir[1] / Ld) * R];
    const selc = e.id === sel ? ' sel' : '';
    g.append(s('g', { class: `mont-eixo-g${selc}`, 'data-eixo': e.id },
      s('title', null, `Eixo ${e.nome} — ${e.tipo === 'inclinado' ? `inclinado a ${num(e.ang, 1)}°` : e.tipo} · clique para selecionar, arraste para mover`),
      s('line', { x1: q0[0], y1: q0[1], x2: p1[0], y2: p1[1], class: `mont-eixo${selc}` }),
      s('line', { x1: q0[0], y1: q0[1], x2: p1[0], y2: p1[1], class: 'mont-eixo-alvo' }),
      s('circle', { cx: c[0], cy: c[1], r: R, class: `mont-eixo-bola${selc}` }),
      s('text', { x: c[0], y: c[1] + 4, 'text-anchor': 'middle', class: 'mont-eixo-rot' }, e.nome)));
  }
  // cotas entre eixos paralelos
  const cotas = cotasDosEixos(projeto);
  if (cotaPrevia) cotas.push(cotaPrevia);
  for (const c of cotas) {
    const a = tela(c.pa), b = tela(c.pb);
    const d = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(...d);
    if (L < 2) continue;
    const t = [d[0] / L, d[1] / L], nrm = [-t[1], t[0]];
    const tick = (p) => s('line', { x1: p[0] - (t[0] + nrm[0]) * 4, y1: p[1] - (t[1] + nrm[1]) * 4, x2: p[0] + (t[0] + nrm[0]) * 4, y2: p[1] + (t[1] + nrm[1]) * 4, class: 'mont-cota-tick' });
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let angTxt = (Math.atan2(d[1], d[0]) * 180) / Math.PI;
    if (angTxt > 90) angTxt -= 180; if (angTxt < -90) angTxt += 180;
    g.append(s('g', { class: `mont-cota${c.previa ? ' previa' : ''}`, 'data-cota': c.id ?? '' },
      s('title', null, c.previa ? 'Solte sobre um eixo paralelo para criar a cota' : `Distância ${c.eixoA.nome} → ${c.eixoB.nome}: clique no número para mudar`),
      s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'mont-cota-linha' }), tick(a), tick(b),
      s('text', { x: m[0], y: m[1] - 5, 'text-anchor': 'middle', class: 'mont-cota-txt', transform: `rotate(${angTxt} ${m[0]} ${m[1]})` }, num(c.dist, 2))));
  }
  // nós (cruzamentos): pontos de encaixe e de ancoragem
  for (const n of nosDosEixos(previa ? { eixos: { lista: l.map(({ id, p, ang, nomeProprio }) => ({ id, p, ang, nome: nomeProprio ?? undefined })) } } : projeto)) {
    const [x, y] = tela(n.p);
    if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
    g.append(s('g', { class: 'mont-no', 'data-no': n.id },
      s('title', null, `Nó ${n.nome} (${num(n.p[0], 2)}; ${num(n.p[1], 2)}) — clique para pôr um pilar ou levar o elemento selecionado`),
      s('circle', { cx: x, cy: y, r: 9, class: 'mont-no-alvo' }),
      s('circle', { cx: x, cy: y, r: 3.5, class: 'mont-no-ponto' })));
  }
  return g;
}

/**
 * Encaixe de um arrasto nos eixos: o ponto do elemento mais perto de um eixo encosta nele (na perpendicular).
 * @returns {{dx, dy, eixo: boolean}}
 */
export function encaixarEmEixos(projeto, meus, dx, dy, lim) {
  let melhor = null;
  for (const e of listaEixos(projeto)) {
    for (const m of meus) {
      const q = [m[0] + dx, m[1] + dy];
      const dist = distanciaAoEixo(q, e);
      if (dist < lim && (!melhor || dist < melhor.dist)) {
        const sd = (e.p[0] - q[0]) * e.n[0] + (e.p[1] - q[1]) * e.n[1];
        melhor = { dist, cx: e.n[0] * sd, cy: e.n[1] * sd };
      }
    }
  }
  return melhor ? { dx: dx + melhor.cx, dy: dy + melhor.cy, eixo: true } : { dx, dy, eixo: false };
}

const NOME_FAMILIA = { vertical: 'Verticais', horizontal: 'Horizontais', inclinado: 'Inclinados' };

/**
 * Bloco "Eixos" da lateral: criar eixos, as distâncias entre os paralelos (mudar uma distância leva os eixos
 * seguintes junto) e a opção de os elementos acompanharem os eixos.
 * @param {object} op { projeto, alterarEixos(fn(proj, opMover), descricao), novoEixo(tipo), selecionar(id), sel,
 *                     eixosDosPilares?, pilaresNosNos?, redesenhar }
 */
export function blocoEixos({ projeto, alterarEixos, novoEixo, selecionar, sel, eixosDosPilares, pilaresNosNos, redesenhar, modo, alternarModo, alternarVisiveis, moverTodos }) {
  const fams = familiasDeEixos(projeto);
  const visiveis = eixosVisiveis();
  const n = fams.reduce((s, f) => s + f.eixos.length, 0);
  const botaoVer = alternarVisiveis ? ui.botaoIcone({ icone: visiveis ? 'olho' : 'olhoFechado', titulo: visiveis ? 'Ocultar os eixos, as cotas e os nós (Shift+E)' : 'Mostrar os eixos de novo (Shift+E)', classe: visiveis ? 'mont-eixos-ver' : 'mont-eixos-ver oculto', aoClicar: alternarVisiveis }) : null;
  const cabecalho = h('div', { class: 'mont-bloco-cab' }, h('span', null, 'Eixos'), n && !visiveis ? h('span', { class: 'mont-eixo-tipo' }, `${n} oculto${n > 1 ? 's' : ''}`) : null, h('span', { style: { flex: '1' } }), botaoVer);
  if (!visiveis && n) {
    return h('div', { class: 'mont-bloco mont-bloco-eixos oculto' }, cabecalho,
      h('p', { class: 'mont-dica' }, 'Os eixos estão ocultos: não aparecem na planta e não atraem os elementos. Os nós e as cotas continuam guardados no projeto.'),
      h('div', { class: 'mont-sel-acoes' }, ui.botao({ texto: 'Mostrar os eixos', icone: 'olho', tipo: 'secundario', titulo: 'Shift+E', aoClicar: alternarVisiveis })));
  }
  const corpo = [
    h('div', { class: 'mont-eixos-novos' },
      ui.botao({ texto: 'Vertical', icone: 'mais', tipo: 'fantasma', titulo: 'Novo eixo vertical (depois do último, ou no centro da vista)', aoClicar: () => novoEixo('vertical') }),
      ui.botao({ texto: 'Horizontal', icone: 'mais', tipo: 'fantasma', titulo: 'Novo eixo horizontal', aoClicar: () => novoEixo('horizontal') }),
      ui.botao({ texto: 'Inclinado', icone: 'mais', tipo: 'fantasma', titulo: 'Novo eixo inclinado a 45° pelo centro da vista (ajuste o ângulo no cartão do eixo)', aoClicar: () => novoEixo('inclinado') })),
    h('div', { class: 'mont-eixos-ferr' },
      ui.botao({ texto: 'Desenhar eixo', icone: 'eixo', tipo: modo === 'eixo' ? 'primario' : 'secundario', titulo: 'Clique em dois pontos para criar um eixo passando por eles; Shift deixa horizontal ou vertical (E)', aoClicar: () => alternarModo('eixo') }),
      ui.botao({ texto: 'Cota', icone: 'cota', tipo: modo === 'cota' ? 'primario' : 'secundario', titulo: 'Arraste de um eixo até outro paralelo para cotar e definir a distância entre eles (C)', aoClicar: () => alternarModo('cota') })),
  ];
  if (!fams.length) corpo.push(h('p', { class: 'mont-dica' }, 'Eixos ajudam a posicionar a estrutura: os cruzamentos viram nós onde pilares e apoios encaixam e ficam ancorados — mover um eixo leva junto o que está sobre ele.'));
  for (const f of fams) {
    const cab = `${NOME_FAMILIA[f.tipo]}${f.tipo === 'inclinado' ? ` a ${num(f.ang, 1)}°` : ''}`;
    const linha = [];
    f.eixos.forEach((e, i) => {
      linha.push(h('button', { type: 'button', class: ['mont-eixo-chip', e.id === sel && 'sel'], title: `Eixo ${e.nome} — selecionar`, onClick: () => selecionar(e.id) }, e.nome));
      if (i < f.eixos.length - 1) {
        linha.push(ui.campo({
          valor: f.espacos[i], unidade: 'm', casas: 2, min: 0, max: 1000, largura: '86px',
          dica: `Distância entre os eixos ${e.nome} e ${f.eixos[i + 1].nome} — os eixos seguintes acompanham`,
          aoMudar: (v) => alterarEixos((pp, op, nucleo) => nucleo.definirDistancia(pp, e.id, f.eixos[i + 1].id, v, op), `Distância ${e.nome}–${f.eixos[i + 1].nome}: ${num(v, 2)} m`),
        }));
      }
    });
    corpo.push(h('div', { class: 'mont-eixos-fam' }, h('span', { class: 'mont-eixos-fam-rot' }, `${cab} · ${f.eixos.length}`), h('div', { class: 'mont-eixos-linha' }, linha)));
  }
  corpo.push(
    ui.alternar({ rotulo: 'Elementos acompanham os eixos', valor: eixosLevamElementos(), dica: 'Ao mover um eixo ou mudar uma distância, os pilares, apoios de vigas e cantos de lajes que estão sobre ele vão junto (em todos os pavimentos)', aoMudar: (v) => { definirAcompanhar(v); redesenhar(); } }),
    h('div', { class: 'mont-sel-acoes' },
      eixosDosPilares ? h('button', { class: 'link', onClick: eixosDosPilares }, 'Criar eixos pelos pilares deste pavimento') : null,
      pilaresNosNos && fams.length > 1 ? h('button', { class: 'link', onClick: pilaresNosNos }, 'Pilares nos nós sem pilar') : null,
      moverTodos && n ? h('button', { class: 'link', onClick: moverTodos, title: 'Desloca todos os eixos de Δx e Δy (por exemplo, para alinhar com a planta de arquitetura)' }, 'Mover todos os eixos…') : null),
  );
  return h('div', { class: 'mont-bloco mont-bloco-eixos' }, cabecalho, ...corpo);
}

/**
 * Cartão do eixo selecionado: nome, direção, posição, distâncias aos vizinhos paralelos, duplicar e excluir.
 */
export function cartaoEixo({ projeto, id, alterarEixos, duplicar, excluir, fechar }) {
  const l = listaEixos(projeto);
  const e = l.find((x) => x.id === id);
  if (!e) return null;
  const fam = l.filter((x) => x.familia === e.familia);
  const i = fam.indexOf(e), ant = fam[i - 1], prox = fam[i + 1];
  const tipoTxt = e.tipo === 'vertical' ? 'Vertical' : e.tipo === 'horizontal' ? 'Horizontal' : 'Inclinado';
  const rotPos = e.tipo === 'vertical' ? 'Posição x' : e.tipo === 'horizontal' ? 'Posição y' : 'Distância à origem';
  return h('div', { class: 'mont-bloco mont-cartao-eixo' },
    h('div', { class: 'mont-bloco-cab' }, h('span', null, `Eixo ${e.nome}`), h('span', { class: 'mont-eixo-tipo' }, tipoTxt),
      h('button', { class: 'link', onClick: fechar, title: 'Tirar a seleção (Esc)' }, '×')),
    h('div', { class: 'mont-sel-campos' },
      ui.texto({ rotulo: 'Nome', valor: e.nomeProprio ?? '', placeholder: `automático: ${e.nome}`, largura: '100%', aoMudar: (v) => alterarEixos((pp, op, n) => n.editarEixo(pp, id, { nome: v }), `Nome do eixo ${e.nome}`) }),
      ui.campo({ rotulo: 'Ângulo', valor: e.ang, unidade: '°', casas: 2, min: 0, max: 180, dica: '0° = horizontal, 90° = vertical; gira o eixo em torno do ponto de referência', aoMudar: (v) => alterarEixos((pp, op, n) => n.editarEixo(pp, id, { ang: v }), `Ângulo do eixo ${e.nome}`) })),
    h('div', { class: 'mont-sel-campos' },
      ui.campo({ rotulo: rotPos, valor: e.d, unidade: 'm', casas: 3, min: -100000, max: 100000, dica: 'Move o eixo na perpendicular (leva junto os elementos sobre ele, se a opção estiver ligada)', aoMudar: (v) => alterarEixos((pp, op, n) => n.moverEixo(pp, id, v, op), `Mover o eixo ${e.nome}`) })),
    ant || prox ? h('div', { class: 'mont-sel-campos' },
      ant ? ui.campo({ rotulo: `Distância a ${ant.nome}`, valor: Math.round((e.d - ant.d) * 1e6) / 1e6, unidade: 'm', casas: 2, min: 0, max: 1000, dica: `Este eixo e os seguintes vão para essa distância de ${ant.nome}`, aoMudar: (v) => alterarEixos((pp, op, n) => n.definirDistancia(pp, ant.id, id, v, op), `Distância ${ant.nome}–${e.nome}: ${num(v, 2)} m`) }) : null,
      prox ? ui.campo({ rotulo: `Distância a ${prox.nome}`, valor: Math.round((prox.d - e.d) * 1e6) / 1e6, unidade: 'm', casas: 2, min: 0, max: 1000, dica: `${prox.nome} e os seguintes vão para essa distância deste eixo`, aoMudar: (v) => alterarEixos((pp, op, n) => n.definirDistancia(pp, id, prox.id, v, op), `Distância ${e.nome}–${prox.nome}: ${num(v, 2)} m`) }) : null) : null,
    h('p', { class: 'mont-dica' }, 'Para mover: arraste o eixo na planta (encosta nos pilares, cantos e nós) ou use as setas do teclado (Shift: 10 vezes o passo).'),
    h('div', { class: 'mont-sel-acoes' },
      ui.botao({ texto: 'Duplicar', icone: 'copiar', tipo: 'secundario', titulo: 'Cópia paralela a uns 20 px deste eixo (D)', aoClicar: () => duplicar(1) }),
      ui.botao({ texto: 'Duplicar do outro lado', icone: 'copiar', tipo: 'fantasma', titulo: 'Cópia paralela do outro lado (Shift+D)', aoClicar: () => duplicar(-1) }),
      ui.botao({ texto: 'Excluir', icone: 'lixeira', tipo: 'fantasma', titulo: 'Exclui o eixo e as cotas presas a ele (Delete); os elementos ficam onde estão', aoClicar: excluir })),
  );
}
