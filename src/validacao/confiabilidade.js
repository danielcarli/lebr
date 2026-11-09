/*
 * LEBR — Laboratório de Estruturas Brasil
 * Copyright (C) 2026 Daniel Michelon De Carli
 *
 * Feito com uso da inteligência artificial Claude Fable 5.1, sob a orientação de Daniel Michelon De Carli.
 *
 * Este programa é software livre: você pode redistribuí-lo e/ou modificá-lo nos termos da GNU Affero General
 * Public License, versão 3, publicada pela Free Software Foundation. É distribuído na esperança de ser útil, mas
 * SEM NENHUMA GARANTIA, nem mesmo a garantia implícita de COMERCIALIZAÇÃO ou de ADEQUAÇÃO A UMA FINALIDADE
 * ESPECÍFICA. Veja o arquivo LICENSE ou <https://www.gnu.org/licenses/agpl-3.0.html>.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * Relatório de confiabilidade: junta as três camadas de validação e resume em estatísticas.
 *  1. Banco de casos (norma, tabelas, soluções fechadas e 158 exercícios publicados): distribuição dos desvios.
 *  2. Varreduras aleatórias de invariantes: taxa de falha por família com limite superior de 95 %.
 *  3. Fechamento do caminho das cargas nos projetos de exemplo.
 */
import { executarTodos } from './executar.js';
import { ehArquivoBibliografia } from './bibliografia-notas.js';
import { rodarInvariantes, limiteSuperior95 } from './invariantes.js';
import { calcularProjeto, fechamentoDoCaminhoDasCargas } from './caminho-cargas.js';
import { MODULOS_CALCULO } from './calculos.js';

/** Percentil de uma lista ordenada. */
const percentil = (ordenada, p) => (ordenada.length ? ordenada[Math.min(ordenada.length - 1, Math.max(0, Math.ceil((p / 100) * ordenada.length) - 1))] : 0);

/** Estatísticas dos desvios relativos (|LEBR − fonte|/fonte) das grandezas comparadas. */
export function estatisticasDesvios(relatorio, { apenasBibliografia = false } = {}) {
  const itens = relatorio.grupos.filter((g) => !apenasBibliografia || ehArquivoBibliografia(g.arquivo)).flatMap((g) => g.casos.flatMap((c) => c.itens.filter((i) => i.diferenca != null)));
  const d = itens.map((i) => i.diferenca).sort((a, b) => a - b);
  const media = d.reduce((s, v) => s + v, 0) / (d.length || 1);
  const sd = Math.sqrt(d.reduce((s, v) => s + (v - media) ** 2, 0) / (d.length || 1));
  const faixa = (lim) => d.filter((v) => v <= lim + 1e-12).length / (d.length || 1);
  return {
    grandezas: d.length, media, desvioPadrao: sd, mediana: percentil(d, 50), p90: percentil(d, 90), p95: percentil(d, 95), p99: percentil(d, 99), maximo: d.length ? d[d.length - 1] : 0,
    ate: { '0,1 %': faixa(0.001), '1 %': faixa(0.01), '2 %': faixa(0.02), '5 %': faixa(0.05), '10 %': faixa(0.1) },
    exatas: d.filter((v) => v <= 1e-4).length,
  };
}

/** Cobertura: por módulo, quantos casos do banco, quantas grandezas e quais famílias de invariantes o cobrem. */
export function coberturaPorModulo(relatorio, invariantes) {
  const porModulo = {};
  const nome = (id) => id;
  for (const id of Object.keys(MODULOS_CALCULO)) porModulo[id] = { modulo: nome(id), casos: 0, grandezas: 0, bibliografia: 0, familias: [], sorteios: 0 };
  // casos de elemento contam no módulo; casos de motor contam no módulo que usa aquele motor
  const MOTOR_MODULO = {
    flexao: 'concreto.viga', cisalhamento: 'concreto.viga', viga: 'concreto.viga', fissuracao: 'concreto.viga', torcao: 'concreto.viga', detalhamento: 'concreto.viga',
    placa: 'concreto.laje.macica', puncao: 'concreto.laje.macica', pilar: 'concreto.pilar', obliqua: 'concreto.pilar', estabilidade: 'concreto.pilar', vento: 'concreto.pilar', portico: 'concreto.pilar',
    madeira: 'madeira.viga', tesoura: 'madeira.tesoura', sondagem: 'geotecnia.sondagem', sapata: 'concreto.sapata', estacas: 'geotecnia.estaca', bloco: 'concreto.bloco', escada: 'concreto.escada', reservatorio: 'concreto.reservatorio',
    materiais: 'concreto.viga', cargas: 'concreto.laje.macica', combinacoes: 'concreto.viga', quantitativos: 'concreto.viga',
  };
  for (const g of relatorio.grupos) for (const c of g.casos) {
    const mod = c.alvo === 'elemento' ? c.onde : MOTOR_MODULO[String(c.onde).split('.')[0]];
    const p = porModulo[mod];
    if (!p) continue;
    p.casos++; p.grandezas += c.itens.length;
    if (ehArquivoBibliografia(g.arquivo)) p.bibliografia++;
  }
  for (const f of invariantes.familias) {
    const alvo = f.id.startsWith('elemento-laje') ? ['concreto.laje.macica', 'concreto.laje.trelicada', 'concreto.laje.nervurada']
      : f.id === 'elemento-fundacoes' ? ['concreto.bloco', 'geotecnia.estaca', 'concreto.sapataCorrida', 'concreto.radier']
        : f.id === 'elemento-madeira-telhado' ? ['madeira.telhado', 'madeira.tesoura']
          : f.id === 'elemento-escada-reservatorio' ? ['concreto.escada', 'concreto.reservatorio'] : [f.modulo];
    for (const m of alvo) if (porModulo[m]) { porModulo[m].familias.push(f.id); porModulo[m].sorteios += f.sorteios; }
  }
  return Object.values(porModulo);
}

/**
 * Monta o relatório completo.
 * @param {object} op
 * @param {{arquivo:string, grupo:string, casos:object[]}[]} op.arquivos   casos do banco já lidos
 * @param {{nome:string, projeto:object}[]} op.exemplos                      projetos de exemplo já lidos
 * @param {number} [op.n]                                                    sorteios por família
 */
export function relatorioConfiabilidade({ arquivos, exemplos = [], n = 300, semente = 20261108, versao = '' }) {
  const banco = executarTodos(arquivos);
  const invariantes = rodarInvariantes({ n, semente });
  const fechamento = exemplos.map(({ nome, projeto }) => {
    calcularProjeto(projeto);
    const f = fechamentoDoCaminhoDasCargas(projeto);
    const falhas = projeto.elementos.filter((e) => e.resultado && (e.resultado.erro || !e.resultado.ok)).map((e) => e.codigo);
    return { nome, elementos: projeto.elementos.length, entra: f.entra.g + f.entra.q, chega: f.fundacao.g + f.fundacao.q, desvio: f.desvio, partes: f.entra.partes, perdas: f.perdas, falhas, ok: Math.abs(f.desvio) <= 0.01 && !falhas.length };
  });
  const verificacoesInv = invariantes.familias.reduce((s, f) => s + f.verificacoes, 0);
  return {
    versao, geradoEm: new Date().toISOString(), semente, sorteiosPorFamilia: n,
    banco: {
      casos: banco.total, aprovados: banco.aprovados, grandezas: banco.grandezas, maiorDiferenca: banco.maiorDiferenca, ok: banco.ok,
      desvios: estatisticasDesvios(banco), desviosBibliografia: estatisticasDesvios(banco, { apenasBibliografia: true }),
      falhas: banco.grupos.flatMap((g) => g.casos.filter((c) => !c.ok).map((c) => `${c.id}: ${c.erro ?? c.itens.filter((i) => !i.ok).map((i) => `${i.grandeza} ${i.obtido} ≠ ${i.esperado}`).join('; ')}`)),
    },
    invariantes: { ...invariantes, verificacoes: verificacoesInv, familias: invariantes.familias.map((f) => ({ ...f, exemplosFalha: f.exemplosFalha.slice(0, 5) })) },
    fechamento,
    cobertura: coberturaPorModulo(banco, invariantes),
    conclusao: {
      bancoOk: banco.ok, invariantesOk: invariantes.falhas === 0, fechamentoOk: fechamento.every((f) => f.ok),
      limite95Invariantes: invariantes.limite95,
      totalVerificacoesIndependentes: banco.grandezas + verificacoesInv + fechamento.length,
    },
  };
}

const pct = (v, c = 2) => `${(v * 100).toFixed(c).replace('.', ',')} %`;
const num = (v, c = 2) => Number(v).toFixed(c).replace('.', ',');

/** Relatório em Markdown. */
export function confiabilidadeMarkdown(r) {
  const L = [];
  L.push(`# Relatório de confiabilidade — LEBR ${r.versao}`, '', `Gerado em ${r.geradoEm.slice(0, 10)} · semente ${r.semente} · ${r.sorteiosPorFamilia} sorteios por família.`, '');
  L.push('## Resumo', '');
  L.push(`| Camada | Resultado |`, `|---|---|`);
  L.push(`| 1. Banco de casos (norma, tabelas, soluções fechadas, exercícios publicados) | ${r.banco.aprovados} de ${r.banco.casos} casos · ${r.banco.grandezas} grandezas · maior desvio ${pct(r.banco.maiorDiferenca)} |`);
  L.push(`| 2. Varreduras aleatórias de invariantes | ${r.invariantes.total} sorteios · ${r.invariantes.verificacoes} verificações · ${r.invariantes.falhas} falhas · taxa de falha < ${pct(r.invariantes.limite95, 3)} (95 %) |`);
  L.push(`| 3. Fechamento do caminho das cargas nos exemplos | ${r.fechamento.filter((f) => f.ok).length} de ${r.fechamento.length} projetos com desvio ≤ 1 % e tudo atendendo |`);
  L.push('', `**${r.conclusao.totalVerificacoesIndependentes} verificações independentes** no total. ${r.conclusao.bancoOk && r.conclusao.invariantesOk && r.conclusao.fechamentoOk ? 'Nenhuma falha.' : '**Há falhas — veja abaixo.**'}`, '');
  const d = r.banco.desvios, db = r.banco.desviosBibliografia;
  L.push('## 1. Desvios em relação às fontes', '');
  L.push('| | Todas as grandezas | Só exercícios publicados |', '|---|---|---|');
  L.push(`| Grandezas comparadas | ${d.grandezas} | ${db.grandezas} |`);
  L.push(`| Coincidência exata (≤ 0,01 %) | ${d.exatas} (${pct(d.exatas / d.grandezas, 0)}) | ${db.exatas} (${pct(db.exatas / db.grandezas, 0)}) |`);
  L.push(`| Desvio médio | ${pct(d.media)} | ${pct(db.media)} |`);
  L.push(`| Mediana | ${pct(d.mediana)} | ${pct(db.mediana)} |`);
  L.push(`| Percentil 90 | ${pct(d.p90)} | ${pct(db.p90)} |`);
  L.push(`| Percentil 95 | ${pct(d.p95)} | ${pct(db.p95)} |`);
  L.push(`| Máximo | ${pct(d.maximo)} | ${pct(db.maximo)} |`);
  L.push(`| Dentro de 1 % | ${pct(d.ate['1 %'], 1)} | ${pct(db.ate['1 %'], 1)} |`);
  L.push(`| Dentro de 2 % | ${pct(d.ate['2 %'], 1)} | ${pct(db.ate['2 %'], 1)} |`);
  L.push(`| Dentro de 5 % | ${pct(d.ate['5 %'], 1)} | ${pct(db.ate['5 %'], 1)} |`);
  L.push('', 'Os desvios acima de 2 % têm hipótese diferente documentada no caso (`nota`): arredondamento de tabela, ábaco lido a olho, coeficiente adotado pelo autor.', '');
  if (r.banco.falhas.length) L.push('**Falhas do banco:**', ...r.banco.falhas.map((f) => `- ${f}`), '');
  L.push('## 2. Varreduras de invariantes', '');
  L.push('| Família | Módulo | Sorteios | Verificações | Falhas | Taxa de falha (limite 95 %) |', '|---|---|---|---|---|---|');
  for (const f of r.invariantes.familias) L.push(`| ${f.nome} | \`${f.modulo}\` | ${f.sorteios} | ${f.verificacoes} | ${f.falhas} | < ${pct(f.limite95, 2)} |`);
  L.push('', 'Invariantes conferidos por família:', '');
  for (const f of r.invariantes.familias) {
    L.push(`- **${f.nome}** — ${f.fonte}`);
    for (const i of f.invariantes) L.push(`  - ${i.invariante}: ${i.n} verificações${i.falhas ? ` · **${i.falhas} falhas**` : ''}`);
  }
  const comFalha = r.invariantes.familias.filter((f) => f.falhas);
  if (comFalha.length) {
    L.push('', '**Exemplos de falha:**');
    for (const f of comFalha) for (const x of f.exemplosFalha) L.push(`- ${f.id} · ${x.invariante}: ${x.detalhe} — entrada ${JSON.stringify(x.entrada)}`);
  }
  L.push('', '## 3. Caminho das cargas nos projetos de exemplo', '');
  L.push('| Projeto | Elementos | Entra (kN) | Chega à fundação (kN) | Desvio | Pendências |', '|---|---|---|---|---|---|');
  for (const f of r.fechamento) L.push(`| ${f.nome} | ${f.elementos} | ${num(f.entra, 0)} | ${num(f.chega, 0)} | ${(f.desvio * 100).toFixed(2).replace('.', ',')} % | ${f.falhas.length ? f.falhas.join(', ') : f.perdas.length ? `${f.perdas.length} apoio(s) de escada em alvenaria` : '—'} |`);
  L.push('', 'O peso que entra é somado elemento a elemento (área das lajes × carga, peso próprio e paredes das vigas, pilares, escadas, reservatórios e telhado), sem passar pelas reações; o que chega é a soma das cargas características nas fundações.', '');
  L.push('## 4. Cobertura por módulo', '');
  L.push('| Módulo | Casos do banco | dos quais exercícios publicados | Grandezas | Famílias de invariantes | Sorteios |', '|---|---|---|---|---|---|');
  for (const c of r.cobertura) L.push(`| \`${c.modulo}\` | ${c.casos} | ${c.bibliografia} | ${c.grandezas} | ${c.familias.join(', ') || '—'} | ${c.sorteios} |`);
  L.push('', '## O que esta estatística garante — e o que não garante', '');
  L.push(`- Com ${r.invariantes.total} sorteios sem falha, a probabilidade de uma entrada sorteada nesses domínios violar um invariante é menor que ${pct(r.invariantes.limite95, 3)}, com 95 % de confiança (regra dos três). Isso vale para o domínio sorteado (seções, vãos, cargas e materiais usuais) e para os invariantes listados; não cobre entradas fora dele nem erros que preservem equilíbrio, simetria e limites (por exemplo um coeficiente de norma trocado por outro plausível).`);
  L.push('- Os exercícios publicados conferem os coeficientes e as expressões da norma item a item; os desvios acima de 2 % estão explicados caso a caso.');
  L.push('- Nenhum conjunto de testes torna um programa "seguro para uso real" por si só: a NBR 6118 e a NBR 7190 exigem que o projeto seja de responsabilidade de um engenheiro habilitado, que confere as hipóteses, os dados de entrada e os resultados. O LEBR continua um protótipo; estes números medem a consistência interna e a aderência às fontes, não substituem a verificação independente.');
  return L.join('\n');
}

export { limiteSuperior95 };
