"""Refaz as capturas de tela de docs/imagens (apresentação e README).

Uso (Linux, com Xvfb e o Playwright para Python):
    python3 tools/capturas/capturar.py            # grava em docs/imagens
    python3 tools/capturas/capturar.py /tmp/saida  # grava em outra pasta

Abre o LEBR numa tela virtual de 1500 × 940, abre o exemplo de 3 pavimentos e percorre as telas. As capturas de
DXF (dxf-formas.png e dxf-armacao-vigas.png) são desenhos das pranchas e não são refeitas aqui.
"""
import base64, os, signal, subprocess, sys, time, urllib.request
from playwright.sync_api import sync_playwright

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SAIDA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'docs', 'imagens'))
TEMP = os.path.join(SAIDA, '.tmp-capturas')
os.makedirs(TEMP, exist_ok=True)
DISP, PORTA = ':97', 9341
W, H = 1500, 940

xvfb = subprocess.Popen(['Xvfb', DISP, '-screen', '0', '1600x1000x24', '-nocursor'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
app = subprocess.Popen([os.path.join(RAIZ, 'node_modules', '.bin', 'electron'), '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
                        '--ignore-gpu-blocklist', f'--remote-debugging-port={PORTA}', '.'],
                       cwd=RAIZ, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=dict(os.environ, DISPLAY=DISP), start_new_session=True)


def esperar(cond, limite=180, passo=0.5):
    t0 = time.time()
    while time.time() - t0 < limite:
        try:
            if cond(): return True
        except Exception: pass
        time.sleep(passo)
    return False


try:
    esperar(lambda: urllib.request.urlopen(f'http://127.0.0.1:{PORTA}/json/version', timeout=1), 60)
    with sync_playwright() as p:
        nav = p.chromium.connect_over_cdp(f'http://127.0.0.1:{PORTA}')
        pg = None
        def achar():
            global pg
            for c in nav.contexts:
                for x in c.pages:
                    if 'index.html' in x.url: pg = x
            return pg
        esperar(achar, 30, 0.25)
        pg.set_default_timeout(15000)
        cdp = pg.context.new_cdp_session(pg)
        time.sleep(2)

        def js(c, a=None): return pg.evaluate(c, a) if a is not None else pg.evaluate(c)
        def cmd(c): js('(c) => { window.__lebr.comandos.executar(c); }', c)
        def limpar(): js("() => document.querySelectorAll('.notificacao').forEach(n => n.remove())")
        def foto(nome, pasta=SAIDA):
            limpar(); js("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
            d = cdp.send('Page.captureScreenshot', {'format': 'png'})
            open(os.path.join(pasta, f'{nome}.png'), 'wb').write(base64.b64decode(d['data'])); print('captura', nome, flush=True)
        def item(cod): return pg.locator('.arvore-item', has_text=cod).first
        def abrir(cod):
            js(r"""(c) => { const x=[...document.querySelectorAll('.arvore-item')].find(e=>e.textContent.includes(c)); x && x.scrollIntoView({block:'center'}); }""", cod)
            item(cod).click(); time.sleep(1.5)
        def rolar(titulo, desloc=78):
            js(r"""([t, desloc]) => {
              const x = [...document.querySelectorAll('.secao-titulo')].find(e => e.textContent.trim().startsWith(t) && e.offsetParent); if (!x) return;
              let p = x.parentElement; while (p && !(p.scrollHeight > p.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(p).overflowY))) p = p.parentElement;
              if (p) p.scrollTop = p.scrollTop + x.getBoundingClientRect().top - p.getBoundingClientRect().top - desloc; }""", [titulo, desloc])
            time.sleep(0.6)
        def topo(): js("() => document.querySelectorAll('*').forEach(e => { if (e.scrollTop > 0 && !e.classList.contains('arvore')) e.scrollTop = 0; })"); time.sleep(0.3)
        def segmento(texto): pg.locator('.segmentado button', has_text=texto).first.click()
        def campo(rotulo, valor):
            i = pg.locator('.campo', has_text=rotulo).locator('input').first; i.fill(str(valor)); i.press('Enter'); time.sleep(0.4)
        def situacao(): return js("() => document.querySelector('.status')?.textContent ?? ''")
        def calcular_tudo():
            cmd('elemento.calcularTodos'); time.sleep(1); esperar(lambda: 'Tudo atende' in situacao(), 120)
        def roda(x, y, delta, n=1):
            pg.mouse.move(x, y)
            for _ in range(n): pg.mouse.wheel(0, delta); time.sleep(0.15)
            time.sleep(1.2)
        def barra(nome): pg.screenshot(path=os.path.join(TEMP, f'barra-{nome}.png'), clip={'x': 0, 'y': H - 24, 'width': W, 'height': 24})

        # janela e preferências
        js(f'() => {{ window.moveTo(0, 0); window.resizeTo({W}, {H}); }}'); time.sleep(1)
        w = js('() => [innerWidth, innerHeight]')
        if w != [W, H]: js(f'() => window.resizeTo({2 * W - w[0]}, {2 * H - w[1]})'); time.sleep(1)
        js("() => { try { localStorage.setItem('lebr.fixar3D','0'); localStorage.setItem('lebr.explorador.soPendencias','nao'); localStorage.setItem('lebr.explorador.legenda','nao'); } catch {} }")
        cmd('exibir.tema.claro'); time.sleep(0.5)

        foto('tela-inicial')

        # exemplo de 3 pavimentos
        cmd('projeto.abrirExemplo3')
        esperar(lambda: js("() => !!(window.__lebr.estado.projeto && window.__lebr.estado.projeto.elementos.length > 60 && window.__lebr.estado.projeto.elementos.every(e => e.resultado))") and 'Tudo atende' in situacao())
        time.sleep(1.5); js('() => window.__lebr.wb.alternarPainel(false)')
        for _ in range(6): cmd('aba.fechar'); time.sleep(0.2)

        # viga
        abrir('V201'); time.sleep(1); foto('elemento-cabecalho')
        rolar('Diagramas'); foto('viga-diagramas')
        rolar('Detalhamento das barras', 74); foto('viga-detalhamento')
        segmento('Armadura em 3D'); time.sleep(3); foto('armadura-3d-viga')
        # pilar e laje
        abrir('P205'); rolar('Detalhamento', 74); foto('pilar-detalhamento')
        segmento('Armadura em 3D'); time.sleep(3); foto('armadura-3d-pilar')
        abrir('L102'); rolar('Detalhamento das barras', 74); foto('laje-armacao')
        segmento('Armadura em 3D'); time.sleep(3); foto('armadura-3d-laje')
        # pilar circular (P105) — enquanto recalcula, a barra fica cinza
        abrir('P105'); rolar('Seção e comprimento', 84); segmento('Circular'); time.sleep(1); cmd('elemento.calcular'); time.sleep(2)
        barra('cinza')
        calcular_tudo(); barra('verde')
        rolar('Detalhamento', 74); segmento('Desenho'); time.sleep(1); foto('pilar-circular')
        segmento('Armadura em 3D'); time.sleep(3); foto('armadura-3d-pilar-circular')
        # viga que não atende: sugestão de seção (e a barra terracota)
        abrir('V104'); campo('Altura h', 22); campo('Largura b', 12); cmd('elemento.calcular'); time.sleep(3)
        barra('terracota'); rolar('Resultados'); foto('sugestao-secao')
        topo(); campo('Altura h', 50); campo('Largura b', 15); calcular_tudo()
        # otimização
        abrir('V201'); rolar('Armadura'); segmento('Menos bitolas diferentes'); time.sleep(4); rolar('Armadura'); foto('otimizacao-bitolas')
        abrir('P205'); rolar('Armadura'); segmento('Menos segmentos de barra'); time.sleep(4); rolar('Armadura'); foto('otimizacao-segmentos')
        # montagem e planta de fundo
        cmd('estrutura.montagem'); time.sleep(3)
        pg.locator('.mont-pavs > *').nth(2).locator('.mont-pav-n').click(); time.sleep(2); foto('montagem')
        dxf = open(os.path.join(RAIZ, 'tools', 'capturas', 'planta-exemplo.dxf'), encoding='utf-8').read()
        js('([t, n]) => window.__lebrMontagem.aplicarDxf(t, n)', [dxf, 'planta-arquitetura.dxf']); time.sleep(2)
        campo('Deslocar x', 0); campo('Deslocar y', 0)
        js("() => document.querySelector('.mont-fundo-nome')?.scrollIntoView({block:'center'})"); time.sleep(0.8)
        foto('montagem-planta-dxf')
        # elemento e 3D lado a lado
        for _ in range(8): cmd('aba.fechar'); time.sleep(0.2)
        abrir('V202'); time.sleep(1); cmd('exibir.fixar3D'); time.sleep(4)
        roda(1300, 500, 300, 6); roda(1300, 500, -300, 4)
        pg.keyboard.down('Shift'); pg.mouse.move(1250, 520); pg.mouse.down()
        for i in range(10): pg.mouse.move(1250 + 9 * (i + 1), 520); time.sleep(0.03)
        pg.mouse.up(); pg.keyboard.up('Shift'); time.sleep(1.2)
        foto('abas-lado-a-lado-3d')
        # 3D no tema escuro, ocupando a área toda
        pg.locator('.aba', has_text='V202').locator('.aba-fechar, button').first.click(); time.sleep(1.5)
        cmd('exibir.fixar3D'); time.sleep(1.5); cmd('aba.juntar'); time.sleep(1.5)
        pg.locator('.aba', has_text='Visualização 3D').first.click(); time.sleep(3)
        cmd('exibir.tema.escuro'); time.sleep(1.2)
        roda(1050, 480, -300, 3); roda(1050, 480, 300, 1); roda(1050, 480, 150, 1)
        foto('visualizacao-3d-escuro')
        # tema blueprint, num elemento
        cmd('exibir.tema.blueprint'); time.sleep(1); cmd('estrutura.montagem'); time.sleep(3); foto('tema-blueprint-montagem'); abrir('V201'); topo(); foto('tema-blueprint')
        cmd('exibir.tema.claro'); time.sleep(1)
        # relatórios
        cmd('estrutura.quantitativos'); time.sleep(3); foto('quantitativos')
        cmd('projeto.memorial'); time.sleep(5); foto('memorial-edificio')
        abrir('V202'); cmd('projeto.exportarDXF'); time.sleep(1.5); foto('exportar-dxf'); pg.keyboard.press('Escape'); time.sleep(0.5)
        cmd('ajuda.validacao'); time.sleep(6); foto('validacao')
        cmd('ajuda.bibliografia'); time.sleep(6); rolar('Pilares', 90); foto('exercicios-resolvidos')
        cmd('ajuda.roteiro'); time.sleep(2); rolar('Fases', 90); foto('roteiro')

        # barra de status: as três cores
        F = os.path.join(RAIZ, 'src', 'renderer', 'assets', 'fonts')
        html = f'''<html><head><style>
        @font-face{{font-family:L;src:url(file://{F}/livvic-latin-400-normal.woff2);font-weight:400}}
        @font-face{{font-family:L;src:url(file://{F}/livvic-latin-700-normal.woff2);font-weight:700}}
        body{{margin:0;background:#f3efe9;font-family:L;width:{W}px;height:258px}}
        .t{{padding:28px 16px 8px;font-size:13.5px;color:#4a4540}} .t b{{font-size:15px;color:#1d1a17;margin-right:10px;letter-spacing:.02em}}
        .t:first-child{{padding-top:30px}} img{{display:block}}</style></head><body>
        <div class=t><b>VERDE MUSGO #556B2F</b>Todos os elementos calculados e atendendo às verificações</div><img src="file://{TEMP}/barra-verde.png">
        <div class=t><b>CINZA CHUMBO #555151</b>Elementos ainda não calculados ou desatualizados (ou nenhum projeto aberto)</div><img src="file://{TEMP}/barra-cinza.png">
        <div class=t><b>TERRACOTA</b>Algum elemento não atende, tem erro de cálculo ou erro de montagem</div><img src="file://{TEMP}/barra-terracota.png">
        </body></html>'''
        open(os.path.join(TEMP, 'barra.html'), 'w', encoding='utf-8').write(html)
        b = p.chromium.launch(); q = b.new_page(viewport={'width': W, 'height': 258})
        q.goto(f'file://{TEMP}/barra.html'); q.wait_for_timeout(500); q.screenshot(path=os.path.join(SAIDA, 'barra-de-status.png')); b.close()
        print('captura barra-de-status', flush=True)
finally:
    os.killpg(app.pid, signal.SIGTERM); xvfb.terminate()
    for f in os.listdir(TEMP): os.remove(os.path.join(TEMP, f))
    os.rmdir(TEMP)
