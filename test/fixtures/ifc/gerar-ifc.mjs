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
 * IFC 2x3 de teste no estilo do Revit (unidade mm, cadeia de IfcLocalPlacement, prédio em coordenadas de
 * levantamento): três níveis (0, 3000, 6000), 2 × 6 pilares (retangulares 20 × 40, um girado 90°, um circular ø 30 e
 * um por IfcMappedItem), duas lajes 520 × 420 de 12 cm, uma laje em L (vai só para o fundo), três paredes de 14 cm
 * com corte booleano no térreo e uma viga extrudada na horizontal.
 *
 *   node test/fixtures/ifc/gerar-ifc.mjs > test/fixtures/ifc/predio-revit.ifc
 */
export function gerarIfc({ origem = [712345000, 6712345000] } = {}) {
  const L = [];
  let n = 0;
  const e = (txt) => { n++; L.push(`#${n}=${txt};`); return `#${n}`; };
  const pt = (x, y, z) => e(`IFCCARTESIANPOINT((${f(x)},${f(y)}${z == null ? '' : `,${f(z)}`}))`);
  const f = (v) => (Number.isInteger(v) ? `${v}.` : String(v));
  const dir = (x, y, z) => e(`IFCDIRECTION((${f(x)},${f(y)}${z == null ? '' : `,${f(z)}`}))`);
  const ax3 = (p, z = null, x = null) => e(`IFCAXIS2PLACEMENT3D(${p},${z ?? '$'},${x ?? '$'})`);
  const ax2 = (p, x = null) => e(`IFCAXIS2PLACEMENT2D(${p},${x ?? '$'})`);
  const lp = (pai, rel) => e(`IFCLOCALPLACEMENT(${pai ?? '$'},${rel})`);
  let g = 0;
  const gid = () => `'${String(++g).padStart(22, '0')}'`;

  const oh = e("IFCOWNERHISTORY($,$,$,.ADDED.,$,$,$,0)");
  const mm = e('IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)');
  e('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)'); // outra unidade de comprimento fora do projeto: não vale
  const un = e(`IFCUNITASSIGNMENT((${mm}))`);
  const ctx = e(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${ax3(pt(0, 0, 0))},$)`);
  e(`IFCPROJECT(${gid()},${oh},'Teste',$,$,$,$,(${ctx}),${un})`);
  const zUp = dir(0, 0, 1), xDir = dir(1, 0, 0);
  const pSite = lp(null, ax3(pt(origem[0], origem[1], 0), zUp, xDir));
  const pPredio = lp(pSite, ax3(pt(0, 0, 0)));
  const predio = e(`IFCBUILDING(${gid()},${oh},'Predio',$,$,${pPredio},$,$,.ELEMENT.,$,$,$)`);
  void predio;
  const niveis = [['T\\X2\\00E9\\X0\\rreo', 0], ['1\\X\\BA pavimento', 3000], ['Cobertura', 6000]].map(([nome, z]) => {
    const pl = lp(pPredio, ax3(pt(0, 0, z)));
    return { id: e(`IFCBUILDINGSTOREY(${gid()},${oh},'${nome}',$,$,${pl},$,$,.ELEMENT.,${f(z)})`), pl, z, elementos: [] };
  });
  const forma = (tipoRep, itens) => e(`IFCPRODUCTDEFINITIONSHAPE($,$,(${e(`IFCSHAPEREPRESENTATION(${ctx},'Body','${tipoRep}',(${itens.join(',')}))`)}))`);
  const retangulo = (X, Y, cx = 0, cy = 0) => e(`IFCRECTANGLEPROFILEDEF(.AREA.,$,${ax2(pt(cx, cy))},${f(X)},${f(Y)})`);
  const extrusao = (perfil, pos, prof, d = zUp) => e(`IFCEXTRUDEDAREASOLID(${perfil},${pos},${d},${f(prof)})`);

  // pilares: em cada um dos dois primeiros níveis, do nível até o de cima (3000 mm)
  const PILARES = [[0, 0], [5000, 0], [0, 4000], [5000, 4000], [2500, 4000], [2500, 0]];
  niveis.slice(0, 2).forEach((nv, k) => PILARES.forEach(([x, y], i) => {
    const pl = lp(nv.pl, ax3(pt(x, y, 0), zUp, i === 1 ? dir(0, 1, 0) : xDir)); // P2 girado 90° pela posição
    let rep;
    if (i === 4) rep = forma('SweptSolid', [extrusao(e(`IFCCIRCLEPROFILEDEF(.AREA.,$,${ax2(pt(0, 0))},150.)`), ax3(pt(0, 0, 0)), 3000)]);
    else if (i === 5) {
      // família do Revit: representação mapeada com origem deslocada e destino que a traz de volta
      const repMapa = e(`IFCSHAPEREPRESENTATION(${ctx},'Body','SweptSolid',(${extrusao(retangulo(200, 400), ax3(pt(1000, 0, 0)), 3000)}))`);
      const mapa = e(`IFCREPRESENTATIONMAP(${ax3(pt(1000, 0, 0))},${repMapa})`);
      const alvo = e(`IFCCARTESIANTRANSFORMATIONOPERATOR3D($,$,${pt(-2000, 0, 0)},1.,$)`);
      rep = forma('MappedRepresentation', [e(`IFCMAPPEDITEM(${mapa},${alvo})`)]);
    } else rep = forma('SweptSolid', [extrusao(retangulo(200, 400), ax3(pt(0, 0, 0)), 3000)]);
    nv.elementos.push(e(`IFCCOLUMN(${gid()},${oh},'M_Concrete-Rectangular-Column:200 x 400mm:${k}${i}',$,$,${pl},${rep},$)`));
  }));
  // lajes nos níveis 1 e 2: contorno poligonal 5200 × 4200 a partir de (−100, −100), topo no nível
  for (const nv of niveis.slice(1)) {
    const poli = e(`IFCPOLYLINE((${[[-100, -100], [5100, -100], [5100, 4100], [-100, 4100], [-100, -100]].map(([x, y]) => pt(x, y)).join(',')}))`);
    const perfil = e(`IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,${poli})`);
    const pl = lp(nv.pl, ax3(pt(0, 0, -120)));
    nv.elementos.push(e(`IFCSLAB(${gid()},${oh},'Floor:Generic 120mm',$,$,${pl},${forma('SweptSolid', [extrusao(perfil, ax3(pt(0, 0, 0)), 120)])},$,.FLOOR.)`));
  }
  // laje em L (sacada) no nível 1: só no fundo
  {
    const poli = e(`IFCPOLYLINE((${[[5100, 0], [6600, 0], [6600, 3000], [5800, 3000], [5800, 1200], [5100, 1200], [5100, 0]].map(([x, y]) => pt(x, y)).join(',')}))`);
    const pl = lp(niveis[1].pl, ax3(pt(0, 0, -120)));
    niveis[1].elementos.push(e(`IFCSLAB(${gid()},${oh},'Floor:Sacada',$,$,${pl},${forma('SweptSolid', [extrusao(e(`IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,${poli})`), ax3(pt(0, 0, 0)), 120)])},$,.FLOOR.)`));
  }
  // paredes de 14 cm no térreo (eixo nos pilares), corpo com corte booleano como o Revit exporta
  for (const [x0, y0, x1, y1] of [[0, 0, 5000, 0], [0, 4000, 5000, 4000], [0, 0, 0, 4000]]) {
    const comp = Math.hypot(x1 - x0, y1 - y0);
    const pl = lp(niveis[0].pl, ax3(pt(x0, y0, 0), zUp, dir((x1 - x0) / comp, (y1 - y0) / comp, 0)));
    const corpo = extrusao(retangulo(comp, 140, comp / 2, 0), ax3(pt(0, 0, 0)), 2500);
    const corte = e(`IFCHALFSPACESOLID(${e(`IFCPLANE(${ax3(pt(0, 0, 2500))})`)},.F.)`);
    const bool = e(`IFCBOOLEANCLIPPINGRESULT(.DIFFERENCE.,${corpo},${corte})`);
    niveis[0].elementos.push(e(`IFCWALLSTANDARDCASE(${gid()},${oh},'Basic Wall:Interior - 140mm',$,$,${pl},${forma('Clipping', [bool])},$)`));
  }
  // viga no nível 1: perfil 14 × 40 extrudado ao longo de x
  {
    const pl = lp(niveis[1].pl, ax3(pt(0, 4000, -200)));
    const pos = ax3(pt(0, 0, 0), xDir, dir(0, 1, 0)); // eixo z do sólido = x global
    niveis[1].elementos.push(e(`IFCBEAM(${gid()},${oh},'Concrete-Rectangular Beam:140 x 400mm',$,$,${pl},${forma('SweptSolid', [extrusao(retangulo(140, 400), pos, 5000)])},$)`));
  }
  for (const nv of niveis) if (nv.elementos.length) e(`IFCRELCONTAINEDINSPATIALSTRUCTURE(${gid()},${oh},$,$,(${nv.elementos.join(',')}),${nv.id})`);

  return ['ISO-10303-21;', 'HEADER;', "FILE_DESCRIPTION(('ViewDefinition [CoordinationView_V2.0]'),'2;1');",
    "FILE_NAME('predio-revit.ifc','2026-11-08T00:00:00',(''),(''),'LEBR teste','Autodesk Revit 2025 (estilo)','');",
    "FILE_SCHEMA(('IFC2X3'));", 'ENDSEC;', 'DATA;', ...L, 'ENDSEC;', 'END-ISO-10303-21;', ''].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) process.stdout.write(gerarIfc());
