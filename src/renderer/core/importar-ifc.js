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
 * Importar IFC (roteiro, etapa L15) — o mínimo para começar o lançamento a partir de um modelo BIM:
 *
 *  - pavimentos: um por IfcBuildingStorey (cota do nível); os que já existem no projeto, pela cota, são reaproveitados;
 *  - pilares: cada IfcColumn vira pilar de concreto no pavimento onde ele termina (topo), com a seção do contorno
 *    (retângulo de menor área, com o ângulo; circular quando o perfil é um círculo) e o comprimento do modelo;
 *  - lajes: cada IfcSlab retangular e de espessura até 60 cm vira laje maciça no pavimento do topo dela;
 *    as outras (recortadas, inclinadas, telhado) ficam só desenhadas na planta de fundo;
 *  - paredes e vigas: desenhadas na planta de fundo de cada pavimento (camadas IFC-PAREDES e IFC-VIGAS), e as
 *    paredes viram cargas pela etapa L12 (Montagem → Paredes da planta de fundo como cargas), depois que as vigas
 *    forem lançadas por cima.
 *
 * Arquivo do projeto: a planta de fundo de cada pavimento é uma `plantasFundo` comum, em metros (nome "IFC · …").
 */
import { lerIfc, menorRetangulo, areaPoligono } from '../../engine/ifc.js';
import { pavimentosOrdenados, novoIdPavimento, detectarLigacoes, aplicarLigacoes } from './montagem.js';
import { novoId, proximoCodigo } from './projeto.js';
import { renumerar } from './renumerar.js';

const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
export const TOL_NIVEL = 0.6;          // m — distância máxima do topo (ou da base) do elemento ao nível
export const ESPESSURA_MAX_LAJE = 0.6; // m — acima disso é telhado, rampa ou laje inclinada: só no fundo
export const CAMADAS = { pilar: 'IFC-PILARES', laje: 'IFC-LAJES', parede: 'IFC-PAREDES', viga: 'IFC-VIGAS' };

/** Seção do pilar a partir do contorno: bx ao longo do ângulo, ângulo em (−45°, 45°]. */
export function secaoDoContorno(contorno, circular = false) {
  const r = menorRetangulo(contorno);
  if (!r) return null;
  let { a, b, angulo } = r;
  angulo = ((angulo % 180) + 180) % 180;
  if (angulo > 135) angulo -= 180;
  else if (angulo > 45) { angulo -= 90; [a, b] = [b, a]; }
  if (Math.abs(angulo) < 0.05) angulo = 0;
  // círculo: a área do contorno fica perto de π/4 do quadrado
  const circ = circular || (contorno.length >= 12 && Math.abs(a - b) < 0.01 * a && Math.abs(areaPoligono(contorno) / (a * b) - Math.PI / 4) < 0.03);
  return { centro: r.centro, a, b, angulo: r2(angulo), circular: circ, area: r.area };
}

/** Nível mais perto da cota z, até `tol`. */
const nivelPerto = (niveis, z, tol = TOL_NIVEL) => {
  let melhor = null;
  for (const n of niveis) if (Math.abs(n.cota - z) <= tol && (!melhor || Math.abs(n.cota - z) < Math.abs(melhor.cota - z))) melhor = n;
  return melhor;
};

/**
 * O que a importação vai fazer (sem mexer no projeto).
 * @param opcoes { criarLajes = true, criarPilares = true }
 */
export function planoIfc(projeto, modelo, { criarLajes = true, criarPilares = true } = {}) {
  const avisos = [...modelo.avisos];
  const vazio = !(projeto.elementos ?? []).some((e) => e.posicao);
  // níveis do modelo (sem repetir cotas a menos de 5 cm)
  let niveis = [];
  for (const p of modelo.pavimentos) if (!niveis.some((n) => Math.abs(n.cota - p.cota) < 0.05)) niveis.push({ nome: String(p.nome).trim() || `Nível ${r2(p.cota)}`, cota: r3(p.cota) });
  if (!niveis.length) {
    // sem IfcBuildingStorey: os topos dos pilares e das lajes viram os níveis
    for (const e of modelo.elementos) if (!e.ignorado && (e.categoria === 'pilar' || e.categoria === 'laje') && !niveis.some((n) => Math.abs(n.cota - e.z1) < 0.05)) niveis.push({ nome: `Nível ${r2(e.z1)}`, cota: r3(e.z1) });
    niveis.sort((a, b) => a.cota - b.cota);
    if (niveis.length) avisos.push('O modelo não tem pavimentos (IfcBuildingStorey): os níveis saíram dos topos dos pilares e das lajes.');
  }
  // reaproveitar os pavimentos do projeto pela cota (num projeto vazio, os do IFC substituem os padrão)
  const existentes = vazio ? [] : pavimentosOrdenados(projeto);
  niveis = niveis.map((n) => ({ ...n, pavimento: existentes.find((p) => Math.abs(p.cota - n.cota) < 0.05)?.id ?? null }));

  // deslocamento: coordenadas de levantamento (muito longe da origem) vêm para perto de (0, 0)
  const validos = modelo.elementos.filter((e) => !e.ignorado && e.contorno?.length);
  let dx = 0, dy = 0;
  if (validos.length) {
    const xs = validos.flatMap((e) => e.contorno.map((p) => p[0])), ys = validos.flatMap((e) => e.contorno.map((p) => p[1]));
    const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
    if (Math.max(Math.abs(x0), Math.abs(x1), Math.abs(y0), Math.abs(y1)) > 1000) { dx = -Math.round(x0); dy = -Math.round(y0); } // metro inteiro mais perto: os eixos continuam redondos
  }
  const mover = ([x, y]) => [r3(x + dx), r3(y + dy)];

  const pilares = [], lajes = [], fundo = [], foraDeNivel = [];
  for (const e of validos) {
    const contorno = e.contorno.map(mover);
    if (e.categoria === 'pilar') {
      const n = nivelPerto(niveis, e.z1);
      const s = secaoDoContorno(contorno, e.circular);
      if (!n || !s) { foraDeNivel.push(e); fundo.push({ e, contorno, nivel: nivelPerto(niveis, e.z1, Infinity) }); continue; }
      pilares.push({ e, nivel: n, x: r3(s.centro[0]), y: r3(s.centro[1]), angulo: s.angulo, circular: s.circular,
        bx: Math.max(10, Math.round(s.a * 100)), by: Math.max(10, Math.round(s.b * 100)), comprimento: r2(e.z1 - e.z0), criar: criarPilares });
      fundo.push({ e, contorno, nivel: n });
    } else if (e.categoria === 'laje') {
      const n = nivelPerto(niveis, e.z1);
      const h = e.z1 - e.z0;
      const r = menorRetangulo(contorno);
      const retangular = r && areaPoligono(contorno) >= 0.97 * r.area;
      const ok = n && retangular && h <= ESPESSURA_MAX_LAJE && h >= 0.05;
      const motivo = !n ? 'fora dos níveis' : !retangular ? 'contorno recortado' : h > ESPESSURA_MAX_LAJE ? 'inclinada ou espessa demais' : h < 0.05 ? 'fina demais' : null;
      if (ok) {
        // lados: lx ao longo do ângulo (−45°, 45°]
        let { a, b, angulo } = r;
        angulo = ((angulo % 180) + 180) % 180;
        if (angulo > 135) angulo -= 180; else if (angulo > 45) { angulo -= 90; [a, b] = [b, a]; }
        if (Math.abs(angulo) < 0.05) angulo = 0;
        const c = Math.cos((angulo * Math.PI) / 180), s = Math.sin((angulo * Math.PI) / 180);
        const x = r.centro[0] - (a / 2) * c + (b / 2) * s, y = r.centro[1] - (a / 2) * s - (b / 2) * c;
        lajes.push({ e, nivel: n, x: r3(x), y: r3(y), angulo: r2(angulo), lx: r2(a), ly: r2(b), h: Math.max(7, Math.round(h * 100)), criar: criarLajes });
      } else lajes.push({ e, nivel: n ?? nivelPerto(niveis, e.z1, Infinity), motivo, criar: false });
      fundo.push({ e, contorno, nivel: n ?? nivelPerto(niveis, e.z1, Infinity) });
    } else if (e.categoria === 'parede') {
      // a parede nasce no nível de baixo dela (a base pode estar no fundo da laje)
      const n = nivelPerto(niveis, e.z0) ?? [...niveis].reverse().find((q) => q.cota <= e.z0 + TOL_NIVEL) ?? niveis[0];
      fundo.push({ e, contorno, nivel: n });
    } else if (e.categoria === 'viga') {
      fundo.push({ e, contorno, nivel: nivelPerto(niveis, e.z1, Infinity) });
    }
  }
  if (foraDeNivel.length) avisos.push(`${foraDeNivel.length} pilar(es) sem nível a menos de ${r2(TOL_NIVEL)} m do topo: ficaram só na planta de fundo.`);
  const conta = (cat) => modelo.elementos.filter((e) => e.categoria === cat && !e.ignorado).length;
  return {
    modelo, niveis, pilares, lajes, fundo, deslocamento: [dx, dy], avisos, vazio,
    resumo: {
      niveis: niveis.length, niveisNovos: niveis.filter((n) => !n.pavimento).length,
      pilares: pilares.filter((p) => p.criar).length, lajes: lajes.filter((l) => l.criar).length, lajesFundo: lajes.filter((l) => !l.criar).length,
      paredes: conta('parede'), vigas: conta('viga'), ignorados: modelo.elementos.filter((e) => e.ignorado).length,
    },
  };
}

/** Aplica o plano no projeto (altera no lugar). Devolve { pavimentos, pilares, lajes, ligacoes, plantas }. */
export function aplicarIfc(projeto, registro, plano, { nomeArquivo = 'modelo.ifc' } = {}) {
  // pavimentos
  if (plano.vazio) projeto.pavimentos = [];
  const pavDe = new Map();
  for (const n of plano.niveis) {
    if (n.pavimento && projeto.pavimentos.some((p) => p.id === n.pavimento)) { pavDe.set(n, n.pavimento); continue; }
    const pv = { id: novoIdPavimento(), nome: n.nome, cota: n.cota };
    projeto.pavimentos.push(pv);
    pavDe.set(n, pv.id);
  }
  const novos = [];
  // pilares
  const modPilar = registro.obter('concreto.pilar');
  for (const p of plano.pilares) {
    if (!p.criar) continue;
    const codigo = proximoCodigo(projeto, 'P');
    const el = {
      id: novoId('p'), modulo: 'concreto.pilar', codigo, nome: codigo, ...modPilar.criar(projeto),
      bx: p.bx, by: p.circular ? p.bx : p.by, comprimento: p.comprimento, cargas: [], resultado: null,
      posicao: { pavimento: pavDe.get(p.nivel), x: p.x, y: p.y, angulo: p.circular ? 0 : p.angulo },
      ifc: { tipo: p.e.tipoIfc, nome: p.e.nome ?? '' },
    };
    if (p.circular) { el.forma = 'circular'; el.D = p.bx; }
    projeto.elementos.push(el);
    novos.push(el);
  }
  // lajes
  const modLaje = registro.obter('concreto.laje.macica');
  for (const l of plano.lajes) {
    if (!l.criar) continue;
    const codigo = proximoCodigo(projeto, 'L');
    const el = {
      id: novoId('l'), modulo: 'concreto.laje.macica', codigo, nome: codigo, ...modLaje.criar(projeto),
      lx: l.lx, ly: l.ly, h: l.h, resultado: null,
      posicao: { pavimento: pavDe.get(l.nivel), x: l.x, y: l.y, angulo: l.angulo },
      ifc: { tipo: l.e.tipoIfc, nome: l.e.nome ?? '' },
    };
    projeto.elementos.push(el);
    novos.push(el);
  }
  // planta de fundo por pavimento: contornos por categoria
  const porNivel = new Map();
  for (const f of plano.fundo) {
    if (!f.nivel || f.contorno.length < 2) continue;
    if (!porNivel.has(f.nivel)) porNivel.set(f.nivel, []);
    porNivel.get(f.nivel).push(f);
  }
  const camadas = Object.values(CAMADAS);
  let plantas = 0;
  const base = String(nomeArquivo).replace(/\.ifc$/i, '');
  for (const [n, lista] of porNivel) {
    const pavId = pavDe.get(n);
    const pv = projeto.pavimentos.find((p) => p.id === pavId);
    if (!pv) continue;
    const entidades = lista.map((f) => ({ c: camadas.indexOf(CAMADAS[f.e.categoria]), p: f.contorno.flat(), f: 1 }));
    const xs = entidades.flatMap((e) => e.p.filter((_, i) => i % 2 === 0)), ys = entidades.flatMap((e) => e.p.filter((_, i) => i % 2 === 1));
    const planta = {
      id: `pl${Date.now().toString(36)}${plantas}`, nome: `IFC · ${base} · ${n.nome}`, unidade: 'm', camadas: [...camadas], entidades, textos: [],
      limites: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) },
    };
    const antiga = pv.fundo?.planta;
    projeto.plantasFundo = [...(projeto.plantasFundo ?? []), planta];
    pv.fundo = { planta: planta.id, unidade: 'm', dx: 0, dy: 0, rotacao: 0, opacidade: 55, ocultas: [], visivel: true };
    if (antiga && !projeto.pavimentos.some((q) => q.fundo?.planta === antiga)) projeto.plantasFundo = projeto.plantasFundo.filter((x) => x.id !== antiga);
    plantas++;
  }
  // ligações dos pilares novos (continuidade de um pavimento para o outro)
  const ids = new Set(novos.map((e) => e.id));
  const ligacoes = novos.length ? aplicarLigacoes(projeto, detectarLigacoes(projeto, registro).filter((d) => ids.has(d.fonte.id) || ids.has(d.receptor.id))) : 0;
  // projeto que começou vazio: códigos por pavimento (P101, L101…)
  if (plano.vazio && novos.length) renumerar(projeto, registro, { esquema: 'pavimento' });
  return { pavimentos: plano.niveis.filter((n) => !n.pavimento).length, pilares: novos.filter((e) => e.modulo === 'concreto.pilar').length, lajes: novos.filter((e) => e.modulo !== 'concreto.pilar').length, ligacoes, plantas };
}

/** Lê o texto do IFC e monta o plano. */
export const lerPlanoIfc = (projeto, texto, opcoes) => planoIfc(projeto, lerIfc(texto), opcoes);
