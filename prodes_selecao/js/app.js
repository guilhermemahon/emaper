const NIVEL_ORDER = {'Técnico':0,'Superior':1,'Doutorado':2};

/* SUBPROJETOS — a base traz só o nome da ação (`vaga.acao`); o número vem do edital.
   Usamos o número DO EDITAL, não o do PRODES: é por ele que a pessoa se localiza no PDF.
   Ele se repete entre os dois editais (44 tem 1, 2.1, 2.2; 45 tem 1 a 6), mas a tabela já
   é separada por edital, então dentro de um bloco o número é único. Verificado na base:
   as 3 ações de pesquisa/serviços só existem no 44 e as outras 6 só no 45. */
const SUBPROJETOS = {
  "Pesquisa Agropecuária aplicada aos APL's (animal)":  { nro:'1',   ord:1.0, rotulo:'SUBPROJETO 1: Pesquisa Agropecuária de produção animal aplicada às demandas dos APLs' },
  "Pesquisa Agropecuária aplicada aos APL's (vegetal)": { nro:'2.1', ord:2.1, rotulo:'SUBPROJETO 2: Pesquisa Agropecuária de produção vegetal aplicada às demandas dos APLs' },
  "Serviços Tecnológicos aos APL's":                    { nro:'2.2', ord:2.2, rotulo:'SUBPROJETO 2: Pesquisa Agropecuária — Serviços Tecnológicos' },
  'ATER, Tecnologia e Inovação':                        { nro:'1',   ord:1.0, rotulo:'SUBPROJETO 1: Assistência Técnica e Extensão Rural — Ater, Tecnologia e Inovação' },
  'Crédito Rural, Financiamento e Fomento':             { nro:'2',   ord:2.0, rotulo:'SUBPROJETO 2: Crédito Rural e Fomento à Produção Sustentável' },
  'Agroindustrialização e Gestão':                      { nro:'3',   ord:3.0, rotulo:'SUBPROJETO 3: Projetos Agroindustriais e Organização Cooperativa' },
  'Comercialização e Mercados':                         { nro:'4',   ord:4.0, rotulo:'SUBPROJETO 4: Fortalecimento das Feiras e dos Canais de Comercialização' },
  'Fortalecimento da Reforma Agrária':                  { nro:'5',   ord:5.0, rotulo:'SUBPROJETO 5: Fortalecimento da Organização Social em Assentamentos' },
  'Regularização de Imóveis Rurais':                    { nro:'6',   ord:6.0, rotulo:'SUBPROJETO 6: Regularização Fundiária e Projetos de Assentamento' }
};
const SUB_VAZIO = { nro:'—', ord:99, rotulo:'' };
function subprojetoDe(acao){ return SUBPROJETOS[acao] || SUB_VAZIO; }

function allFormacoes(){
  const set = new Set();
  Object.values(DATA.perfilFormacoes).forEach(fs => fs.forEach(f => set.add(f.nome)));
  return Array.from(set).sort((a,b)=>a.localeCompare(b,'pt-BR'));
}
/* Sem filtro por edital: os dois blocos da tabela (distTableByEdital) já separam um do
   outro de forma permanente e visível, e um controle a menos deixa a §3 com os dois
   filtros que correspondem a como a pessoa busca — formação e município. */
function filterVagas(municipio, formacao){
  return DATA.vagas.filter(v=>{
    if (municipio && v.municipio !== municipio) return false;
    if (formacao){
      const fs = DATA.perfilFormacoes[v.id_perfil] || [];
      if (!fs.some(f=>f.nome===formacao)) return false;
    }
    return true;
  });
}
function summarizeBolsa(vagas){
  const m = new Map();
  vagas.forEach(v=>m.set(v.nivel, v.bolsa));
  return Array.from(m.entries()).sort((a,b)=>NIVEL_ORDER[a[0]]-NIVEL_ORDER[b[0]]);
}
function summarizePerfilMunicipio(vagas){
  const m = {};
  vagas.forEach(v=>{
    const g = m[v.id_perfil] = m[v.id_perfil] || {
      id_perfil:v.id_perfil, nro:v.nro_perfil, nome:v.perfil_nome, nivel:v.nivel,
      // 1 ação por perfil (conferido na base), então guardar a primeira basta
      sub:subprojetoDe(v.acao),
      count:0, municipios:{}
    };
    g.count += 1;
    g.municipios[v.municipio] = (g.municipios[v.municipio] || 0) + 1;
  });
  return Object.values(m)
    .map(g=>({ ...g, municipios: Object.entries(g.municipios).sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0],'pt-BR')) }))
    .sort((a,b)=>b.count-a.count || (a.nro||0)-(b.nro||0));
}
const DIST_SORT_COLUMNS = {
  // Ordena por subprojeto e depois por perfil — é a ordem em que os dois aparecem
  // no edital, e agora também a ordem do prefixo "S… · P…" que abre cada linha.
  nome:    { label:'Perfil', cmp:(a,b)=> (a.sub.ord-b.sub.ord) || (a.nro||0)-(b.nro||0), defaultDir:'asc' },
  count:   { label:'Vagas',  cmp:(a,b)=> a.count-b.count, defaultDir:'desc' }
};

/* O nível já está escrito no nome de 39 dos 46 perfis ("Profissional NS -",
   "Profissional NM -", "Técnico ...") — nos 33 do Edital 45, em todos. Por isso não há
   coluna de nível: o rótulo só é acrescentado nas linhas onde ele realmente falta (os 7
   "Pesquisador na área de..." do Edital 44, todos Doutorado). O teste é por nível, e não
   uma lista fixa de perfis, para continuar valendo se a base for regerada. */
const NIVEL_JA_NO_NOME = { 'Doutorado':/doutor/, 'Superior':/\bns\b|nivel superior/, 'Técnico':/\bnm\b|\btecnic/ };
function nivelFaltandoNoNome(g){
  const re = NIVEL_JA_NO_NOME[g.nivel];
  return (re && re.test(normalizeText(g.nome))) ? '' : g.nivel;
}
let distSort = { key:'nome', dir:'asc' };
function toggleDistSort(key){
  if (distSort.key === key) distSort.dir = (distSort.dir === 'asc' ? 'desc' : 'asc');
  else distSort = { key, dir: DIST_SORT_COLUMNS[key].defaultDir };
  render();
}
function distTable(vagas){
  const rows = summarizePerfilMunicipio(vagas);
  if (!rows.length) return '<p style="text-align:center; color:var(--text-muted)">Nenhuma vaga para os filtros selecionados.</p>';
  const col = DIST_SORT_COLUMNS[distSort.key];
  const sign = distSort.dir === 'asc' ? 1 : -1;
  rows.sort((a,b)=> sign*col.cmp(a,b) || a.count-b.count || (a.nro||0)-(b.nro||0));
  const arrow = distSort.dir === 'asc' ? '▲' : '▼';
  const headerCell = (key)=> '<span class="dist-col-sort'+(distSort.key===key?' active':'')+'" data-sort="'+key+'">'+DIST_SORT_COLUMNS[key].label+(distSort.key===key?' '+arrow:'')+'</span>';
  // sem célula vazia inicial: a seta do accordion é posicionada no recuo que a
  // própria linha já tem, em vez de ocupar uma coluna do grid
  const header = '<div class="dist-header dist-row-grid">'+
    headerCell('nome')+headerCell('count')+
    '</div>';
  return '<div class="dist-table">' + header + rows.map(g=>{
    const nivel = nivelFaltandoNoNome(g);
    const nMun = g.municipios.length;
    return '<details class="dist-row"><summary><span class="dist-row-grid">'+
      // Tudo o que identifica a vaga cabe numa string só. Subprojeto e perfil por
      // extenso: é o par que a pessoa precisa citar na inscrição, e abreviar exigiria
      // decodificar. O nome completo do subprojeto aparece ao abrir a linha. Nível e
      // nº de cidades entram como texto corrido, e não como colunas fixas, para não
      // reservarem largura em toda linha.
      '<span class="perfil-name">'+
        '<span class="perfil-ref" title="'+g.sub.rotulo+'">'+
          'Subprojeto '+g.sub.nro+' · Perfil '+(g.nro ?? '—')+'</span> · '+g.nome+
        (nivel ? ' <span class="perfil-meta">'+nivel+'</span>' : '')+
        ' <span class="perfil-meta">'+nMun+' cidade'+(nMun===1?'':'s')+'</span>'+
      '</span>'+
      '<span class="perfil-count">'+g.count+' vaga'+(g.count===1?'':'s')+'</span>'+
    '</span></summary>'+
    (g.sub.rotulo ? '<p class="dist-sub-nome">'+g.sub.rotulo+'</p>' : '')+
    '<div class="dist-cidades">'+
      g.municipios.map(([mun,c])=>'<span class="dist-cidade clickable" data-municipio="'+mun+'">'+mun+' <b>×'+c+'</b></span>').join('')+
    '</div></details>';
  }).join('') + '</div>';
}
const EDITAL_LABELS = { '44':'Edital 44 — Para Pesquisador', '45':'Edital 45 — Para Extensionista' };

/* Cada bloco de edital abre e fecha, e ambos começam FECHADOS: a página abre como um
   panorama de uma tela — contagem, filtros, os dois editais com seus totais, CTA e ajuda
   todos visíveis de uma vez — e a pessoa abre só o edital que é o dela. É por isso que a
   contagem de vagas fica no título: fechado, o bloco ainda diz o que há lá dentro.
   O render() reescreve a tabela inteira a cada filtro, o que zeraria o estado; por isso
   ele fica aqui fora e é reaplicado a cada montagem. */
const distBlocksOpen = { '44':false, '45':false };

/* Fechado é o padrão do panorama — do estado SEM filtro. Assim que a pessoa filtra, ela
   pediu explicitamente por um recorte, e entregar isso fechado seria esconder o resultado
   do trabalho que ela acabou de fazer: os blocos abrem. Ao limpar o filtro, volta ao
   panorama. Só reage à MUDANÇA de filtrado/não-filtrado, e não a todo render, para não
   reabrir um bloco que a pessoa fechou de propósito enquanto o filtro seguia ativo. */
let distFiltroAtivo = false;
function syncDistBlocks(temFiltro){
  if (temFiltro === distFiltroAtivo) return;
  distFiltroAtivo = temFiltro;
  distBlocksOpen['44'] = distBlocksOpen['45'] = temFiltro;
}
document.addEventListener('toggle', (e)=>{
  const el = e.target;
  if (el.dataset && el.dataset.edital) distBlocksOpen[el.dataset.edital] = el.open;
}, true); // `toggle` não borbulha — a delegação precisa da fase de captura

function distTableByEdital(vagas){
  const byEdital = { '44':[], '45':[] };
  vagas.forEach(v=>{
    const ed = editalFromPerfil(v.id_perfil);
    if (byEdital[ed]) byEdital[ed].push(v);
  });
  const blocks = ['44','45'].filter(ed=>byEdital[ed].length).map(ed=>{
    const n = byEdital[ed].length;
    // A contagem no título é o que torna seguro dobrar: fechado, ainda se sabe o que há lá dentro.
    return '<details class="dist-block" data-edital="'+ed+'"'+(distBlocksOpen[ed] ? ' open' : '')+'>'+
      '<summary class="dist-edital-title">'+EDITAL_LABELS[ed]+
        '<span class="dist-edital-count">'+n+' vaga'+(n===1?'':'s')+'</span></summary>'+
      distTable(byEdital[ed])+
    '</details>';
  }).join('');
  return blocks || '<p style="text-align:center; color:var(--text-muted)">Nenhuma vaga para os filtros selecionados.</p>';
}
function editalFromPerfil(id_perfil){
  const m = /^PER-E(\d+)-/.exec(id_perfil || '');
  return m ? m[1] : '—';
}
let state = { municipio:null, formacao:null };

function normalizeText(s){
  return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
}

/* Listas dos dropdowns, ordenadas por nº de vagas (maior primeiro) e com a contagem ao
   lado. Ordem alfabética servia para ACHAR um item conhecido, mas isso quem resolve é a
   digitação, que filtra a lista; a ordem da lista pode então servir para outra coisa —
   mostrar onde estão as oportunidades.
   Cada lista conta dentro do que o OUTRO filtro já selecionou, e não sobre a base inteira:
   assim o número é verdadeiro para o que a pessoa vai ver, e uma combinação de zero vagas
   nem chega a aparecer como opção. Empate desempata por nome. */
function ordenarPorVagas(mapa){
  return Array.from(mapa, ([nome,count])=>({nome,count}))
    .sort((a,b)=> b.count-a.count || a.nome.localeCompare(b.nome,'pt-BR'));
}
function formacoesComContagem(){
  const m = new Map();
  // Uma vaga aceita várias formações, então ela conta para cada uma — é exatamente o que
  // o número quer dizer: "quantas vagas aceitam esta formação".
  filterVagas(state.municipio, null).forEach(v=>{
    (DATA.perfilFormacoes[v.id_perfil] || []).forEach(f=> m.set(f.nome, (m.get(f.nome)||0)+1));
  });
  return ordenarPorVagas(m);
}
function municipiosComContagem(){
  const m = new Map();
  filterVagas(null, state.formacao).forEach(v=> m.set(v.municipio, (m.get(v.municipio)||0)+1));
  return ordenarPorVagas(m);
}
function fitInputWidth(el){
  if (!window._measureSpan){
    const s = document.createElement('span');
    s.style.cssText = 'position:absolute; visibility:hidden; white-space:pre; left:-9999px; top:-9999px;';
    document.body.appendChild(s);
    window._measureSpan = s;
  }
  const s = window._measureSpan, cs = getComputedStyle(el);
  s.style.font = cs.font; s.style.fontWeight = cs.fontWeight; s.style.letterSpacing = cs.letterSpacing; s.style.textTransform = cs.textTransform;
  s.textContent = el.value || el.placeholder || '';
  el.style.width = (s.offsetWidth + 12) + 'px';
}
function setFieldValue(ids, value){
  ids.forEach(id=>{
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value; el._lastCommitted = value; el.classList.remove('invalid'); fitInputWidth(el);
  });
}
// dropdown flutuante por campo: abre ao focar/clicar, filtra ao digitar, fecha ao selecionar ou clicar fora
function setupFieldDropdown(wrapperId, inputId, validList, onSet, resetLabel){
  const wrapper = document.getElementById(wrapperId);
  const input = document.getElementById(inputId);
  if (!wrapper || !input) return;
  const panel = document.createElement('div');
  panel.className = 'fl-dropdown-panel';
  panel.hidden = true;
  wrapper.appendChild(panel);
  input.setAttribute('role','combobox');
  input.setAttribute('aria-expanded','false');
  input.setAttribute('aria-autocomplete','list');

  let items = [];
  let activeIndex = -1;
  let mouseDownOnPanel = false;

  // validList() devolve [{nome, count}] — o nome é o valor, a contagem só aparece na lista
  function currentOptions(){
    const q = normalizeText(input.value);
    const all = validList();
    return q ? all.filter(v=>normalizeText(v.nome).includes(q)) : all;
  }
  function highlight(){
    panel.querySelectorAll('.fl-dropdown-option').forEach((el,i)=>el.classList.toggle('active', i===activeIndex));
    if (activeIndex >= 0){
      const el = panel.children[activeIndex + 1];
      if (el) el.scrollIntoView({block:'nearest'});
    }
  }
  function open(){
    items = currentOptions();
    activeIndex = -1;
    // O valor vai no data-value, e não mais no textContent: agora o texto do item inclui
    // a contagem, e lê-lo de volta na seleção traria "Agronomia 26" como nome.
    const rows = items.length
      ? items.map(v=>'<div class="fl-dropdown-option" data-value="'+v.nome.replace(/"/g,'&quot;')+'">'+
          '<span class="opt-nome">'+v.nome+'</span>'+
          '<span class="opt-count">'+v.count+'</span></div>').join('')
      : '<div class="fl-dropdown-empty">Nenhum resultado</div>';
    panel.innerHTML = '<div class="fl-dropdown-option fl-dropdown-reset">'+resetLabel+'</div>' + rows;
    panel.hidden = false;
    wrapper.classList.add('open');
    input.setAttribute('aria-expanded','true');
  }
  function close(){
    panel.hidden = true;
    wrapper.classList.remove('open');
    input.setAttribute('aria-expanded','false');
  }
  function select(value){
    setFieldValue([inputId], value || '');
    onSet(value);
    close();
    render();
  }
  function revert(){
    setFieldValue([inputId], input._lastCommitted || '');
  }

  panel.addEventListener('mousedown', ()=>{ mouseDownOnPanel = true; });
  panel.addEventListener('mouseup', ()=>{ mouseDownOnPanel = false; });
  panel.addEventListener('click', (e)=>{
    const opt = e.target.closest('.fl-dropdown-option');
    if (!opt) return;
    if (opt.classList.contains('fl-dropdown-reset')){ select(null); return; }
    select(opt.dataset.value);
  });

  fitInputWidth(input);
  // Agora a caixa inteira parece um botão, então ela toda precisa abrir o dropdown —
  // não só o texto. O clique no input já é tratado abaixo; aqui vale a sobra e a seta.
  const row = input.closest('.fl-field-row');
  if (row) row.addEventListener('click', (e)=>{ if (e.target !== input) input.focus(); });
  input.addEventListener('focus', open);
  input.addEventListener('click', open);
  input.addEventListener('input', ()=>{ fitInputWidth(input); open(); });
  input.addEventListener('keydown', (e)=>{
    if (panel.hidden && (e.key === 'ArrowDown' || e.key === 'ArrowUp')){ open(); return; }
    if (e.key === 'ArrowDown'){ e.preventDefault(); activeIndex = Math.min(activeIndex + 1, items.length - 1); highlight(); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); activeIndex = Math.max(activeIndex - 1, -1); highlight(); }
    else if (e.key === 'Enter'){
      e.preventDefault();
      if (activeIndex >= 0 && items[activeIndex] !== undefined) select(items[activeIndex].nome);
      else {
        const val = input.value.trim();
        if (val === ''){ select(null); return; }
        const match = validList().find(x => normalizeText(x.nome) === normalizeText(val));
        if (match) select(match.nome); else input.classList.add('invalid');
      }
    } else if (e.key === 'Escape'){ close(); input.blur(); }
  });
  input.addEventListener('blur', ()=>{
    setTimeout(()=>{
      if (mouseDownOnPanel) return;
      close();
      const val = input.value.trim();
      if (val === ''){ setFieldValue([inputId], ''); onSet(null); render(); return; }
      const match = validList().find(x => normalizeText(x.nome) === normalizeText(val));
      if (match){ setFieldValue([inputId], match.nome); onSet(match.nome); render(); }
      else { revert(); fitInputWidth(input); }
    }, 150);
  });
}
function selectMunicipio(nome){
  setFieldValue(['muniInputFlyer'], nome);
  state.municipio = nome;
  render();
  window.scrollTo({top:0, behavior:'smooth'});
}
function loadYoutubeFacade(el){
  const id = el.dataset.ytFacade;
  const iframe = document.createElement('iframe');
  iframe.src = 'https://www.youtube.com/embed/'+id+'?autoplay=1';
  iframe.title = el.getAttribute('aria-label') || 'Vídeo do YouTube';
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  iframe.allowFullscreen = true;
  el.replaceChildren(iframe);
  el.removeAttribute('role');
  el.removeAttribute('tabindex');
  delete el.dataset.ytFacade;
}
document.addEventListener('click', (e)=>{
  const m = e.target.closest('[data-municipio]');
  if (m){ selectMunicipio(m.dataset.municipio); return; }
  const s = e.target.closest('[data-sort]');
  if (s){ toggleDistSort(s.dataset.sort); return; }
  const yt = e.target.closest('[data-yt-facade]');
  if (yt){ loadYoutubeFacade(yt); return; }
});
document.addEventListener('keydown', (e)=>{
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const yt = e.target.closest('[data-yt-facade]');
  if (yt){ e.preventDefault(); loadYoutubeFacade(yt); }
});

// ---- despachante ----
function render(){
  const { municipio, formacao } = state;
  const filtered = filterVagas(municipio, formacao);
  syncDistBlocks(!!(municipio || formacao));
  const bolsa = summarizeBolsa(filtered);

  document.getElementById('flCount').textContent = filtered.length;

  const bolsaBody = document.getElementById('flBolsas');
  bolsaBody.innerHTML = bolsa.map(([niv,val])=>
    '<tr><td>'+niv+'</td><td class="num">R$ '+val.toLocaleString('pt-BR')+'</td></tr>'
  ).join('') || '<tr><td colspan="2" style="color:var(--text-muted)">sem vagas</td></tr>';

  const flDist = document.getElementById('flDistTable');
  if (flDist) flDist.innerHTML = distTableByEdital(filtered);

  updateURL();
}

// ---- estado refletido na URL (?formacao=...&municipio=...), para permitir compartilhar o link direto ----
function readStateFromURL(){
  const params = new URLSearchParams(location.search);
  const f = params.get('formacao');
  const m = params.get('municipio');
  if (f && allFormacoes().includes(f)) state.formacao = f;
  if (m && DATA.municipios.includes(m)) state.municipio = m;
  if (state.formacao) setFieldValue(['formInputFlyer'], state.formacao);
  if (state.municipio) setFieldValue(['muniInputFlyer'], state.municipio);
  // ?edital= é ignorado de propósito: sem o botão não haveria como desfazer o filtro,
  // e um link antigo com ele agora cai na lista completa em vez de prender a pessoa
  // num recorte sem saída.
}
function updateURL(){
  const params = new URLSearchParams();
  if (state.formacao) params.set('formacao', state.formacao);
  if (state.municipio) params.set('municipio', state.municipio);
  const qs = params.toString();
  const newUrl = location.pathname + (qs ? '?' + qs : '');
  try {
    history.replaceState(null, '', newUrl);
  } catch (e) {
    // Em ambientes sandboxed (ex.: prévia embutida do Claude, que roda o HTML dentro de um
    // iframe "srcdoc" sem URL de verdade), o navegador bloqueia replaceState por segurança.
    // Isso não afeta nada da peça em si — só significa que, NESSA prévia, o link da barra de
    // endereço não vai refletir a seleção. Uma vez hospedado no domínio de vocês, funciona normalmente.
  }
}

readStateFromURL();
setupFieldDropdown('formField', 'formInputFlyer', formacoesComContagem, v => state.formacao = v, 'Todas as formações');
setupFieldDropdown('muniField', 'muniInputFlyer', municipiosComContagem, v => state.municipio = v, 'Todos os municípios');
render();

/* A largura de cada campo é calculada em JS a partir do texto, mas a fonte muda por
   media query (17px no celular, 19px a partir de 640px). Sem isto, quem gira o celular
   ou redimensiona a janela cruzando esse limite fica com a largura antiga e o texto
   cortado — "Todas as formaçõe▾". Debounce para não remedir a cada pixel do arrasto. */
let resizeTimer;
window.addEventListener('resize', ()=>{
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(()=>{
    ['formInputFlyer','muniInputFlyer'].forEach(id=>{
      const el = document.getElementById(id);
      if (el) fitInputWidth(el);
    });
  }, 120);
});
