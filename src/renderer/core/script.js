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
 * API de script do console — funções em português para criar e editar a estrutura por
 * linha de comando (JavaScript). Exemplos:
 *
 *   viga({ codigo: 'V7', b: 15, h: 40, vaos: [4, 3.5], g: 5, pavimento: 'Cobertura', x: 0, y: 5 })
 *   laje({ lx: 4, ly: 5, h: 10, bordas: 'aaea', acidental: 2 })
 *   pilar({ bx: 20, by: 30, N: 300, em: [0, 0] })
 *   for (let i = 0; i < 4; i++) pilar({ em: [i * 4, 0] })
 *   calcular()        conectar()        elementos('V')
 *
 * Toda alteração passa por estado.alterar(), então entra no desfazer/refazer como qualquer
 * edição feita pela interface.
 */
import { pavimentosOrdenados, peDireito, tipoDe, detectarLigacoes, aplicarLigacoes, novoIdPavimento } from './montagem.js';
import { novoId, proximoCodigo } from './projeto.js';
import { CODIGO_VALIDO, compararCodigos } from './formatar.js';
import { analisarPortico, ModeloPortico, exemploPortico } from '../../engine/portico.js';
import { grelhaDoPavimento } from '../../modules/comum/grelha.js';
import { porticoDoEdificio, ventoDoProjeto } from '../../modules/comum/portico-edificio.js';

/** Nomes curtos aceitos em criar(tipo, …), além do id do módulo, da sigla e do prefixo. */
export const APELIDOS = {
  viga: 'concreto.viga', laje: 'concreto.laje.macica', macica: 'concreto.laje.macica', pilar: 'concreto.pilar',
  trelicada: 'concreto.laje.trelicada', nervurada: 'concreto.laje.nervurada', alveolar: 'concreto.laje.alveolar',
  'viga-madeira': 'madeira.viga', 'pilar-madeira': 'madeira.pilar', entrepiso: 'madeira.entrepiso',
};

const VINCULO_LETRA = { a: 'apoiada', e: 'engastada', l: 'livre' };
const APOIO_LETRA = { a: 'apoio', e: 'engaste', l: 'livre' };
const ehObjeto = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** Mescla `fonte` em `alvo` (objetos em profundidade; listas e valores simples substituem). */
export function mesclar(alvo, fonte) {
  for (const [k, v] of Object.entries(fonte ?? {})) {
    if (v === undefined) continue;
    if (ehObjeto(v) && ehObjeto(alvo[k])) mesclar(alvo[k], v);
    else alvo[k] = ehObjeto(v) ? structuredClone(v) : Array.isArray(v) ? structuredClone(v) : v;
  }
  return alvo;
}

const idCarga = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/**
 * Converte os atalhos do console nos campos do módulo.
 * Retorna { campos, posicao } — `posicao` reúne pavimento, x, y, angulo e em.
 */
export function normalizarPropriedades(props = {}, mod, el) {
  const p = { ...props };
  const posicao = {};
  for (const k of ['pavimento', 'x', 'y', 'angulo', 'em']) if (k in p) { posicao[k] = p[k]; delete p[k]; }
  delete p.codigo; delete p.nome;
  const cat = mod.categoria;

  // cargas por m² das lajes
  for (const k of ['revestimento', 'acidental', 'outras', 'forro']) {
    if (k in p && typeof p[k] === 'number' && cat === 'lajes') { (p.cargas ??= {})[k] = p[k]; delete p[k]; }
  }
  if (cat === 'vigas') {
    if ('b' in p || 'h' in p) { p.secao = { ...(el.secao ?? {}), ...(p.secao ?? {}), ...('b' in p ? { b: p.b } : {}), ...('h' in p ? { h: p.h } : {}) }; delete p.b; delete p.h; }
    if (Array.isArray(p.vaos)) {
      p.vaos = p.vaos.map((v) => (typeof v === 'number' ? { L: v } : v));
      if (!p.apoios) p.apoios = Array(p.vaos.length + 1).fill('apoio');
    }
    if (typeof p.apoios === 'string') p.apoios = [...p.apoios].map((c) => APOIO_LETRA[c.toLowerCase()] ?? 'apoio');
    const extra = [];
    for (const nat of ['g', 'q']) {
      if (typeof p[nat] === 'number') { extra.push({ id: idCarga(), tipo: 'distribuida', natureza: nat, valor: p[nat], vao: 'todos', descricao: nat === 'g' ? 'Permanente (console)' : 'Variável (console)' }); delete p[nat]; }
    }
    if (extra.length) p.cargas = [...(Array.isArray(p.cargas) ? p.cargas : el.cargas ?? []), ...extra];
  }
  if (cat === 'pilares') {
    if ('L' in p) { p.comprimento = p.L; delete p.L; }
    const extra = [];
    for (const [k, nat] of [['N', 'g'], ['Ng', 'g'], ['Nq', 'q']]) {
      if (typeof p[k] === 'number') { extra.push({ id: idCarga(), tipo: 'concentrada', natureza: nat, valor: p[k], descricao: nat === 'g' ? 'Normal permanente (console)' : 'Normal variável (console)' }); delete p[k]; }
    }
    if (extra.length) p.cargas = [...(Array.isArray(p.cargas) ? p.cargas : []), ...extra];
  }
  if (cat === 'lajes' && p.bordas != null) {
    const b = p.bordas;
    if (typeof b === 'string' && /^[ael]{4}$/i.test(b)) {
      const [x0, x1, y0, y1] = [...b.toLowerCase()].map((c) => VINCULO_LETRA[c]);
      p.bordas = { x0, x1, y0, y1 };
    } else if (typeof b === 'string') {
      p.bordas = { x0: b, x1: b, y0: b, y1: b };
    }
  }
  if (Array.isArray(p.cargas)) p.cargas = p.cargas.map((c) => (ehObjeto(c) && !c.id ? { id: idCarga(), ...c } : c));
  return { campos: p, posicao };
}

/**
 * Cria a API do console.
 * @param {object} dep
 * @param {object} dep.estado        estado global (projeto, alterar, desfazer…)
 * @param {object} dep.modulos       registro de módulos
 * @param {object} [dep.acoes]       ações da interface: calcular(id), calcularTodos(), abrirElemento(id), abrirMontagem(id), abrir3D()
 * @param {(texto:string, tipo?:string) => void} dep.imprimir
 */
export function criarApiScript({ estado, modulos, acoes = {}, imprimir = () => {} }) {
  const projeto = () => {
    if (!estado.projeto) throw new Error('Nenhum projeto aberto. Crie ou abra um projeto primeiro.');
    return estado.projeto;
  };
  const moduloDe = (tipo) => {
    const t = String(tipo ?? '').trim();
    const lista = modulos.lista();
    const m = modulos.obter(APELIDOS[t.toLowerCase()] ?? t)
      ?? lista.find((x) => x.sigla === t.toUpperCase())
      ?? lista.find((x) => x.prefixo.toUpperCase() === t.toUpperCase());
    if (!m) throw new Error(`Tipo "${tipo}" desconhecido. Use modulos() para ver os tipos (ex.: 'viga', 'laje', 'pilar', 'CL2', 'concreto.laje.trelicada').`);
    return m;
  };
  const achar = (ref) => {
    const p = projeto();
    if (ehObjeto(ref) && ref.id) ref = ref.id;
    const r = String(ref ?? '');
    const el = p.elementos.find((e) => e.id === r) ?? p.elementos.find((e) => e.codigo.toLowerCase() === r.toLowerCase());
    if (!el) throw new Error(`Elemento "${ref}" não encontrado.`);
    return el;
  };
  const acharPavimento = (ref) => {
    const p = projeto();
    if (ref == null) {
      const ord = pavimentosOrdenados(p);
      return ord[ord.length - 1];
    }
    const r = String(ref).toLowerCase();
    const pv = p.pavimentos.find((x) => x.id.toLowerCase() === r || x.nome.toLowerCase() === r);
    if (!pv) throw new Error(`Pavimento "${ref}" não existe. Use pavimentos() para listar ou pavimento('Nome', cota) para criar.`);
    return pv;
  };
  const validarCodigo = (codigo, id) => {
    if (!CODIGO_VALIDO.test(codigo)) throw new Error(`Código "${codigo}" inválido: até 12 caracteres — letras, algarismos, hífen, ponto ou barra.`);
    const outro = projeto().elementos.find((e) => e.id !== id && e.codigo.toLowerCase() === codigo.toLowerCase());
    if (outro) throw new Error(`O código ${codigo} já existe.`);
  };
  const posicaoDe = (pos, el, p) => {
    if (!Object.keys(pos).length) return undefined;
    const pv = acharPavimento(pos.pavimento ?? el.posicao?.pavimento);
    const [ex, ey] = Array.isArray(pos.em) ? pos.em : [];
    return { pavimento: pv.id, x: Number(pos.x ?? ex ?? el.posicao?.x ?? 0), y: Number(pos.y ?? ey ?? el.posicao?.y ?? 0), angulo: Number(pos.angulo ?? el.posicao?.angulo ?? 0) };
  };

  /** Resumo legível de um elemento (o que o console mostra). */
  const resumo = (el) => {
    const mod = modulos.obter(el.modulo);
    const pv = el.posicao && projeto().pavimentos.find((x) => x.id === el.posicao.pavimento);
    const r = el.resultado;
    return {
      codigo: el.codigo, nome: el.nome, tipo: mod?.nomeCurto ?? mod?.nome ?? el.modulo,
      pavimento: pv?.nome ?? null, posicao: el.posicao ? [el.posicao.x, el.posicao.y, el.posicao.angulo ?? 0] : null,
      situacao: !r ? 'não calculado' : r.erro ? `erro: ${r.erro}` : r.desatualizado ? 'desatualizado' : r.ok ? 'atende' : 'não atende',
      dados: (() => { try { return mod?.resumo?.(el) ?? ''; } catch { return ''; } })(),
    };
  };

  function criar(tipo, props = {}) {
    const p = projeto();
    const mod = moduloDe(tipo);
    const codigo = props.codigo != null ? String(props.codigo).trim() : proximoCodigo(p, mod.prefixo);
    validarCodigo(codigo, null);
    const el = { id: novoId(mod.prefixo.toLowerCase()), modulo: mod.id, codigo, nome: props.nome ?? codigo, ...mod.criar(p), resultado: null };
    const { campos, posicao } = normalizarPropriedades(props, mod, el);
    mesclar(el, campos);
    const pos = posicaoDe(posicao, el, p);
    if (pos) {
      el.posicao = pos;
      const pd = peDireito(p, pos.pavimento);
      if (tipoDe(el, modulos) === 'pilar' && !('comprimento' in campos) && pd > 0 && el.comprimento != null) el.comprimento = pd;
    }
    estado.alterar((pp) => pp.elementos.push(el), { descricao: `Criar ${codigo} (console)`, estrutural: true, elementoId: el.id, invalidar: false });
    return resumo(el);
  }

  const atalho = (id) => (props = {}) => criar(id, props);

  const api = {
    /** Lista os comandos. */
    ajuda() {
      imprimir(TEXTO_AJUDA, 'ajuda');
    },
    /** Tipos de elemento disponíveis. */
    modulos: () => modulos.lista().map((m) => ({ sigla: m.sigla, tipo: Object.keys(APELIDOS).find((k) => APELIDOS[k] === m.id) ?? m.id, nome: m.nome, prefixo: m.prefixo })),
    criar,
    viga: atalho('concreto.viga'),
    laje: atalho('concreto.laje.macica'),
    pilar: atalho('concreto.pilar'),
    trelicada: atalho('concreto.laje.trelicada'),
    nervurada: atalho('concreto.laje.nervurada'),
    alveolar: atalho('concreto.laje.alveolar'),
    vigaMadeira: atalho('madeira.viga'),
    pilarMadeira: atalho('madeira.pilar'),
    entrepiso: atalho('madeira.entrepiso'),

    /** Lista elementos; o filtro é o início do código ('V'), a categoria ('vigas') ou uma função. */
    elementos(filtro) {
      let lista = [...projeto().elementos];
      if (typeof filtro === 'function') lista = lista.filter(filtro);
      else if (filtro) {
        const f = String(filtro).toLowerCase();
        lista = lista.filter((e) => modulos.obter(e.modulo)?.categoria === f || e.codigo.toLowerCase().startsWith(f) || e.modulo === f);
      }
      return lista.sort((a, b) => compararCodigos(a.codigo, b.codigo)).map(resumo);
    },
    /** O elemento do projeto (objeto completo, só leitura — para mudar use alterar). */
    elemento: (ref) => structuredClone(achar(ref)),
    /** Altera um elemento: alterar('V1', e => { e.secao.h = 50 }) ou alterar('V1', { h: 50 }). */
    alterar(ref, mudanca) {
      const el = achar(ref);
      const mod = modulos.obter(el.modulo);
      if (ehObjeto(mudanca) && mudanca.codigo != null && String(mudanca.codigo) !== el.codigo) validarCodigo(String(mudanca.codigo).trim(), el.id);
      if (ehObjeto(mudanca) && 'pavimento' in mudanca) acharPavimento(mudanca.pavimento); // erro antes de alterar
      estado.alterar((p) => {
        const e = p.elementos.find((x) => x.id === el.id);
        if (typeof mudanca === 'function') mudanca(e);
        else {
          const { campos, posicao } = normalizarPropriedades(mudanca, mod, e);
          mesclar(e, campos);
          const pos = posicaoDe(posicao, e, p);
          if (pos) e.posicao = pos;
          if (mudanca?.nome != null) e.nome = String(mudanca.nome);
          if (mudanca?.codigo != null) e.codigo = String(mudanca.codigo).trim();
        }
      }, { descricao: `Alterar ${el.codigo} (console)`, estrutural: true, elementoId: el.id });
      return resumo(achar(el.id));
    },
    /** Coloca ou move o elemento na planta: mover('P1', 4, 0) ou mover('V1', 0, 5, 90, 'Cobertura'). */
    mover(ref, x, y, angulo, pavimento) {
      const el = achar(ref);
      return api.alterar(el.id, { x, y, ...(angulo != null ? { angulo } : {}), ...(pavimento != null ? { pavimento } : {}) });
    },
    renomear(ref, codigo, nome) {
      const el = achar(ref);
      return api.alterar(el.id, { codigo, ...(nome != null ? { nome } : el.nome === el.codigo ? { nome: codigo } : {}) });
    },
    duplicar(ref) {
      const c = estado.duplicarElemento(achar(ref).id);
      return c ? resumo(c) : null;
    },
    excluir(ref) {
      const el = achar(ref);
      estado.removerElemento(el.id);
      return `${el.codigo} excluído.`;
    },

    /** Calcula um elemento (ou todos, sem argumento) e devolve a situação. */
    calcular(ref) {
      if (ref == null) {
        acoes.calcularTodos?.();
        return projeto().elementos.map(resumo).map(({ codigo, situacao }) => `${codigo}: ${situacao}`);
      }
      const el = achar(ref);
      const r = acoes.calcular ? acoes.calcular(el.id) : null;
      const res = r ?? achar(el.id).resultado;
      return { ...resumo(achar(el.id)), falhas: (res?.verificacoes ?? []).filter((v) => !v.ok).map((v) => v.nome) };
    },
    /** Resultado completo do último cálculo. */
    resultado: (ref) => structuredClone(achar(ref).resultado),

    /** Cria as ligações que a planta indica (laje → viga → pilar → pilar). */
    conectar() {
      const det = detectarLigacoes(projeto(), modulos);
      let n = 0;
      estado.alterar((p) => { n = aplicarLigacoes(p, det); }, { descricao: 'Conectar (console)', estrutural: true, invalidar: false });
      return `${n} ligação(ões) criada(s).`;
    },
    /** Lista os pavimentos de cima para baixo. */
    pavimentos: () => [...pavimentosOrdenados(projeto())].reverse().map((pv) => ({ nome: pv.nome, cota: pv.cota, peDireito: peDireito(projeto(), pv.id), elementos: projeto().elementos.filter((e) => e.posicao?.pavimento === pv.id).length })),
    /** Cria um pavimento (ou altera a cota de um existente): pavimento('2º pavimento', 5.6). */
    pavimento(nome, cota) {
      const p = projeto();
      const existente = p.pavimentos.find((x) => x.nome.toLowerCase() === String(nome).toLowerCase());
      if (existente) {
        if (cota != null) estado.alterar((pp) => { pp.pavimentos.find((x) => x.id === existente.id).cota = Number(cota); }, { descricao: 'Cota do pavimento (console)', estrutural: true });
        return { nome: existente.nome, cota: cota ?? existente.cota };
      }
      const ord = pavimentosOrdenados(p);
      const nova = { id: novoIdPavimento(), nome: String(nome), cota: Number(cota ?? Math.round(((ord[ord.length - 1]?.cota ?? 0) + 2.8) * 100) / 100) };
      estado.alterar((pp) => pp.pavimentos.push(nova), { descricao: `Criar ${nova.nome} (console)`, estrutural: true });
      return { nome: nova.nome, cota: nova.cota };
    },

    /**
     * Pórtico espacial avulso (não altera o projeto):
     *   portico({ nos: [...], barras: [...], cargas: [...] })  → resolve e devolve o resultado
     *   m = portico({ material: { fck: 30 } })                  → modelo vazio para montar com .no(), .barra()…
     */
    portico(dados = {}) {
      if (Array.isArray(dados?.nos) && Array.isArray(dados?.barras)) return analisarPortico(dados);
      return new ModeloPortico(dados);
    },
    /** Grelha das vigas de um pavimento (sem argumento: o mais alto): nós, reações e esforços. */
    grelha(pav) {
      const pv = acharPavimento(pav);
      const g = grelhaDoPavimento(projeto(), pv.id, modulos);
      if (g.erro) throw new Error(`Grelha de ${pv.nome}: ${g.erro}`);
      return g.resultado;
    },
    /** Pórtico espacial do edifício montado a partir da planta (todos os pavimentos). */
    porticoEdificio() {
      const g = porticoDoEdificio(projeto(), modulos);
      if (g.erro) throw new Error(`Pórtico do edifício: ${g.erro}`);
      return g.resultado;
    },
    /** Forças de vento por pavimento (NBR 6123) com os parâmetros do projeto. */
    vento() {
      const v = ventoDoProjeto(projeto(), modulos);
      if (v.erro) throw new Error(`Vento: ${v.erro}`);
      const { planta, parametros, ...resto } = v; // eslint-disable-line no-unused-vars
      return resto;
    },
    /** Estabilidade global: desaprumo, α e γz nas duas direções (NBR 6118, 11.3.3.4.1 e 15.5). */
    estabilidade() {
      const g = porticoDoEdificio(projeto(), modulos);
      if (g.erro) throw new Error(`Pórtico do edifício: ${g.erro}`);
      const d = (x) => x && { acao: x.acao, alfa: x.alfa, alfa1: x.alfa1, gz: x.gz, classe: x.classe, fator: x.fator, comb: x.comb, erro: x.erro };
      return { desaprumo: g.horizontais.desaprumo, x: d(g.estabilidade.x), y: d(g.estabilidade.y), avisos: [...g.estabilidade.avisos, ...g.estabilidade.notas] };
    },
    /** Resolve o pórtico de exemplo (2 pilares e 1 viga) e mostra deslocamentos, reações e esforços. */
    porticoExemplo: () => exemploPortico().resolver(),
    abrir(ref) { acoes.abrirElemento?.(achar(ref).id); },
    montagem(ref) { acoes.abrirMontagem?.(ref != null ? achar(ref).id : undefined); },
    ver3d() { acoes.abrir3D?.(); },
    desfazer() { estado.desfazer(); },
    refazer() { estado.refazer(); },
    get projeto() { return structuredClone(projeto()); },
  };
  return api;
}

export const TEXTO_AJUDA = `Console do LEBR — JavaScript com funções para montar a estrutura.

CRIAR (posição opcional: pavimento, x, y, angulo ou em: [x, y])
  viga({ codigo: 'V7', b: 15, h: 40, vaos: [4, 3.5], apoios: 'aaa', g: 5, q: 2, x: 0, y: 5 })
  laje({ lx: 4, ly: 5, h: 10, bordas: 'aeaa', revestimento: 1, acidental: 1.5, em: [0, 0] })
  pilar({ bx: 20, by: 30, N: 300, Nq: 50, em: [0, 0] })
  trelicada({ L: 3.5, largura: 4, direcao: 'y' })   nervurada({ lx: 6, ly: 7 })   alveolar({ L: 7 })
  vigaMadeira({ b: 6, h: 24, vaos: [3] })   pilarMadeira({ b: 10, h: 10 })   entrepiso({ L: 3.6 })
  criar('CL2', { ... })        tipo pelo apelido, sigla, prefixo ou id do módulo
  bordas: 4 letras na ordem esquerda, direita, inferior, superior — a apoiada, e engastada, l livre
  apoios da viga: uma letra por apoio — a apoio, e engaste, l livre

EDITAR
  alterar('V7', { h: 50 })     alterar('V7', e => { e.secao.b = 20 })
  mover('P1', 4, 0)            renomear('V7', 'V10')   duplicar('V1')   excluir('V7')

CONSULTAR E CALCULAR
  elementos()  elementos('V')  elementos('lajes')  elemento('V1')  modulos()
  calcular('V1')   calcular()   resultado('V1')
  pavimentos()   pavimento('2º pavimento', 5.6)   conectar()
  abrir('V1')   montagem()   ver3d()   desfazer()   refazer()   limpar()

PÓRTICO ESPACIAL (análise avulsa: m, kN, kN·m; não altera o projeto)
  porticoExemplo()             resolve um pórtico de 2 pilares e 1 viga e mostra os resultados
  grelha('1º pavimento')       grelha das vigas do pavimento (casos G e Q) montada a partir da planta
  porticoEdificio()            pórtico espacial do edifício inteiro (vigas, pilares, diafragmas; com o vento, casos V1 a V4)
  vento()                      forças de vento por pavimento (NBR 6123) com os parâmetros do projeto
  estabilidade()               desaprumo, α e γz nas duas direções (NBR 6118, 11.3.3.4.1 e 15.5)
  m = portico({ material: { fck: 25 } })
  m.no('A', 0, 0, 0, 'engaste'); m.no('B', 0, 0, 3); m.no('C', 6, 0, 3); m.no('D', 6, 0, 0, 'engaste')
  m.barra('P1', 'A', 'B', { secao: [20, 40] }); m.barra('V1', 'B', 'C', { secao: [15, 50] }); m.barra('P2', 'D', 'C', { secao: [20, 40] })
  m.q('V1', -12, 'G'); m.carga('B', { Fx: 8 }, 'V'); r = m.resolver()
  r.no('B')   r.reacao('A')   r.barra('V1')   r.barra('V1', 3)   r.combinar({ G: 1.4, V: 0.84 })
  apoios: 'engaste', 'apoio' (rótula), 'livre' ou '111000' · rótula na barra: { rotula: 'i' | 'j' | 'ambas' }
  Z é vertical; secao [b, h] em cm com h na direção y local (vertical nas vigas, X nos pilares)

JavaScript completo: laços, variáveis e funções.
  for (let i = 0; i < 4; i++) pilar({ em: [i * 4, 0] })
Variáveis guardadas entre comandos: atribua sem var/let/const (ex.: v = viga({ vaos: [5] })).
↑ ↓ percorrem o histórico · Shift+Enter quebra a linha · Ctrl+L limpa.`;
