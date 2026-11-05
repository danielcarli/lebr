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
 * Componentes visuais do LEBR.
 *
 * A linguagem visual segue as referências do projeto:
 *   - fichas de catálogo (rótulos terracota, valores em caixa alta, filetes finos);
 *   - cartões de painel (número grande à esquerda, instrumento à direita);
 *   - grade de pontos (calendário) para mapas de resultados.
 *
 * Os componentes são funções que devolvem elementos DOM.
 */
import { emMilimetros, converterCelula } from '../core/unidades.js';
import { h, s } from './dom.js';
import { icone } from './icones.js';
import { lerNumero } from '../core/formatar.js';


/**
 * Rótulos em caixa alta preservam símbolos e unidades: letras gregas (γc, σcd)
 * e trechos entre parênteses — "(kN·m)" — não são convertidos para maiúsculas.
 */
export function rotulo(texto) {
  return rotuloCaixa(texto);
}

function rotuloCaixa(texto) {
  if (typeof texto !== 'string') return texto;
  const partes = [];
  const re = /[\u0370-\u03FF][\w·,']*|\([^)]*\)/g;
  let ultimo = 0, m;
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    partes.push(h('span', { class: 'minusc' }, m[0]));
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

/* ================================================================ estrutura */

/** Seção numerada de um editor: "01  GEOMETRIA". */
export function secao({ numero, titulo, descricao, acoes = [], filhos = [], classe = '' }) {
  return h('section', { class: ['secao', classe] },
    h('header', { class: 'secao-cab' },
      numero && h('span', { class: 'secao-num' }, numero),
      h('h2', { class: 'secao-titulo' }, titulo),
      descricao && h('span', { class: 'secao-desc' }, descricao),
      h('div', { class: 'secao-acoes' }, acoes),
    ),
    h('div', { class: 'secao-corpo' }, filhos),
  );
}

/**
 * Cabeçalho no formato das fichas de arquivo:
 *   ELEMENTO / sigla do módulo (terracota, ex.: CV1) / caixa com três etiquetas / título condensado.
 */
export function cabecalhoObjeto({ rotulo = 'ELEMENTO', simbolo = 'globo', numero, etiquetas = [], linha1, linha2, titulo, subtitulo, aoRenomear, estado, compacto = false, aoEditarCodigo }) {
  // compacto (elementos): o código no lugar da sigla e o nome logo abaixo (editável); depois do filete, o tipo de
  // estrutura, a norma e o resumo, com o estado — sem repetir o nome em letras grandes
  if (compacto) {
    // texto editável que quebra linha (um input cortaria nomes longos em telas estreitas)
    const nomeEl = aoRenomear
      ? h('span', {
          class: 'obj-nome-elem editavel', contentEditable: 'plaintext-only', spellcheck: false, title: 'Clique para renomear', role: 'textbox',
          onBlur: (e) => { const v = e.target.textContent.replace(/\s+/g, ' ').trim(); if (v && v !== titulo) aoRenomear(v); else e.target.textContent = titulo; },
          onKeydown: (e) => {
            if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
            if (e.key === 'Escape') { e.target.textContent = titulo; e.target.blur(); }
          },
        }, titulo)
      : h('span', { class: 'obj-nome-elem' }, titulo);
    return h('header', { class: 'obj-cab compacto' },
      h('div', { class: 'obj-topo' },
        h('div', { class: 'obj-id' },
          h('span', { class: 'obj-rotulo' }, rotulo),
          aoEditarCodigo
            ? h('button', { class: 'obj-numero editavel', title: 'Editar o código (F2)', onClick: aoEditarCodigo }, numero)
            : h('span', { class: 'obj-numero' }, numero),
          nomeEl,
        ),
        h('div', { class: 'obj-lado' },
          h('div', { class: 'obj-etiquetas' }, etiquetas.map((t) => h('span', null, t))),
          h('span', { class: 'obj-globo' }, icone(simbolo, { tamanho: 28, traco: 1.4 })),
        ),
      ),
      h('div', { class: 'obj-filete' }),
      // depois do filete: o tipo de estrutura e a norma, e o resumo, com o estado à direita
      h('div', { class: 'obj-resumo' },
        h('div', { class: 'obj-resumo-txt' },
          linha1 && h('span', { class: 'obj-linha forte' }, linha1),
          linha2 && h('span', { class: 'obj-linha' }, linha2),
          subtitulo && h('span', { class: 'obj-sub' }, subtitulo),
        ),
        estado && h('span', { class: ['obj-estado', estado.tipo] }, estado.texto),
      ),
    );
  }
  const tituloEl = aoRenomear
    ? h('input', {
        class: 'obj-titulo editavel', value: titulo, spellcheck: false, title: 'Clique para renomear',
        onChange: (e) => { const v = e.target.value.trim(); if (v) aoRenomear(v); else e.target.value = titulo; },
        onKeydown: (e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { e.target.value = titulo; e.target.blur(); } },
      })
    : h('h1', { class: 'obj-titulo' }, titulo);

  return h('header', { class: 'obj-cab' },
    h('div', { class: 'obj-topo' },
      h('div', { class: 'obj-id' },
        h('span', { class: 'obj-rotulo' }, rotulo),
        h('span', { class: 'obj-numero' }, numero),
        linha1 && h('span', { class: 'obj-linha forte' }, linha1),
        linha2 && h('span', { class: 'obj-linha' }, linha2),
      ),
      h('div', { class: 'obj-lado' },
        h('div', { class: 'obj-etiquetas' }, etiquetas.map((t) => h('span', null, t))),
        h('span', { class: 'obj-globo' }, icone(simbolo, { tamanho: 28, traco: 1.4 })),
      ),
    ),
    h('div', { class: 'obj-filete' }),
    h('div', { class: 'obj-nome' },
      tituloEl,
      estado && h('span', { class: ['obj-estado', estado.tipo] }, estado.texto),
    ),
    subtitulo && h('div', { class: 'obj-sub' }, subtitulo),
  );
}

/**
 * Ficha de especificações (grade com rótulos terracota).
 * @param {{rotulo:string, valor:any, sub?:string, destaque?:boolean, largura?:number}[]} celulas
 */
export function ficha(celulas, { colunas = 4 } = {}) {
  let col = 0; // posição na linha, para saber onde a linha começa (sem filete à esquerda)
  return h('div', { class: 'ficha', style: { '--colunas': colunas } },
    celulas.map((c) => {
      const larg = Math.min(c.largura ?? 1, colunas);
      if (col + larg > colunas) col = 0;
      const inicio = col === 0;
      col = (col + larg) % colunas;
      return h('div', { class: ['ficha-cel', c.destaque && 'destaque', inicio && 'inicio'], style: larg > 1 ? { gridColumn: `span ${larg}` } : null },
      h('span', { class: 'ficha-rot' }, rotulo(c.rotulo)),
      h('span', { class: 'ficha-val' }, c.valor ?? '—'),
      c.sub && h('span', { class: 'ficha-sub' }, c.sub),
      );
    }),
  );
}

export function cartao({ classe = '', filhos = [], titulo } = {}) {
  return h('div', { class: ['cartao', classe] }, titulo && h('span', { class: 'cartao-rot' }, titulo), filhos);
}

/* ================================================================ instrumentos */

/** Cartão "relógio": número grande + duas linhas de texto à direita. */
export function numeroGrande({ rotulo, valor, unidade, linhas = [], alerta = false }) {
  return cartao({
    classe: ['instr', 'instr-numero', alerta && 'alerta'].filter(Boolean).join(' '),
    filhos: [
      h('div', { class: 'instr-esq' },
        rotulo && h('span', { class: 'instr-rot' }, rotulo),
        h('span', { class: 'instr-valor' }, valor, unidade && h('small', null, unidade)),
      ),
      h('div', { class: 'instr-linhas' }, linhas.map((l) => h('span', null, l))),
    ],
  });
}

/** Medidor em barras verticais (bateria). fração 0–1; acima de 1 marca em terracota. */
export function medidor({ rotulo, valor, fracao, barras = 22, legenda }) {
  const f = Math.max(0, fracao);
  const cheias = Math.round(Math.min(f, 1) * barras);
  const estouro = f > 1;
  return cartao({
    classe: ['instr', 'instr-medidor', estouro && 'alerta'].filter(Boolean).join(' '),
    filhos: [
      h('div', { class: 'instr-esq' },
        h('span', { class: 'instr-rot' }, rotulo),
        h('span', { class: 'instr-valor' }, valor),
      ),
      h('div', { class: 'medidor' },
        h('div', { class: 'medidor-barras' }, Array.from({ length: barras }, (_, i) => h('i', { class: i < cheias ? (estouro ? 'excede' : 'cheia') : '' }))),
        legenda && h('span', { class: 'medidor-leg' }, legenda),
      ),
    ],
  });
}

/** Arco (luz difusa): trilho terracota, progresso em preto e marcador. */
export function arco({ rotulo, valor, fracao, legenda }) {
  const f = Math.max(0, Math.min(1, fracao));
  const W = 300, H = 92, cx = W / 2, cy = 150, R = 140, a0 = (-58 * Math.PI) / 180, a1 = (58 * Math.PI) / 180;
  const pt = (a) => [cx + R * Math.sin(a), cy - R * Math.cos(a)];
  const arcoD = (aa, ab) => { const [x0, y0] = pt(aa), [x1, y1] = pt(ab); return `M${x0},${y0} A${R},${R} 0 0 1 ${x1},${y1}`; };
  const af = a0 + (a1 - a0) * f;
  const [mx, my] = pt(af);
  return cartao({
    classe: ['instr', 'instr-arco', fracao > 1 && 'alerta'].filter(Boolean).join(' '),
    filhos: [
      h('div', { class: 'instr-esq' },
        h('span', { class: 'instr-rot' }, rotulo),
        h('span', { class: 'instr-valor' }, valor),
      ),
      s('svg', { class: 'arco', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMid meet' },
        s('path', { d: arcoD(a0, a1), class: 'arco-trilho' }),
        f > 0.005 && s('path', { d: arcoD(a0, af), class: 'arco-prog' }),
        s('circle', { cx: mx, cy: my, r: 7, class: 'arco-marca' }),
        legenda && s('text', { x: cx, y: H - 8, 'text-anchor': 'middle', class: 'arco-leg' }, legenda),
      ),
    ],
  });
}

/** Faixa (temperatura): degradê preto→cinza e bloco terracota, com rótulos nas pontas. */
export function faixa({ rotulo, valor, fracaoDegrade = 0.72, rotEsq, rotDir }) {
  return cartao({
    classe: 'instr instr-faixa',
    filhos: [
      h('div', { class: 'instr-esq' },
        h('span', { class: 'instr-rot' }, rotulo),
        h('span', { class: 'instr-valor' }, valor),
      ),
      h('div', { class: 'faixa' },
        h('div', { class: 'faixa-barras' },
          h('div', { class: 'faixa-grad', style: { flex: fracaoDegrade } }),
          h('div', { class: 'faixa-bloco', style: { flex: 1 - fracaoDegrade } }),
        ),
        h('div', { class: 'faixa-rots' }, h('span', null, rotEsq), h('span', null, rotDir)),
      ),
    ],
  });
}

/** Mostrador (bússola): disco terracota com marcas e ponteiro. valor/maximo definem o ângulo. */
export function mostrador({ rotulo, valor, numero, maximo, limite, sigla }) {
  const W = 260, H = 120, cx = W + 10, cy = H / 2, R = 118;
  const MEIO = Math.PI * 0.16; // metade do arco útil (≈ 29°), mantém as marcas dentro do cartão
  const ang = (v) => Math.PI - MEIO + (Math.min(v, maximo) / maximo) * (2 * MEIO);
  const marcas = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI - MEIO + (i / 12) * 2 * MEIO;
    const r0 = R - 4, r1 = R - (i % 3 === 0 ? 20 : 12);
    marcas.push(s('line', { x1: cx + r0 * Math.cos(a), y1: cy - r0 * Math.sin(a), x2: cx + r1 * Math.cos(a), y2: cy - r1 * Math.sin(a), class: 'most-marca' }));
  }
  const a = ang(numero);
  const px = cx + (R - 26) * Math.cos(a), py = cy - (R - 26) * Math.sin(a);
  const limiteEl = limite != null && (() => {
    const al = ang(limite);
    return s('line', { x1: cx + (R + 2) * Math.cos(al), y1: cy - (R + 2) * Math.sin(al), x2: cx + (R - 34) * Math.cos(al), y2: cy - (R - 34) * Math.sin(al), class: 'most-limite' });
  })();
  return cartao({
    classe: 'instr instr-mostrador',
    filhos: [
      h('div', { class: 'instr-esq' },
        h('span', { class: 'instr-rot' }, rotulo),
        h('span', { class: 'instr-valor' }, valor),
      ),
      s('svg', { class: 'mostrador', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMaxYMid meet' },
        s('circle', { cx, cy, r: R, class: 'most-disco' }),
        ...marcas,
        limiteEl,
        s('line', { x1: px - 64, y1: py, x2: px, y2: py, class: 'most-ponteiro' }),
        s('text', { x: px - 70, y: py + 5, 'text-anchor': 'end', class: 'most-num' }, String(Math.round(numero))),
        sigla && s('text', { x: px + 12, y: py + 8, class: 'most-sigla' }, sigla),
      ),
    ],
  });
}

/**
 * Grade de pontos (calendário). Cada célula: { nivel: 0–1 | null, destaque?: bool, titulo?: string }.
 */
export function gradePontos({ colunas, celulas, rotulosColunas, classe = '' }) {
  return h('div', { class: ['pontos', classe], style: { '--colunas': colunas } },
    rotulosColunas && rotulosColunas.map((r) => h('span', { class: 'pontos-rot' }, r)),
    celulas.map((c) => {
      if (c == null) return h('span', { class: 'ponto vazio' });
      const cls = ['ponto', c.destaque ? 'destaque' : c.nivel == null ? 'apagado' : 'aceso'];
      const escala = c.nivel == null ? 1 : 0.35 + 0.65 * Math.max(0, Math.min(1, c.nivel));
      return h('span', { class: cls, title: c.titulo ?? '', style: { '--escala': escala } }, c.texto ?? '');
    }),
  );
}

/* ================================================================ estado */

export function selo(ok, texto) {
  return h('span', { class: ['selo', ok ? 'ok' : 'falha'] }, icone(ok ? 'check' : 'alerta', { tamanho: 12, traco: 2 }), texto ?? (ok ? 'Atende' : 'Não atende'));
}

export function vazio({ icone: ic = 'documento', titulo, texto, acoes = [] }) {
  return h('div', { class: 'vazio' },
    icone(ic, { tamanho: 28, traco: 1.2 }),
    h('strong', null, titulo),
    texto && h('p', null, texto),
    acoes.length > 0 && h('div', { class: 'vazio-acoes' }, acoes),
  );
}

/* ================================================================ formulário */

/** Exibe número sem zeros à direita: 4.50 → "4,5". */
export function fmtCampo(v, casas = 2) {
  if (!Number.isFinite(v)) return '';
  return String(+v.toFixed(casas)).replace('.', ',');
}

/**
 * Campo numérico com unidade. Aceita vírgula ou ponto.
 * aoMudar(valor) é chamado só quando o valor é válido e o campo perde o foco (ou Enter).
 */
export function campo(op) {
  // dimensões em cm aparecem em mm quando o projeto usa milímetros (o valor guardado continua em cm)
  if (op.unidade === 'cm' && emMilimetros()) {
    const casas = op.casas ?? 2;
    return campoBase({
      ...op, valor: Number.isFinite(op.valor) ? op.valor * 10 : op.valor, unidade: 'mm', casas: Math.max(0, casas - 1),
      min: op.min != null ? op.min * 10 : undefined, max: op.max != null ? op.max * 10 : undefined,
      aoMudar: op.aoMudar ? (v) => op.aoMudar(v / 10) : undefined,
    });
  }
  return campoBase(op);
}

function campoBase({ rotulo, valor, unidade, casas = 2, min, max, aoMudar, dica, desabilitado, chave, largura }) {
  const input = h('input', {
    class: 'campo-input', type: 'text', inputMode: 'decimal', value: fmtCampo(valor, casas), disabled: !!desabilitado, spellcheck: false,
    dataset: chave ? { chave } : undefined,
    onKeydown: (e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { e.target.value = fmtCampo(valor, casas); e.target.blur(); } },
    onChange: (e) => {
      const v = lerNumero(e.target.value);
      const erro = !Number.isFinite(v) ? 'Número inválido'
        : min != null && v < min ? `Mínimo: ${fmtCampo(min, casas)}`
        : max != null && v > max ? `Máximo: ${fmtCampo(max, casas)}` : null;
      const caixa = e.target.parentElement;
      if (erro) {
        caixa.classList.add('erro');
        caixa.dataset.erro = erro;
        e.target.value = fmtCampo(valor, casas);
        setTimeout(() => { caixa.classList.remove('erro'); delete caixa.dataset.erro; }, 2200);
        return;
      }
      valor = v;
      e.target.value = fmtCampo(v, casas);
      aoMudar?.(v);
    },
  });
  return h('label', { class: 'campo', title: dica ?? '', style: largura ? { width: largura } : null },
    rotulo && h('span', { class: 'campo-rot' }, rotuloCaixa(rotulo)),
    h('span', { class: 'campo-caixa' }, input, unidade && h('span', { class: 'campo-unid' }, unidade)),
  );
}

export function texto({ rotulo, valor, aoMudar, placeholder, largura }) {
  return h('label', { class: 'campo', style: largura ? { width: largura } : null },
    rotulo && h('span', { class: 'campo-rot' }, rotuloCaixa(rotulo)),
    h('span', { class: 'campo-caixa' },
      h('input', { class: 'campo-input texto', type: 'text', value: valor ?? '', placeholder: placeholder ?? '', spellcheck: false,
        onKeydown: (e) => { if (e.key === 'Enter') e.target.blur(); },
        onChange: (e) => aoMudar?.(e.target.value) }),
    ),
  );
}

/** @param {{valor:any, texto:string}[]} opcoes */
export function selecao({ rotulo, valor, opcoes, aoMudar, largura }) {
  const sel = h('select', { class: 'campo-input', onChange: (e) => aoMudar?.(opcoes[e.target.selectedIndex].valor) },
    opcoes.map((o) => h('option', { selected: o.valor === valor }, o.texto)));
  return h('label', { class: 'campo', style: largura ? { width: largura } : null },
    rotulo && h('span', { class: 'campo-rot' }, rotuloCaixa(rotulo)),
    h('span', { class: 'campo-caixa select' }, sel, icone('baixo', { tamanho: 14 })),
  );
}

export function alternar({ rotulo, valor, aoMudar, dica }) {
  return h('label', { class: 'alternar', title: dica ?? '' },
    h('input', { type: 'checkbox', checked: !!valor, onChange: (e) => aoMudar?.(e.target.checked) }),
    h('span', { class: 'alternar-trilho' }, h('span', { class: 'alternar-bola' })),
    h('span', { class: 'alternar-rot' }, rotulo),
  );
}

/** Controle segmentado. */
export function segmentado({ rotulo, valor, opcoes, aoMudar, compacto }) {
  return h('div', { class: ['campo', compacto && 'compacto'] },
    rotulo && h('span', { class: 'campo-rot' }, rotuloCaixa(rotulo)),
    h('div', { class: 'segmentado', role: 'radiogroup' },
      opcoes.map((o) => h('button', {
        type: 'button', class: o.valor === valor ? 'ativo' : '', role: 'radio', 'aria-checked': String(o.valor === valor), title: o.dica ?? '',
        onClick: () => { if (o.valor !== valor) aoMudar?.(o.valor); },
      }, o.texto))),
  );
}

export function botao({ texto, icone: ic, tipo = 'secundario', aoClicar, titulo, desabilitado, tecla }) {
  return h('button', { type: 'button', class: ['botao', tipo], title: titulo ?? '', disabled: !!desabilitado, onClick: aoClicar },
    ic && icone(ic, { tamanho: 15, traco: 1.8 }),
    texto && h('span', null, texto),
    tecla && h('kbd', null, tecla),
  );
}

export function botaoIcone({ icone: ic, titulo, aoClicar, classe = '' }) {
  return h('button', { type: 'button', class: ['botao-icone', classe], title: titulo, 'aria-label': titulo, onClick: aoClicar }, icone(ic, { tamanho: 16 }));
}

export function linhaCampos(...filhos) {
  return h('div', { class: 'linha-campos' }, filhos);
}

/* ================================================================ tabelas */

/**
 * @param {{titulo:string, alinhar?:'dir'}[]} colunas
 * @param {any[][]} linhas
 */
export function tabela({ colunas, linhas, classe = '' }) {
  // colunas em cm passam a mm quando o projeto usa milímetros
  if (emMilimetros() && colunas.some((c) => /\(cm\)/.test(c.titulo ?? ''))) {
    const emCm = colunas.map((c) => /\(cm\)/.test(c.titulo ?? ''));
    colunas = colunas.map((c, i) => (emCm[i] ? { ...c, titulo: c.titulo.replace('(cm)', '(mm)') } : c));
    linhas = linhas.map((l) => {
      const cel = (l.celulas ?? l).map((v, i) => (emCm[i] ? converterCelula(v) : v));
      return l.celulas ? { ...l, celulas: cel } : Object.assign(cel, l.classe ? { classe: l.classe } : {});
    });
  }
  return h('table', { class: ['tabela', classe] },
    h('thead', null, h('tr', null, colunas.map((c) => h('th', { class: c.alinhar ?? '' }, rotulo(c.titulo))))),
    h('tbody', null, linhas.map((l) => h('tr', { class: l.classe ?? '' }, (l.celulas ?? l).map((v, i) => h('td', { class: colunas[i]?.alinhar ?? '' }, v))))),
  );
}

/** Tabela padrão de verificações normativas (cada módulo devolve esta estrutura). */
export function tabelaVerificacoes(verificacoes) {
  return tabela({
    classe: 'verificacoes',
    colunas: [{ titulo: 'Verificação' }, { titulo: 'Item' }, { titulo: 'Solicitante', alinhar: 'dir' }, { titulo: 'Limite', alinhar: 'dir' }, { titulo: '' }],
    linhas: verificacoes.map((v) => ({ classe: v.ok ? '' : 'falha', celulas: [v.nome, v.item ?? '', v.valor ?? '', v.limite ?? '', selo(v.ok)] })),
  });
}
