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
 * Relatório de validação em HTML autocontido (gerado por npm run validar).
 */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Número no formato brasileiro com até `sig` algarismos significativos. */
export function numeroBr(v, sig = 5) {
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  if (typeof v !== 'number') return v == null ? '—' : String(v);
  if (!Number.isFinite(v)) return String(v);
  if (v === 0) return '0';
  const a = Math.abs(v);
  const casas = Math.max(0, Math.min(8, sig - 1 - Math.floor(Math.log10(a))));
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas });
}

export const percentual = (x) => (x == null ? '—' : `${(x * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: 2 })} %`);

export function relatorioHtml(r, { versao = '' } = {}) {
  const data = new Date(r.executadoEm).toLocaleString('pt-BR');
  const linhasCaso = (c) => {
    const cab = `<tr class="caso ${c.ok ? 'ok' : 'falha'}"><td colspan="6"><b>${esc(c.titulo)}</b> <span class="id">${esc(c.id)} · ${esc(c.onde)}</span><div class="fonte">${esc(c.fonte)}</div>${c.erro ? `<div class="erro">Erro: ${esc(c.erro)}</div>` : ''}</td></tr>`;
    return cab + c.itens.map((i) => `<tr class="${i.ok ? '' : 'falha'}"><td>${esc(i.grandeza)}</td><td class="n">${esc(numeroBr(i.esperado))}</td><td class="n">${esc(numeroBr(i.obtido))}</td><td>${esc(i.unidade)}</td><td class="n">${percentual(i.diferenca)} <span class="tol">/ ${percentual(i.tolerancia)}</span></td><td class="st">${i.ok ? 'ok' : 'FALHA'}</td></tr>`).join('');
  };
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LEBR — Relatório de validação</title>
<style>
:root { --papel:#EFEBE4; --tinta:#161514; --tinta2:#4A453F; --suave:#857664; --filete:#CBC4B7; --acento:#B85438; --ok:#3D7A4F; --erro:#B33A3A; }
@media (prefers-color-scheme: dark) { :root { --papel:#0D0C0B; --tinta:#ECE8E2; --tinta2:#B9B2A8; --suave:#A08F7A; --filete:#2E2A26; --acento:#D9714F; --ok:#6DBA84; --erro:#E27C7C; color-scheme: dark; } }
body { margin:0; background:var(--papel); color:var(--tinta); font:14px/1.5 'Livvic','Segoe UI',Arial,sans-serif; }
main { max-width:1100px; margin:0 auto; padding:36px 20px 80px; }
.rot { font-size:11px; font-weight:600; letter-spacing:.09em; text-transform:uppercase; color:var(--acento); }
h1 { font-size:38px; margin:4px 0 6px; letter-spacing:-.01em; }
.resumo { display:flex; flex-wrap:wrap; gap:8px 28px; margin:18px 0 26px; padding:12px 0; border-top:1px solid var(--tinta); border-bottom:1px solid var(--filete); }
.resumo b { font-size:20px; display:block; font-variant-numeric:tabular-nums; }
.resumo .st-ok b { color:var(--ok); } .resumo .st-falha b { color:var(--erro); }
h2 { font-size:15px; text-transform:uppercase; letter-spacing:.05em; margin:30px 0 4px; }
h2 + p { margin:0 0 8px; color:var(--tinta2); }
table { width:100%; border-collapse:collapse; font-variant-numeric:tabular-nums; }
th { text-align:left; font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--acento); border-bottom:1px solid var(--tinta); padding:6px 8px; }
td { padding:5px 8px; border-bottom:1px solid var(--filete); vertical-align:top; }
td.n, th.n { text-align:right; white-space:nowrap; }
tr.caso td { padding-top:14px; border-bottom:0; }
.id { color:var(--suave); font-size:12px; margin-left:6px; }
.fonte { color:var(--tinta2); font-size:12.5px; margin-top:2px; }
.erro, tr.falha td, .st { color:var(--erro); }
tr:not(.falha) .st { color:var(--ok); font-weight:600; }
tr.falha .st { font-weight:700; }
.tol { color:var(--suave); }
.rodape { margin-top:30px; color:var(--suave); font-size:12.5px; }
</style></head><body><main>
<span class="rot">LEBR${versao ? ` ${esc(versao)}` : ''} · Banco de casos de validação</span>
<h1>Relatório de validação</h1>
<p>Cada caso compara o resultado do LEBR com um valor de referência que não vem do próprio programa: norma, tabela clássica ou cálculo manual. A diferença é relativa ao valor esperado e é comparada com a tolerância do caso.</p>
<div class="resumo">
  <div class="${r.ok ? 'st-ok' : 'st-falha'}"><b>${r.ok ? 'Tudo certo' : `${r.falhas} com falha`}</b>situação</div>
  <div><b>${r.aprovados} de ${r.total}</b>casos aprovados</div>
  <div><b>${r.grandezas}</b>grandezas conferidas</div>
  <div><b>${percentual(r.maiorDiferenca)}</b>maior diferença</div>
  <div><b>${esc(data)}</b>executado em</div>
</div>
${r.grupos.map((g) => `<h2>${esc(g.grupo)}</h2><p>${esc(g.descricao)} <span class="id">${esc(g.arquivo)}</span></p>
<table><thead><tr><th>Grandeza</th><th class="n">Esperado</th><th class="n">LEBR</th><th>Unidade</th><th class="n">Diferença / tolerância</th><th></th></tr></thead><tbody>
${g.casos.map(linhasCaso).join('')}
</tbody></table>`).join('')}
<p class="rodape">Os casos ficam em validacao/casos/*.json. Para incluir um exemplo resolvido de livro, copie um caso existente, troque a entrada, os valores esperados e a fonte, e rode npm run validar.</p>
</main></body></html>
`;
}
