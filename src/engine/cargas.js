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
 * Catálogo de cargas — ABNT NBR 6120:2019 (Ações para o cálculo de estruturas de edificações).
 *
 * Unidades: pesos específicos em kN/m³; pesos por área e cargas de uso em kN/m²;
 * cargas de parede sobre viga em kN/m.
 *
 * Fontes dos valores (ver docs/CARGAS.md): as tabelas da norma reproduzidas em material
 * técnico e didático, conferidas entre si. Valores marcados com `conferir` divergem entre
 * as fontes ou são do projeto de revisão de 2017 e devem ser checados no texto da norma.
 */

/* ======================================================================== Tabela 1 */

/** Pesos específicos aparentes (kN/m³) — NBR 6120:2019, Tabela 1 (seleção). */
export const PESOS_ESPECIFICOS = [
  { id: 'concreto-simples', grupo: 'Concretos', nome: 'Concreto simples', gama: 24 },
  { id: 'concreto-armado', grupo: 'Concretos', nome: 'Concreto armado', gama: 25 },
  { id: 'arg-cimento-areia', grupo: 'Argamassas', nome: 'Argamassa de cimento e areia', gama: 21, faixa: '19 a 23' },
  { id: 'arg-cal-cimento-areia', grupo: 'Argamassas', nome: 'Argamassa de cal, cimento e areia', gama: 19 },
  { id: 'arg-cal', grupo: 'Argamassas', nome: 'Argamassa de cal', gama: 15, faixa: '12 a 18' },
  { id: 'arg-gesso', grupo: 'Argamassas', nome: 'Argamassa de gesso', gama: 15, faixa: '12 a 18' },
  { id: 'arg-autonivelante', grupo: 'Argamassas', nome: 'Argamassa autonivelante', gama: 24 },
  { id: 'lajota-ceramica', grupo: 'Pisos e revestimentos', nome: 'Lajotas cerâmicas', gama: 18 },
  { id: 'porcelanato', grupo: 'Pisos e revestimentos', nome: 'Porcelanato', gama: 23 },
  { id: 'granito', grupo: 'Pisos e revestimentos', nome: 'Granito', gama: 28.5, faixa: '27 a 30' },
  { id: 'marmore', grupo: 'Pisos e revestimentos', nome: 'Mármore e calcário', gama: 28 },
  { id: 'terracota', grupo: 'Pisos e revestimentos', nome: 'Terracota', gama: 21 },
  { id: 'madeira-conifera-c25', grupo: 'Madeiras (12 %)', nome: 'Conífera C25', gama: 5.5 },
  { id: 'madeira-dicot-c30', grupo: 'Madeiras (12 %)', nome: 'Dicotiledônea C30', gama: 8 },
  { id: 'madeira-dicot-c40', grupo: 'Madeiras (12 %)', nome: 'Dicotiledônea C40', gama: 9.5 },
  { id: 'aco', grupo: 'Metais', nome: 'Aço', gama: 78.5, faixa: '77 a 78,5' },
];

export const pesoEspecifico = (id) => PESOS_ESPECIFICOS.find((m) => m.id === id) ?? null;

/* ======================================================================== Tabela 2 */

/**
 * Alvenarias — NBR 6120:2019, Tabela 2: peso por área de parede (kN/m²) por espessura nominal (cm),
 * para revestimento de 0, 1 e 2 cm em cada face.
 */
export const ALVENARIAS = [
  // vedação
  { id: 'ceramico-vedacao', uso: 'vedacao', nome: 'Bloco cerâmico vazado, furo horizontal', ref: 'NBR 15270-1',
    espessuras: { 9: [0.7, 1.1, 1.6], 11.5: [0.9, 1.3, 1.7], 14: [1.1, 1.5, 1.9], 19: [1.4, 1.8, 2.3] } },
  { id: 'concreto-vedacao', uso: 'vedacao', nome: 'Bloco de concreto vazado, classe C', ref: 'NBR 6136',
    espessuras: { 6.5: [1.0, 1.4, 1.8], 9: [1.1, 1.5, 1.9], 11.5: [1.3, 1.7, 2.1], 14: [1.4, 1.8, 2.2], 19: [1.8, 2.2, 2.6] },
    conferir: { 19: 'Uma das fontes traz 1,9 kN/m² para 1 cm por face; adotado 2,2 pela diferença de 0,4 kN/m² por centímetro das demais linhas.' } },
  { id: 'celular', uso: 'vedacao', nome: 'Bloco de concreto celular autoclavado, classe C25', ref: 'NBR 13438',
    espessuras: { 7.5: [0.5, 0.9, 1.3], 10: [0.6, 1.0, 1.4], 12.5: [0.8, 1.2, 1.6], 15: [0.9, 1.3, 1.7], 17.5: [1.1, 1.5, 1.9], 20: [1.2, 1.6, 2.0] } },
  { id: 'vidro', uso: 'vedacao', nome: 'Bloco de vidro decorativo', ref: '',
    espessuras: { 8: [0.8, null, null] } },
  // estrutural
  { id: 'concreto-estrutural', uso: 'estrutural', nome: 'Bloco de concreto vazado, classes A e B', ref: 'NBR 6136',
    espessuras: { 14: [2.0, 2.3, 2.7], 19: [2.7, 3.0, 3.4] } },
  { id: 'ceramico-estrutural-macicas', uso: 'estrutural', nome: 'Bloco cerâmico vazado, paredes maciças, furo vertical', ref: 'NBR 15270-1',
    espessuras: { 14: [2.0, 2.3, 2.7] } },
  { id: 'ceramico-estrutural-vazadas', uso: 'estrutural', nome: 'Bloco cerâmico vazado, paredes vazadas, furo vertical', ref: 'NBR 15270-1',
    espessuras: { 9: [1.1, 1.5, 1.9], 11.5: [1.4, 1.8, 2.2], 14: [1.7, 2.1, 2.5] } },
  { id: 'tijolo-macico', uso: 'estrutural', nome: 'Tijolo cerâmico maciço', ref: 'NBR 15270-1',
    espessuras: { 9: [1.6, 2.0, 2.4], 11.5: [2.1, 2.5, 2.9], 14: [2.5, 2.9, 3.3], 19: [3.4, 3.8, 4.2] } },
  { id: 'silico-vazado', uso: 'estrutural', nome: 'Bloco sílico-calcário vazado, classe E', ref: 'NBR 14974-1',
    espessuras: { 9: [1.1, 1.5, 1.9], 14: [1.5, 1.9, 2.3], 19: [1.9, 2.3, 2.7] } },
  { id: 'silico-perfurado', uso: 'estrutural', nome: 'Bloco sílico-calcário perfurado, classes E, F e G', ref: 'NBR 14974-1',
    espessuras: { 11.5: [1.9, 2.3, 2.7], 14: [2.1, 2.5, 2.9], 17.5: [2.8, 3.2, 3.6] } },
];

export const alvenaria = (id) => ALVENARIAS.find((a) => a.id === id) ?? null;

/** Espessuras nominais disponíveis (cm) para um tipo de alvenaria. */
export const espessurasAlvenaria = (id) => Object.keys(alvenaria(id)?.espessuras ?? {}).map(Number).sort((a, b) => a - b);

/** Revestimentos por face (cm) com valor na tabela para essa espessura. */
export const revestimentosAlvenaria = (id, espessura) => (alvenaria(id)?.espessuras[espessura] ?? [])
  .map((v, i) => (v == null ? null : i)).filter((v) => v != null);

/**
 * Peso da parede por área (kN/m²), Tabela 2.
 * @param {string} id  tipo de alvenaria
 * @param {number} espessura  espessura nominal do bloco (cm)
 * @param {0|1|2} revestimento  espessura do revestimento em cada face (cm)
 */
export function pesoAlvenaria(id, espessura, revestimento = 1) {
  const a = alvenaria(id);
  if (!a) throw new Error(`Alvenaria desconhecida: ${id}.`);
  const linha = a.espessuras[espessura];
  if (!linha) throw new Error(`${a.nome}: espessura ${espessura} cm fora da Tabela 2 (disponíveis: ${espessurasAlvenaria(id).join(', ')} cm).`);
  const v = linha[revestimento];
  if (v == null) throw new Error(`${a.nome} ${espessura} cm: a Tabela 2 não traz valor com revestimento de ${revestimento} cm por face.`);
  return v;
}

/**
 * Carga de parede sobre viga (kN/m).
 * Com `material`: Tabela 2 (peso por área × altura × fração cheia).
 * Sem `material` (arquivos até a versão 0.8): peso específico × espessura × altura, como antes.
 * @returns {{ g:number, porArea:number|null, texto:string, conferir:string|null }}
 */
export function cargaParede(c) {
  const altura = Number(c.altura) || 0;
  const cheia = 1 - Math.min(90, Math.max(0, Number(c.aberturas) || 0)) / 100;
  if (c.material) {
    const a = alvenaria(c.material);
    const porArea = pesoAlvenaria(c.material, Number(c.espessura), Number(c.revestimento ?? 1));
    const desc = Number(c.aberturas) > 0 ? `, ${fmt(c.aberturas)} % de aberturas` : '';
    return {
      g: porArea * altura * cheia, porArea,
      texto: `${a.nome} ${fmt(c.espessura)} cm, revestimento ${c.revestimento ?? 1} cm/face, h = ${fmt(altura)} m${desc} (NBR 6120 Tabela 2: ${fmt(porArea)} kN/m²)`,
      conferir: a.conferir?.[c.espessura] ?? null,
    };
  }
  const porVolume = Number(c.peso) || 0;
  return {
    g: porVolume * (Number(c.espessura) / 100) * altura * cheia, porArea: null,
    texto: `Alvenaria e = ${fmt(c.espessura)} cm, h = ${fmt(altura)} m, γ = ${fmt(porVolume)} kN/m³`,
    conferir: null,
  };
}

/* ======================================================================== Tabela 10 */

/** Cargas variáveis de uso (kN/m²) — NBR 6120:2019, Tabela 10 (seleção). */
export const CARGAS_USO = [
  { id: 'res-dormitorio', grupo: 'Residencial', local: 'Dormitórios', q: 1.5 },
  { id: 'res-sala', grupo: 'Residencial', local: 'Sala, copa e cozinha', q: 1.5 },
  { id: 'res-sanitario', grupo: 'Residencial', local: 'Sanitários', q: 1.5 },
  { id: 'res-servico', grupo: 'Residencial', local: 'Despensa, área de serviço e lavanderia', q: 2.0 },
  { id: 'res-corredor-unidade', grupo: 'Residencial', local: 'Corredores dentro das unidades', q: 1.5 },
  { id: 'res-corredor-comum', grupo: 'Residencial', local: 'Corredores de uso comum', q: 3.0 },
  { id: 'res-uso-comum', grupo: 'Residencial', local: 'Áreas de uso comum', q: 3.0 },
  { id: 'res-festas', grupo: 'Residencial', local: 'Salão de festas e de jogos', q: 3.0 },
  { id: 'res-academia', grupo: 'Residencial', local: 'Academia', q: 3.0 },
  { id: 'res-deposito', grupo: 'Residencial', local: 'Depósitos', q: 3.0 },
  { id: 'res-sotao', grupo: 'Residencial', local: 'Sótão', q: 2.0 },
  { id: 'res-quadra', grupo: 'Residencial', local: 'Quadras esportivas', q: 5.0 },
  { id: 'varanda-res', grupo: 'Terraços, sacadas e varandas', local: 'Uso residencial', q: 2.5 },
  { id: 'varanda-com', grupo: 'Terraços, sacadas e varandas', local: 'Uso comercial e escritórios', q: 3.0 },
  { id: 'varanda-pub', grupo: 'Terraços, sacadas e varandas', local: 'Com acesso público (hotéis, escolas, hospitais…)', q: 4.0 },
  { id: 'cob-manutencao', grupo: 'Coberturas', local: 'Acesso só para manutenção ou inspeção', q: 1.0 },
  { id: 'escada-res-unidade', grupo: 'Escadas e passarelas', local: 'Residencial, dentro das unidades', q: 2.5 },
  { id: 'escada-res-comum', grupo: 'Escadas e passarelas', local: 'Residencial, de uso comum', q: 3.0 },
  { id: 'escada-comercial', grupo: 'Escadas e passarelas', local: 'Comercial, escritórios e bibliotecas', q: 3.0 },
  { id: 'esc-geral', grupo: 'Escritórios', local: 'Salas de uso geral e sanitários', q: 2.5 },
  { id: 'esc-callcenter', grupo: 'Escritórios', local: 'Call center', q: 3.0 },
  { id: 'esc-arquivo', grupo: 'Escritórios', local: 'Regiões de arquivos deslizantes', q: 5.0 },
  { id: 'escola-sala', grupo: 'Escolas', local: 'Salas de aula', q: 3.0 },
  { id: 'biblio-leitura', grupo: 'Bibliotecas', local: 'Sala de leitura sem estantes', q: 3.0 },
  { id: 'biblio-leitura-estantes', grupo: 'Bibliotecas', local: 'Sala de leitura com estantes', q: 4.0 },
  { id: 'hospital-quarto', grupo: 'Hospitais', local: 'Dormitórios e enfermarias', q: 2.0 },
  { id: 'hospital-corredor', grupo: 'Hospitais', local: 'Corredores', q: 3.0 },
  { id: 'loja', grupo: 'Comércio', local: 'Lojas', q: 5.0 },
  { id: 'restaurante', grupo: 'Comércio', local: 'Restaurantes e refeitórios', q: 3.0 },
  { id: 'reuniao-fixos', grupo: 'Locais de reunião', local: 'Plateia com assentos fixos', q: 4.0 },
  { id: 'reuniao-moveis', grupo: 'Locais de reunião', local: 'Plateia com assentos móveis', q: 5.0 },
];

export const cargaUso = (id) => CARGAS_USO.find((u) => u.id === id) ?? null;
export const rotuloUso = (u) => `${u.grupo} · ${u.local}`;

/* ======================================================================== revestimentos de laje */

/** Pisos para a composição do revestimento (peso específico da Tabela 1). */
export const PISOS = [
  { id: 'nenhum', nome: 'Sem piso', gama: 0 },
  { id: 'ceramico', nome: 'Cerâmico', material: 'lajota-ceramica' },
  { id: 'porcelanato', nome: 'Porcelanato', material: 'porcelanato' },
  { id: 'granito', nome: 'Granito', material: 'granito' },
  { id: 'marmore', nome: 'Mármore', material: 'marmore' },
  { id: 'madeira', nome: 'Madeira (taco, assoalho)', material: 'madeira-dicot-c30' },
];

/** Revestimento do teto (face inferior da laje). */
export const TETOS = [
  { id: 'nenhum', nome: 'Sem revestimento' },
  { id: 'gesso', nome: 'Gesso', material: 'arg-gesso' },
  { id: 'reboco', nome: 'Reboco (cal, cimento e areia)', material: 'arg-cal-cimento-areia' },
];

/** Forros (kN/m², incluindo a estrutura de suporte). */
export const FORROS = [
  { id: 'nenhum', nome: 'Sem forro', p: 0 },
  { id: 'gesso-acartonado', nome: 'Gesso acartonado', p: 0.25, conferir: 'Valor do projeto de revisão de 2017 da NBR 6120; conferir na versão publicada.' },
  { id: 'gesso-placas', nome: 'Placas de gesso', p: 0.15, conferir: 'Valor do projeto de revisão de 2017 da NBR 6120; conferir na versão publicada.' },
];

export const COMPOSICAO_PADRAO = { contrapiso: 3, piso: 'ceramico', pisoEsp: 1, teto: 'gesso', tetoEsp: 1, forro: 'nenhum' };

/**
 * Peso do revestimento de uma laje por camadas (kN/m²).
 * @param {object} c  { contrapiso (cm), piso (id), pisoEsp (cm), teto (id), tetoEsp (cm), forro (id) }
 * @param {{forro?:boolean}} [op]  forro: false quando o módulo tem o forro em campo próprio
 * @returns {{ total:number, camadas:{nome:string, espessura?:number, gama?:number, p:number}[] }}
 */
export function cargaRevestimento(c = {}, { forro = true } = {}) {
  const camadas = [];
  const add = (nome, espessura, gama, conferir) => {
    if (!(espessura > 0) || !(gama > 0)) return;
    camadas.push({ nome, espessura, gama, p: (espessura / 100) * gama, conferir });
  };
  add('Contrapiso (argamassa de cimento e areia)', Number(c.contrapiso) || 0, pesoEspecifico('arg-cimento-areia').gama);
  const piso = PISOS.find((p) => p.id === c.piso);
  if (piso?.material) add(`Piso ${piso.nome.toLowerCase()}`, Number(c.pisoEsp) || 0, pesoEspecifico(piso.material).gama);
  const teto = TETOS.find((t) => t.id === c.teto);
  if (teto?.material) add(`Teto: ${teto.nome.toLowerCase()}`, Number(c.tetoEsp) || 0, pesoEspecifico(teto.material).gama);
  if (forro) {
    const f = FORROS.find((x) => x.id === c.forro);
    if (f && f.p > 0) camadas.push({ nome: `Forro de ${f.nome.toLowerCase()}`, p: f.p, conferir: f.conferir });
  }
  const total = camadas.reduce((s, x) => s + x.p, 0);
  return { total: Math.round(total * 1000) / 1000, camadas };
}

function fmt(v) {
  return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}
