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
 * Consistência do modelo antes do cálculo (roteiro, etapa L2). Como nos programas consolidados, nada é calculado
 * enquanto houver algo indefinido na montagem: cada regra é independente e devolve os seus problemas, com o
 * elemento, o pavimento e o ponto da planta onde está o defeito. Erros bloqueiam o cálculo; avisos não.
 *
 * As regras foram escritas para não se repetirem: um elemento solto (sem nenhuma ligação) só aparece como solto, e
 * não também como viga sem apoio, laje com contorno aberto ou pilar sem continuidade.
 */
import {
  tipoDe, pavimento, pavimentoAbaixo, peDireito, eixoViga, bordasLaje, bordaDaLigacao, cantosLaje, contornoPilar,
  centroPilar, secaoViga, detectarLigacoes, ligacoesExistentes, ligacaoExiste, folgasGeometricas, vigaSobApoio,
  apoiosIntermediariosDaEscada, distanciaAoPilar, FUNDACOES_PILAR, NA_MONTAGEM,
} from './montagem.js';
import { cruzamentosDoProjeto, textoCruzamento, definirCruzamento, sugerirCruzamento } from './cruzamentos.js';
import { aplicarLigacoes, limparGeometria } from './montagem.js';

/** As regras, na ordem em que aparecem no painel. */
export const REGRAS = [
  { id: 'carga-inexistente', gravidade: 'erro', nome: 'Carga de elemento inexistente', descricao: 'Uma carga vem de um elemento que foi excluído, ou a fundação aponta para um pilar que não existe mais.' },
  { id: 'pavimento-inexistente', gravidade: 'erro', nome: 'Pavimento inexistente', descricao: 'O elemento está num pavimento que foi excluído.' },
  { id: 'solto', gravidade: 'erro', nome: 'Elemento solto', descricao: 'Posicionado na planta, mas sem nenhuma ligação: não apoia em nada e nada apoia nele.' },
  { id: 'viga-sem-apoio', gravidade: 'erro', nome: 'Viga sem apoio', descricao: 'Um apoio da viga não cai sobre pilar nem sobre outra viga.' },
  { id: 'contorno-aberto', gravidade: 'erro', nome: 'Laje com contorno aberto', descricao: 'Uma borda apoiada da laje não tem viga embaixo (torne-a livre ou coloque a viga).' },
  { id: 'apoio-sem-elemento', gravidade: 'erro', nome: 'Escada ou reservatório sem apoio', descricao: 'Um apoio da escada ou uma parede do reservatório não tem elemento embaixo.' },
  { id: 'sobreposicao', gravidade: 'erro', nome: 'Sobreposição', descricao: 'Dois pilares, duas vigas ou duas lajes do mesmo pavimento ocupam o mesmo lugar.' },
  { id: 'cruzamento-indefinido', gravidade: 'erro', nome: 'Cruzamento indefinido', descricao: 'Duas vigas se cruzam fora de pilar e não foi dito quem apoia em quem (ou se não há transferência).' },
  { id: 'pilar-sem-continuidade', gravidade: 'erro', nome: 'Pilar sem continuidade', descricao: 'A base do pilar não chega a um pilar, viga ou fundação embaixo.' },
  { id: 'ligacao-fora', gravidade: 'aviso', nome: 'Ligação fora da posição', descricao: 'A carga entre dois elementos existe, mas eles não se tocam mais na planta.' },
  { id: 'ligacao-pendente', gravidade: 'erro', nome: 'Ligação não aplicada', descricao: 'A planta indica uma ligação cuja carga ainda não foi aplicada: o elemento de baixo calcularia sem ela (Conectar).' },
  { id: 'folga', gravidade: 'aviso', nome: 'Folga acima da tolerância', descricao: 'Um apoio fica a poucos milímetros do elemento que devia recebê-lo (Limpar geometria ou Encostar).' },
  { id: 'pe-direito', gravidade: 'aviso', nome: 'Pilar fora do pé-direito', descricao: 'O comprimento do pilar é diferente do pé-direito do lance.' },
  { id: 'cruzamento-isolada', gravidade: 'aviso', nome: 'Cruzamento fora da grelha', descricao: 'O cruzamento foi definido, mas o pavimento calcula as vigas isoladas: a viga apoiada não recebe esse apoio (use Grelha).' },
  { id: 'pilar-transicao', gravidade: 'aviso', nome: 'Pilar nascendo em viga', descricao: 'O pilar não continua para baixo: nasce sobre uma viga, que recebe a carga dele concentrada (viga de transição).' },
  { id: 'pilar-sem-carga', gravidade: 'aviso', nome: 'Pilar sem carga', descricao: 'O pilar não recebe viga, laje nem pilar de cima.' },
  { id: 'fundacao-duplicada', gravidade: 'aviso', nome: 'Fundação sob pilar que continua', descricao: 'A fundação está ligada a um pilar que descarrega num pilar de baixo.' },
];
const REGRA = Object.fromEntries(REGRAS.map((r) => [r.id, r]));

const EPS = 1e-7;
const fmt = (v) => (Number.isFinite(v) ? v.toFixed(2).replace('.', ',') : '—');
const natural = (a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true, sensitivity: 'base' });
const centroDe = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

/** Profundidade da sobreposição de dois polígonos convexos (separação de eixos); ≤ 0 se não se sobrepõem. */
function profundidade(A, B) {
  let menor = Infinity;
  for (const P of [A, B]) {
    for (let i = 0; i < P.length; i++) {
      const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % P.length];
      const L = Math.hypot(x1 - x0, y1 - y0);
      if (L < 1e-12) continue;
      const n = [-(y1 - y0) / L, (x1 - x0) / L];
      const proj = (Q) => Q.map((q) => q[0] * n[0] + q[1] * n[1]);
      const a = proj(A), b = proj(B);
      const ov = Math.min(Math.max(...a), Math.max(...b)) - Math.max(Math.min(...a), Math.min(...b));
      if (ov < menor) menor = ov;
      if (menor <= 0) return menor;
    }
  }
  return menor;
}

/**
 * Problemas de consistência do projeto.
 * @returns {{regra:string, gravidade:'erro'|'aviso', elemento:object|null, pavimento:string|null, ponto:number[]|null,
 *   texto:string, relacionados?:string[]}[]}
 */
export function verificarConsistencia(projeto, registro) {
  if (!projeto) return [];
  const els = projeto.elementos ?? [];
  const porId = new Map(els.map((e) => [e.id, e]));
  const tipo = (e) => tipoDe(e, registro);
  const out = [];
  const add = (regra, elemento, texto, extra = {}) => out.push({
    regra, gravidade: REGRA[regra].gravidade, elemento, texto,
    pavimento: elemento?.posicao?.pavimento ?? null, ponto: null, ...extra,
  });

  /* ---------- carga de elemento inexistente (vale também para elementos fora da planta) */
  for (const e of els) {
    for (const c of Array.isArray(e.cargas) ? e.cargas : []) {
      if (c?.tipo === 'elemento' && !porId.has(c.elementoId)) {
        add('carga-inexistente', e, `${e.codigo}: a carga "${c.descricao || c.ligacao || 'de outro elemento'}" vem de um elemento que não existe mais — remova a carga.`, { cargaId: c.id });
      }
    }
    if (FUNDACOES_PILAR.includes(e.modulo) && e.pilarId && !porId.has(e.pilarId)) {
      add('carga-inexistente', e, `${e.codigo}: o pilar ligado a esta fundação não existe mais.`);
    }
  }

  /* ---------- elementos da planta */
  const naPlanta = els.filter((e) => e.posicao && NA_MONTAGEM.includes(tipo(e)));
  const validos = [];
  for (const e of naPlanta) {
    if (!pavimento(projeto, e.posicao.pavimento)) add('pavimento-inexistente', e, `${e.codigo}: o pavimento foi excluído — reposicione o elemento.`, { pavimento: null });
    else validos.push(e);
  }

  // quem recebe cada ligação (fonte|ligação → receptores) e quem tem alguma ligação
  const recebe = new Map();
  const ligado = new Set();
  for (const r of els) {
    for (const c of Array.isArray(r.cargas) ? r.cargas : []) {
      if (c?.tipo !== 'elemento' || !porId.has(c.elementoId)) continue;
      const k = `${c.elementoId}|${c.ligacao}`;
      if (!recebe.has(k)) recebe.set(k, []);
      recebe.get(k).push(r);
      ligado.add(r.id); ligado.add(c.elementoId);
    }
  }
  const fundacaoDe = new Map();
  for (const f of els) if (FUNDACOES_PILAR.includes(f.modulo) && porId.has(f.pilarId)) { fundacaoDe.set(f.pilarId, f); ligado.add(f.pilarId); }
  // viga apoiada em viga: a grelha liga as duas pela geometria
  const sobViga = new Map(); // `${viga.id}|${k}` → viga de baixo
  for (const v of validos.filter((e) => tipo(e) === 'viga')) {
    eixoViga(v).apoios.forEach((_, k) => {
      const o = vigaSobApoio(projeto, registro, v, k);
      if (o) { sobViga.set(`${v.id}|${k}`, o); ligado.add(v.id); ligado.add(o.id); }
    });
  }
  // ligações que a planta indica: o elemento não está solto nem aberto ali — falta só aplicar (regra ligacao-pendente)
  const detectadas = detectarLigacoes(projeto, registro);
  const indicada = new Set();
  for (const d of detectadas) { indicada.add(`${d.fonte.id}|${d.ligacao}`); ligado.add(d.fonte.id); ligado.add(d.receptor.id); }
  const recebida = (e, lig) => (recebe.get(`${e.id}|${lig}`) ?? []).length > 0 || indicada.has(`${e.id}|${lig}`);
  const temFundacao = els.some((e) => FUNDACOES_PILAR.includes(e.modulo));

  for (const e of validos) {
    const t = tipo(e);
    const mod = registro.obter(e.modulo);
    const ligs = mod?.ligacoes?.(e) ?? [];
    if (!ligado.has(e.id)) {
      add('solto', e, `${e.codigo}: posicionado na planta sem nenhuma ligação — não apoia em nada e nada apoia nele.`, { ponto: pontoDe(e, t) });
      continue;
    }
    if (t === 'viga') {
      const eixo = eixoViga(e);
      for (const l of ligs) {
        if (!/^apoio-\d+$/.test(l.id) || recebida(e, l.id)) continue;
        const k = Number(l.id.split('-')[1]);
        if (sobViga.has(`${e.id}|${k}`)) continue;
        const pt = eixo.apoios[k];
        add('viga-sem-apoio', e, `${e.codigo}: apoio ${k + 1} (x = ${fmt(eixo.apoios[k] ? Math.hypot(pt[0] - eixo.a[0], pt[1] - eixo.a[1]) : NaN)} m) não cai sobre pilar nem viga.`, { ponto: pt ?? null, apoio: k });
      }
    } else if (t === 'laje') {
      const bordas = bordasLaje(e);
      const abertas = ligs.filter((l) => l.tipo === 'linear' && !recebida(e, l.id));
      if (abertas.length) {
        const seg = bordas[bordaDaLigacao(abertas[0].id, e)];
        add('contorno-aberto', e, `${e.codigo}: contorno aberto — ${abertas.map((l) => l.nome ?? l.id).join(', ')} sem viga embaixo.`, { ponto: seg ? centroDe(seg) : pontoDe(e, t), bordasAbertas: abertas.map((l) => l.id) });
      }
    } else if (t === 'escada' || t === 'reservatorio') {
      const inter = t === 'escada' ? apoiosIntermediariosDaEscada(projeto, e) : new Set();
      const faltam = ligs.filter((l) => !recebida(e, l.id) && !inter.has(l.id));
      if (faltam.length) add('apoio-sem-elemento', e, `${e.codigo}: ${faltam.map((l) => l.nome ?? l.id).join(', ')} sem elemento de apoio.`, { ponto: pontoDe(e, t) });
    } else if (t === 'pilar') {
      const recebeAlgo = (Array.isArray(e.cargas) ? e.cargas : []).some((c) => c?.tipo === 'elemento' && porId.has(c.elementoId));
      if (!recebeAlgo) add('pilar-sem-carga', e, `${e.codigo}: não recebe viga, laje nem pilar de cima.`, { ponto: centroPilar(e) });
      if (ligs.some((l) => l.id === 'base') && !recebida(e, 'base')) {
        const abaixo = pavimentoAbaixo(projeto, e.posicao.pavimento);
        const fund = fundacaoDe.get(e.id);
        if (!fund && (abaixo || temFundacao)) {
          add('pilar-sem-continuidade', e, abaixo
            ? `${e.codigo}: a base não chega a pilar, viga ou fundação em ${pavimento(projeto, abaixo.id).nome}.`
            : `${e.codigo}: sem fundação (o projeto tem fundações em outros pilares).`, { ponto: centroPilar(e) });
        }
      }
      // transição: a base é recebida por uma viga
      const vigaDeBaixo = (recebe.get(`${e.id}|base`) ?? []).find((r) => tipo(r) === 'viga');
      if (vigaDeBaixo) add('pilar-transicao', e, `${e.codigo} nasce sobre ${vigaDeBaixo.codigo} (viga de transição) — confira a viga e a ligação.`, { ponto: centroPilar(e), relacionados: [vigaDeBaixo.id] });
      const pd = peDireito(projeto, e.posicao.pavimento);
      if (pd > 0 && Math.abs((e.comprimento ?? 0) - pd) > 0.005) {
        add('pe-direito', e, `${e.codigo}: comprimento ${fmt(e.comprimento)} m diferente do pé-direito ${fmt(pd)} m do lance.`, { ponto: centroPilar(e), ajustarComprimento: pd });
      }
    }
  }

  /* ---------- cruzamentos de vigas fora de pilar: quem apoia em quem */
  for (const c of cruzamentosDoProjeto(projeto, registro)) {
    if (!c.valor) {
      add('cruzamento-indefinido', c.b, `${c.a.codigo} × ${c.b.codigo}: cruzamento sem definição — diga quem apoia em quem ou se não há transferência.`, { ponto: c.ponto, pavimento: c.pavimento, relacionados: [c.a.id], cruzamento: c });
    } else if (c.apoiada && !c.implicito && pavimento(projeto, c.pavimento)?.analise !== 'grelha') {
      add('cruzamento-isolada', c.apoiada, `${textoCruzamento(c)}, mas o pavimento calcula as vigas isoladas — ${c.apoiada.codigo} é calculada sem esse apoio. Use Grelha no pavimento.`, { ponto: c.ponto, pavimento: c.pavimento, cruzamento: c });
    }
  }

  /* ---------- fundação ligada a um pilar que continua para baixo */
  for (const [pilarId, f] of fundacaoDe) {
    if ((recebe.get(`${pilarId}|base`) ?? []).length) {
      const p = porId.get(pilarId);
      add('fundacao-duplicada', f, `${f.codigo}: ${p.codigo} descarrega num pilar de baixo, não na fundação.`, { pavimento: p.posicao?.pavimento ?? null, ponto: p.posicao ? centroPilar(p) : null, alvo: p });
    }
  }

  /* ---------- sobreposições no mesmo pavimento */
  const porPav = new Map();
  for (const e of validos) {
    const k = `${e.posicao.pavimento}|${tipo(e)}`;
    if (!porPav.has(k)) porPav.set(k, []);
    porPav.get(k).push(e);
  }
  for (const [k, lista] of porPav) {
    const t = k.split('|')[1];
    if (!['pilar', 'viga', 'laje'].includes(t)) continue;
    const ord = [...lista].sort((a, b) => natural(a.codigo, b.codigo));
    const pilaresDoPav = porPav.get(`${k.split('|')[0]}|pilar`) ?? [];
    for (let i = 0; i < ord.length; i++) {
      for (let j = i + 1; j < ord.length; j++) {
        const a = ord[i], b = ord[j];
        const r = sobrepostos(a, b, t, pilaresDoPav);
        if (r) add('sobreposicao', b, `${b.codigo} sobreposto a ${a.codigo}${r.texto}.`, { ponto: r.ponto, relacionados: [a.id] });
      }
    }
  }

  /* ---------- ligações: fora da posição, indicadas e não aplicadas; folgas */
  for (const x of ligacoesExistentes(projeto, registro, detectadas)) {
    if (x.situacao === 'fora') add('ligacao-fora', x.receptor, `Ligação ${x.texto} não confere com a posição na planta.`, { relacionados: [x.fonte.id], ponto: pontoDe(x.fonte, tipo(x.fonte)), cargaId: x.carga.id });
  }
  for (const d of detectadas) {
    if (!ligacaoExiste(d.receptor, d)) add('ligacao-pendente', d.receptor, `Ligação ${d.texto} indicada pela planta e não aplicada.`, { relacionados: [d.fonte.id], ponto: pontoDe(d.fonte, tipo(d.fonte)), ligacao: d });
  }
  for (const f of folgasGeometricas(projeto, registro)) {
    const pt = f.apoio != null ? eixoViga(f.elemento).apoios[f.apoio] : centroPilar(f.elemento);
    add('folga', f.elemento, f.texto, { ponto: pt, folga: f });
  }
  return out;
}

/** Ponto representativo de um elemento na planta (para o zoom). */
function pontoDe(e, t) {
  if (!e?.posicao) return null;
  if (t === 'viga') { const { a, b } = eixoViga(e); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
  if (t === 'laje' || t === 'reservatorio') return centroDe(cantosLaje(e));
  return [e.posicao.x ?? 0, e.posicao.y ?? 0];
}

/** Dois elementos do mesmo tipo e pavimento ocupam o mesmo lugar? {texto, ponto} ou null. */
function sobrepostos(a, b, t, pilares) {
  if (t === 'pilar') {
    const d = profundidade(contornoPilar(a), contornoPilar(b));
    return d > 0.005 ? { texto: '', ponto: centroPilar(b) } : null;
  }
  if (t === 'laje') {
    const d = profundidade(cantosLaje(a), cantosLaje(b));
    return d > 0.02 ? { texto: ` (${Math.round(d * 100)} cm)`, ponto: centroDe(cantosLaje(b)) } : null;
  }
  // vigas: paralelas, com as larguras se cruzando e um trecho comum fora dos pilares
  const ea = eixoViga(a), eb = eixoViga(b);
  if (Math.abs(ea.u[0] * eb.u[1] - ea.u[1] * eb.u[0]) > 0.01) return null;
  const n = [-ea.u[1], ea.u[0]];
  const desvio = Math.abs((eb.a[0] - ea.a[0]) * n[0] + (eb.a[1] - ea.a[1]) * n[1]);
  if (desvio >= (secaoViga(a).b + secaoViga(b).b) / 200 - 0.005) return null;
  const s = (p) => (p[0] - ea.a[0]) * ea.u[0] + (p[1] - ea.a[1]) * ea.u[1];
  const s0 = Math.max(0, Math.min(s(eb.a), s(eb.b))), s1 = Math.min(ea.L, Math.max(s(eb.a), s(eb.b)));
  if (s1 - s0 <= 0.05 + EPS) return null;
  const meio = [ea.a[0] + ea.u[0] * (s0 + s1) / 2, ea.a[1] + ea.u[1] * (s0 + s1) / 2];
  // o trecho comum dentro de um pilar é o encontro normal de duas vigas em linha
  if (pilares.some((p) => distanciaAoPilar(meio, p).dentro)) return null;
  return { texto: ` (${fmt(s1 - s0)} m em comum)`, ponto: meio };
}

/** Resumo: erros e avisos. */
export function contarProblemas(lista) {
  return { erros: lista.filter((p) => p.gravidade === 'erro').length, avisos: lista.filter((p) => p.gravidade === 'aviso').length };
}

/**
 * Problemas agrupados por pavimento (de cima para baixo, e por último os sem pavimento), erros antes dos avisos.
 * @returns {{pavimento: object|null, nome: string, problemas: object[]}[]}
 */
export function problemasPorPavimento(projeto, lista) {
  const pavs = [...(projeto?.pavimentos ?? [])].sort((a, b) => b.cota - a.cota);
  const ordem = (p) => (p.gravidade === 'erro' ? 0 : 1) * 100 + REGRAS.findIndex((r) => r.id === p.regra);
  const grupos = pavs.map((pv) => ({ pavimento: pv, nome: pv.nome, problemas: lista.filter((p) => p.pavimento === pv.id) }));
  grupos.push({ pavimento: null, nome: 'Fora da planta', problemas: lista.filter((p) => !pavs.some((pv) => pv.id === p.pavimento)) });
  for (const g of grupos) g.problemas.sort((a, b) => ordem(a) - ordem(b) || natural(a.elemento?.codigo ?? '', b.elemento?.codigo ?? ''));
  return grupos.filter((g) => g.problemas.length);
}

/** Problemas que bloqueiam o cálculo de um elemento (só os erros do próprio elemento). */
export const errosDoElemento = (lista, id) => lista.filter((p) => p.gravidade === 'erro' && p.elemento?.id === id);

/* ------------------------------------------------------------------ correções automáticas */

const elDe = (proj, id) => proj.elementos.find((e) => e.id === id);
const invalidar = (el) => { if (el?.resultado) el.resultado.desatualizado = true; };
const tirarCarga = (proj, elId, cargaId) => { const r = elDe(proj, elId); if (!r || !Array.isArray(r.cargas)) return; r.cargas = r.cargas.filter((c) => c.id !== cargaId); invalidar(r); };

/**
 * Correção de um problema, quando há uma que dispensa decisão do engenheiro: { rotulo, descricao, aplicar(proj, registro) }.
 * `aplicar` altera o projeto no lugar (dentro de estado.alterar).
 */
export function correcaoDe(p) {
  const id = p.elemento?.id;
  switch (p.regra) {
    case 'ligacao-fora': return { rotulo: 'Desfazer ligação', descricao: 'Remove a carga que não confere mais com a planta; se os elementos se tocarem de outro jeito, Conectar refaz a ligação certa.', aplicar: (proj) => tirarCarga(proj, id, p.cargaId) };
    case 'carga-inexistente': return p.cargaId ? { rotulo: 'Remover carga', descricao: 'Remove a carga do elemento excluído.', aplicar: (proj) => tirarCarga(proj, id, p.cargaId) } : null;
    case 'ligacao-pendente': return { rotulo: 'Conectar', descricao: 'Aplica a ligação que a planta indica.', aplicar: (proj) => aplicarLigacoes(proj, [p.ligacao]) };
    case 'folga': return p.folga?.encostar ? { rotulo: 'Encostar', descricao: 'Leva o apoio até o elemento ao lado, ao longo do eixo.', aplicar: (proj, reg) => { for (const c of limparGeometria(proj, reg, { tol: p.folga.distancia + 1e-6, filtro: (el, k) => el.id === id && k === p.folga.apoio })) invalidar(c.elemento); } } : null;
    case 'pe-direito': return { rotulo: `Usar ${fmt(p.ajustarComprimento)} m`, descricao: 'Ajusta o comprimento do pilar ao pé-direito do lance.', aplicar: (proj) => { const e = elDe(proj, id); if (e) { e.comprimento = p.ajustarComprimento; invalidar(e); } } };
    case 'cruzamento-indefinido': {
      const c = p.cruzamento, sug = sugerirCruzamento(c);
      const [ap, ao] = sug === c.a.id ? [c.a, c.b] : [c.b, c.a];
      return { rotulo: `${ap.codigo} apoia em ${ao.codigo}`, descricao: 'A viga mais rígida (b·h³/L³) fica como apoio da outra.', aplicar: (proj) => definirCruzamento(proj, c.pavimento, c.chave, sug) };
    }
    // estas mudam o modelo: ficam como botão no problema, mas fora do "Resolver automaticamente"
    case 'contorno-aberto': return p.bordasAbertas?.length ? { automatica: false, rotulo: 'Tornar borda livre', descricao: 'A borda sem viga passa a ser livre (sem apoio) na laje. Use se for mesmo um balanço; senão, lance a viga que falta.', aplicar: (proj) => { const e = elDe(proj, id); if (!e) return; for (const b of p.bordasAbertas) { const k = bordaDaLigacao(b, e); if (e.bordas && k in e.bordas) e.bordas[k] = 'livre'; } invalidar(e); } } : null;
    case 'viga-sem-apoio': return p.apoio != null ? { automatica: false, rotulo: 'Tornar balanço', descricao: 'O apoio que não cai em nada vira ponta livre (balanço). Use se for mesmo um balanço; senão, mova a viga ou lance o pilar.', aplicar: (proj) => { const e = elDe(proj, id); if (e?.apoios?.[p.apoio] != null) { e.apoios[p.apoio] = 'livre'; invalidar(e); } } } : null;
    case 'solto': return { automatica: false, rotulo: 'Retirar da planta', descricao: 'O elemento volta para "Não posicionados" (não é apagado).', aplicar: (proj) => { const e = elDe(proj, id); if (e) delete e.posicao; } };
    case 'pavimento-inexistente': return { rotulo: 'Retirar da planta', descricao: 'O elemento volta para "Não posicionados" na montagem.', aplicar: (proj) => { const e = elDe(proj, id); if (e) delete e.posicao; } };
    default: return null;
  }
}

/**
 * Resolver tudo o que é automático: aplica as correções na ordem certa (tira as ligações erradas, ajusta a geometria,
 * define os cruzamentos e, por fim, conecta o que a planta indica). Altera o projeto no lugar.
 * @returns {{feitas:number, textos:string[], restantes:number}}
 */
export function resolverAutomaticamente(projeto, registro) {
  const ordem = ['ligacao-fora', 'carga-inexistente', 'pavimento-inexistente', 'folga', 'pe-direito', 'cruzamento-indefinido'];
  const textos = [];
  let feitas = 0;
  for (const regra of ordem) {
    for (const p of verificarConsistencia(projeto, registro).filter((x) => x.regra === regra)) {
      const c = correcaoDe(p);
      if (!c || c.automatica === false) continue;
      c.aplicar(projeto, registro);
      feitas++; textos.push(`${c.rotulo}: ${p.texto}`);
    }
  }
  // por último, as ligações que a planta indica (inclusive as que as correções acima revelaram)
  const pend = verificarConsistencia(projeto, registro).filter((x) => x.regra === 'ligacao-pendente');
  if (pend.length) { aplicarLigacoes(projeto, pend.map((x) => x.ligacao)); feitas += pend.length; textos.push(...pend.map((x) => `Conectar: ${x.texto}`)); }
  return { feitas, textos, restantes: verificarConsistencia(projeto, registro).length };
}

/** Quantos problemas da lista têm correção automática. */
export const corrigiveis = (lista) => lista.filter((p) => { const c = correcaoDe(p); return c && c.automatica !== false; }).length;
