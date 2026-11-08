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
 * Montagem (0.32): planta de arquitetura em DXF como fundo de cada pavimento, eixos do projeto e malha de encaixe.
 *
 * Arquivo do projeto:
 *   projeto.plantasFundo = [{ id, nome, unidade, camadas, entidades, textos, limites }]   (geometria nas unidades do DXF)
 *   pavimento.fundo = { planta, unidade, dx, dy, rotacao, opacidade, ocultas: [camada], visivel }   (dx, dy em m)
 *   projeto.eixos = { x: [m…], y: [m…] }   (linhas de eixo verticais em x e horizontais em y)
 */
import { h, s } from '../ui/dom.js';
import * as ui from '../ui/componentes.js';
import { icone } from '../ui/icones.js';
import { num } from '../core/formatar.js';
import { lerPlantaDxf, FATOR_UNIDADE } from '../../engine/dxf-planta.js';

/* ------------------------------------------------------------------ preferências da vista */
const PREF_MALHA = 'lebr.montagem.malha', PREF_IMA_FUNDO = 'lebr.montagem.imaFundo';
const ler = (k, padrao) => { try { return localStorage.getItem(k) ?? padrao; } catch { return padrao; } };
const gravar = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* sem armazenamento */ } };
/** Passo da malha de encaixe (m); 0 = sem malha (só o arredondamento de 5 cm). */
export const passoMalha = () => Number(ler(PREF_MALHA, '0')) || 0;
export const imaNoFundo = () => ler(PREF_IMA_FUNDO, 'sim') !== 'nao';

/* ------------------------------------------------------------------ dados */
export const plantaDe = (projeto, pav) => (pav?.fundo?.planta ? (projeto.plantasFundo ?? []).find((p) => p.id === pav.fundo.planta) ?? null : null);
const fatorDe = (pav, planta) => FATOR_UNIDADE[pav?.fundo?.unidade ?? planta?.unidade] ?? 1;

/** Transformação do desenho para o pavimento (unidades do DXF → m, girado e deslocado). */
export function transformacaoFundo(pav, planta) {
  const f = fatorDe(pav, planta), a = ((pav.fundo?.rotacao ?? 0) * Math.PI) / 180;
  const cs = Math.cos(a) * f, sn = Math.sin(a) * f;
  const dx = pav.fundo?.dx ?? 0, dy = pav.fundo?.dy ?? 0;
  return { f, a, dx, dy, aplicar: (x, y) => [cs * x - sn * y + dx, sn * x + cs * y + dy] };
}

/** Lê o DXF e devolve a planta pronta para ir ao projeto, com a origem do desenho sugerida. */
export function plantaDoDxf(texto, nome) {
  const d = lerPlantaDxf(texto);
  return {
    planta: { id: `pl${Date.now().toString(36)}`, nome, unidade: d.unidade, camadas: d.camadas, entidades: d.entidades, textos: d.textos, limites: d.limites },
    resumo: { entidades: d.entidades.length, textos: d.textos.length, camadas: d.camadas.length, unidade: d.unidade, unidadeLida: d.unidadeLida, ignoradas: d.ignoradas, cortado: d.cortado, pontos: d.pontos },
  };
}

/** Fundo inicial de um pavimento: o canto inferior esquerdo do desenho na origem da montagem. */
export function fundoInicial(planta) {
  const f = FATOR_UNIDADE[planta.unidade] ?? 1;
  return { planta: planta.id, unidade: planta.unidade, dx: -planta.limites.x0 * f, dy: -planta.limites.y0 * f, rotacao: 0, opacidade: 55, ocultas: [], visivel: true };
}

/* ------------------------------------------------------------------ desenho na planta da montagem */
const cache = new Map(); // chave → <g> com os caminhos nas unidades do DXF
function grupoDaPlanta(planta, ocultas) {
  const chave = `${planta.id}|${planta.entidades.length}|${[...(ocultas ?? [])].sort().join(',')}`;
  if (cache.has(chave)) return cache.get(chave);
  const esconder = new Set(ocultas ?? []);
  const porCamada = new Map();
  for (const e of planta.entidades) {
    if (esconder.has(planta.camadas[e.c])) continue;
    const p = e.p;
    let d = `M${p[0]} ${p[1]}`;
    for (let i = 2; i < p.length; i += 2) d += `L${p[i]} ${p[i + 1]}`;
    if (e.f) d += 'Z';
    porCamada.set(e.c, (porCamada.get(e.c) ?? '') + d);
  }
  const g = s('g', { class: 'mont-fundo-geo' });
  for (const [c, d] of porCamada) g.append(s('path', { d, dataset: { camada: planta.camadas[c] } }));
  const textos = s('g', { class: 'mont-fundo-txt' });
  for (const t of planta.textos) {
    if (esconder.has(planta.camadas[t.c])) continue;
    textos.append(s('text', { transform: `translate(${t.x} ${t.y}) rotate(${(t.r * 180) / Math.PI}) scale(1 -1)`, 'font-size': t.h }, t.t));
  }
  g.append(textos);
  cache.set(chave, g);
  if (cache.size > 12) cache.delete(cache.keys().next().value);
  return g;
}

/**
 * Camada SVG do fundo do pavimento.
 * @param {(pt:[number,number]) => [number,number]} tela  mundo (m) → tela (px)
 * @param {number} esc  px por metro
 */
export function camadaFundo(projeto, pav, tela, esc) {
  const planta = plantaDe(projeto, pav);
  if (!planta || pav.fundo.visivel === false) return null;
  const { f, a, dx, dy } = transformacaoFundo(pav, planta);
  const [ox, oy] = tela([0, 0]);
  const geo = grupoDaPlanta(planta, pav.fundo.ocultas);
  // textos ilegíveis de longe ficam de fora (o desenho continua leve ao afastar)
  const alturaMedia = planta.textos.length ? planta.textos.reduce((t, x) => t + x.h, 0) / planta.textos.length : 0;
  geo.querySelector('.mont-fundo-txt')?.setAttribute('display', alturaMedia * f * esc < 5 ? 'none' : 'inline');
  return s('g', { class: 'mont-fundo', style: { opacity: (pav.fundo.opacidade ?? 55) / 100 } },
    s('g', { transform: `matrix(${esc} 0 0 ${-esc} ${ox} ${oy}) translate(${dx} ${dy}) rotate(${(a * 180) / Math.PI}) scale(${f})` }, geo));
}

/** Pontos da planta (vértices, em m) dentro de uma caixa — para o encaixe magnético dos elementos. */
export function pontosDoFundo(projeto, pav, [x0, y0, x1, y1], limite = 60000) {
  const planta = plantaDe(projeto, pav);
  if (!planta || pav.fundo.visivel === false || !imaNoFundo()) return [];
  const { aplicar } = transformacaoFundo(pav, planta);
  const esconder = new Set(pav.fundo.ocultas ?? []);
  const out = [];
  for (const e of planta.entidades) {
    if (esconder.has(planta.camadas[e.c])) continue;
    // nas curvas (muitos pontos), só as pontas
    const passo = e.p.length > 40 ? e.p.length - 2 : 2;
    for (let i = 0; i < e.p.length; i += passo) {
      const [x, y] = aplicar(e.p[i], e.p[i + 1]);
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) { out.push([x, y]); if (out.length >= limite) return out; }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ eixos */
const letra = (i) => { let t = '', n = i; do { t = String.fromCharCode(65 + (n % 26)) + t; n = Math.floor(n / 26) - 1; } while (n >= 0); return t; };
/** Eixos do projeto com os nomes: verticais (em x) numerados 1, 2, 3…; horizontais (em y) A, B, C… */
export function eixosDe(projeto) {
  const ex = [...new Set((projeto.eixos?.x ?? []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
  const ey = [...new Set((projeto.eixos?.y ?? []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
  return { x: ex.map((v, i) => ({ nome: String(i + 1), v })), y: ey.map((v, i) => ({ nome: letra(i), v })) };
}
export const lerLista = (t) => String(t ?? '').split(/[;\s]+/).map((x) => Number(x.replace(',', '.'))).filter(Number.isFinite);
export const listaTexto = (v) => (v ?? []).map((x) => String(Math.round(x * 1000) / 1000).replace('.', ',')).join('; ');

export function camadaEixos(projeto, tela, mundo, W, H) {
  const e = eixosDe(projeto);
  if (!e.x.length && !e.y.length) return null;
  const g = s('g', { class: 'mont-eixos' });
  const R = 10;
  for (const a of e.x) {
    const [px] = tela([a.v, 0]);
    if (px < -R || px > W + R) continue;
    g.append(s('line', { x1: px, y1: 2 * R + 6, x2: px, y2: H, class: 'mont-eixo' }),
      s('circle', { cx: px, cy: R + 4, r: R, class: 'mont-eixo-bola' }), s('text', { x: px, y: R + 8, 'text-anchor': 'middle', class: 'mont-eixo-rot' }, a.nome));
  }
  for (const a of e.y) {
    const [, py] = tela([0, a.v]);
    if (py < -R || py > H + R) continue;
    g.append(s('line', { x1: 2 * R + 6, y1: py, x2: W, y2: py, class: 'mont-eixo' }),
      s('circle', { cx: R + 4, cy: py, r: R, class: 'mont-eixo-bola' }), s('text', { x: R + 4, y: py + 4, 'text-anchor': 'middle', class: 'mont-eixo-rot' }, a.nome));
  }
  void mundo;
  return g;
}

/** Interseções dos eixos (pontos de encaixe). */
export function cruzamentosDosEixos(projeto) {
  const e = eixosDe(projeto);
  return e.x.flatMap((a) => e.y.map((b) => [a.v, b.v]));
}

/**
 * Ajuste de um deslocamento (dx, dy) do arrasto: encosta num eixo quando algum ponto do elemento passa perto dele.
 * @returns {{dx, dy, eixo: boolean}}
 */
export function encaixarEmEixos(projeto, meus, dx, dy, lim) {
  const e = eixosDe(projeto);
  let mx = null, my = null;
  for (const m of meus) {
    for (const a of e.x) { const d = a.v - (m[0] + dx); if (Math.abs(d) < lim && (!mx || Math.abs(d) < Math.abs(mx))) mx = d; }
    for (const b of e.y) { const d = b.v - (m[1] + dy); if (Math.abs(d) < lim && (!my || Math.abs(d) < Math.abs(my))) my = d; }
  }
  return { dx: dx + (mx ?? 0), dy: dy + (my ?? 0), eixo: mx != null || my != null };
}

/* ------------------------------------------------------------------ bloco da lateral */
/**
 * @param {{projeto, pav, alterar, importar, mover:boolean, alternarMover}} op
 *   alterar(fn(proj, pavDoProjeto), descricao)
 */
export function blocoFundo({ projeto, pav, alterar, importar, mover, alternarMover, redesenhar, eixosDosPilares, paredes }) {
  const planta = plantaDe(projeto, pav);
  const fundo = pav?.fundo;
  const mudar = (fn, d) => alterar((pp, pv) => { pv.fundo ??= {}; fn(pv.fundo, pp, pv); }, d);
  const corpo = [];
  if (!planta) {
    const outras = projeto.plantasFundo ?? [];
    corpo.push(h('p', { class: 'mont-dica' }, 'Importe a planta de arquitetura (DXF) para desenhar a estrutura por cima dela, encaixando nos cantos das paredes.'),
      h('div', { class: 'mont-sel-acoes' },
        ui.botao({ texto: 'Importar planta DXF…', icone: 'pasta', tipo: 'secundario', aoClicar: importar }),
        outras.length ? ui.selecao({ rotulo: 'Ou usar uma já importada', valor: '', largura: '100%', opcoes: [{ valor: '', texto: '—' }, ...outras.map((o) => ({ valor: o.id, texto: o.nome }))],
          aoMudar: (v) => { const o = outras.find((x) => x.id === v); if (o) alterar((pp, pv) => { pv.fundo = fundoInicial(o); }, `Planta de fundo: ${o.nome}`); } }) : null));
  } else {
    const n = planta.entidades.length;
    corpo.push(
      h('div', { class: 'mont-fundo-nome' }, icone('documento', { tamanho: 14 }), h('strong', null, planta.nome), h('span', null, `${num(n, 0)} linhas · ${planta.camadas.length} camadas`)),
      h('div', { class: 'mont-sel-campos' },
        ui.selecao({ rotulo: 'Unidade do desenho', valor: fundo.unidade ?? planta.unidade, largura: '100%', opcoes: Object.keys(FATOR_UNIDADE).map((u) => ({ valor: u, texto: u })),
          aoMudar: (v) => mudar((f) => { f.unidade = v; }, 'Unidade da planta de fundo') }),
        ui.campo({ rotulo: 'Opacidade', valor: fundo.opacidade ?? 55, unidade: '%', casas: 0, min: 5, max: 100, aoMudar: (v) => mudar((f) => { f.opacidade = v; }, 'Opacidade da planta de fundo') })),
      h('div', { class: 'mont-sel-campos' },
        ui.campo({ rotulo: 'Deslocar x', valor: fundo.dx ?? 0, unidade: 'm', casas: 3, min: -100000, max: 100000, aoMudar: (v) => mudar((f) => { f.dx = v; }, 'Mover a planta de fundo') }),
        ui.campo({ rotulo: 'Deslocar y', valor: fundo.dy ?? 0, unidade: 'm', casas: 3, min: -100000, max: 100000, aoMudar: (v) => mudar((f) => { f.dy = v; }, 'Mover a planta de fundo') }),
        ui.campo({ rotulo: 'Girar', valor: fundo.rotacao ?? 0, unidade: '°', casas: 2, min: -360, max: 360, aoMudar: (v) => mudar((f) => { f.rotacao = v; }, 'Girar a planta de fundo') })),
      h('div', { class: 'mont-fundo-alt' },
        ui.alternar({ rotulo: 'Mostrar a planta', valor: fundo.visivel !== false, aoMudar: (v) => mudar((f) => { f.visivel = v; }, v ? 'Mostrar a planta de fundo' : 'Esconder a planta de fundo') }),
        ui.alternar({ rotulo: 'Arrastar para mover a planta', valor: mover, dica: 'Enquanto ligado, arrastar o fundo move a planta (em vez de deslocar a vista)', aoMudar: alternarMover }),
        ui.alternar({ rotulo: 'Encaixar nos pontos da planta', valor: imaNoFundo(), dica: 'Os elementos encostam nos cantos e pontas das linhas da planta ao serem arrastados', aoMudar: (v) => { gravar(PREF_IMA_FUNDO, v ? 'sim' : 'nao'); redesenhar(); } })),
      h('details', { class: 'mont-camadas' },
        h('summary', null, `Camadas (${planta.camadas.length - (fundo.ocultas?.length ?? 0)} de ${planta.camadas.length} visíveis)`),
        h('div', { class: 'mont-camadas-acoes' },
          h('button', { class: 'link', onClick: () => mudar((f) => { f.ocultas = []; }, 'Mostrar todas as camadas') }, 'todas'),
          h('button', { class: 'link', onClick: () => mudar((f) => { f.ocultas = [...planta.camadas]; }, 'Esconder todas as camadas') }, 'nenhuma')),
        h('div', { class: 'mont-camadas-lista' }, planta.camadas.map((c) => h('label', { class: 'mont-camada' },
          h('input', { type: 'checkbox', checked: !(fundo.ocultas ?? []).includes(c), onChange: (e) => mudar((f) => { const o = new Set(f.ocultas ?? []); if (e.target.checked) o.delete(c); else o.add(c); f.ocultas = [...o]; }, `Camada ${c}`) }),
          h('span', null, c))))),
      paredes ? h('div', { class: 'mont-sel-acoes' },
        ui.botao({ texto: 'Paredes como cargas…', icone: 'carga', tipo: 'secundario', aoClicar: paredes })) : null,
      h('div', { class: 'mont-sel-acoes' },
        ui.botao({ texto: 'Usar em todos os pavimentos', icone: 'copiar', tipo: 'fantasma', aoClicar: () => alterar((pp) => { for (const pv of pp.pavimentos) pv.fundo = { ...JSON.parse(JSON.stringify(fundo)) }; }, 'Planta de fundo em todos os pavimentos') }),
        ui.botao({ texto: 'Trocar…', icone: 'pasta', tipo: 'fantasma', aoClicar: importar }),
        ui.botao({ texto: 'Retirar', icone: 'fechar', tipo: 'fantasma', aoClicar: () => alterar((pp, pv) => {
          delete pv.fundo;
          // a planta sai do arquivo quando nenhum pavimento a usa mais
          pp.plantasFundo = (pp.plantasFundo ?? []).filter((x) => pp.pavimentos.some((q) => q.fundo?.planta === x.id));
          if (!pp.plantasFundo.length) delete pp.plantasFundo;
        }, 'Retirar a planta de fundo') })),
    );
  }

  // malha e eixos (para todos os pavimentos)
  const e = eixosDe(projeto);
  corpo.push(
    h('div', { class: 'mont-sel-campos' },
      ui.selecao({ rotulo: 'Malha de encaixe', valor: String(passoMalha()), largura: '100%',
        opcoes: [{ valor: '0', texto: 'Sem malha (5 cm)' }, ...[0.1, 0.25, 0.5, 1].map((v) => ({ valor: String(v), texto: `${num(v * 100, 0)} cm` }))],
        aoMudar: (v) => { gravar(PREF_MALHA, v); redesenhar(); } })),
    h('div', { class: 'mont-eixos-campos' },
      ui.texto({ rotulo: `Eixos verticais x (m) · ${e.x.map((a) => a.nome).join(' ') || '—'}`, valor: listaTexto(projeto.eixos?.x), placeholder: 'ex.: 0; 4; 8', largura: '100%',
        aoMudar: (v) => alterar((pp) => { pp.eixos = { ...(pp.eixos ?? {}), x: lerLista(v) }; }, 'Eixos x') }),
      ui.texto({ rotulo: `Eixos horizontais y (m) · ${e.y.map((a) => a.nome).join(' ') || '—'}`, valor: listaTexto(projeto.eixos?.y), placeholder: 'ex.: 0; 5; 10', largura: '100%',
        aoMudar: (v) => alterar((pp) => { pp.eixos = { ...(pp.eixos ?? {}), y: lerLista(v) }; }, 'Eixos y') }),
      eixosDosPilares ? h('button', { class: 'link', onClick: eixosDosPilares }, 'Criar os eixos pelos pilares deste pavimento') : null),
  );
  return h('div', { class: 'mont-bloco mont-bloco-fundo' },
    h('div', { class: 'mont-bloco-cab' }, h('span', null, 'Planta de fundo, eixos e malha')),
    ...corpo);
}
