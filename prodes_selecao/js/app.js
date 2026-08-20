const NIVEL_ORDER = {'Técnico':0,'Superior':1,'Doutorado':2};

function allFormacoes(){
  const set = new Set();
  Object.values(DATA.perfilFormacoes).forEach(fs => fs.forEach(f => set.add(f.nome)));
  return Array.from(set).sort((a,b)=>a.localeCompare(b,'pt-BR'));
}
function filterVagas(municipio, formacao, edital){
  return DATA.vagas.filter(v=>{
    if (municipio && v.municipio !== municipio) return false;
    if (edital && editalFromPerfil(v.id_perfil) !== edital) return false;
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
  nome:    { label:'Perfil',   cmp:(a,b)=> (a.nro||0)-(b.nro||0), defaultDir:'asc' },
  nivel:   { label:'Nível',    cmp:(a,b)=> NIVEL_ORDER[a.nivel]-NIVEL_ORDER[b.nivel], defaultDir:'asc' },
  cidades: { label:'Cidades',  cmp:(a,b)=> a.municipios.length-b.municipios.length, defaultDir:'desc' },
  count:   { label:'Vagas',    cmp:(a,b)=> a.count-b.count, defaultDir:'desc' }
};
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
    headerCell('nome')+headerCell('nivel')+headerCell('cidades')+headerCell('count')+
    '</div>';
  return '<div class="dist-table">' + header + rows.map(g=>
    '<details class="dist-row"><summary><span class="dist-row-grid">'+
      '<span class="perfil-name">Nº '+(g.nro ?? '—')+' · '+g.nome+'</span>'+
      '<span class="perfil-nivel">'+g.nivel+'</span>'+
      '<span class="perfil-cidades">'+g.municipios.length+' cidade'+(g.municipios.length===1?'':'s')+'</span>'+
      '<span class="perfil-count">'+g.count+' vaga'+(g.count===1?'':'s')+'</span>'+
    '</span></summary>'+
    '<div class="dist-cidades">'+
      g.municipios.map(([mun,c])=>'<span class="dist-cidade clickable" data-municipio="'+mun+'">'+mun+' <b>×'+c+'</b></span>').join('')+
    '</div></details>'
  ).join('') + '</div>';
}
const EDITAL_LABELS = { '44':'Edital 44 — Para Pesquisador', '45':'Edital 45 — Para Extensionista' };
function distTableByEdital(vagas){
  const byEdital = { '44':[], '45':[] };
  vagas.forEach(v=>{
    const ed = editalFromPerfil(v.id_perfil);
    if (byEdital[ed]) byEdital[ed].push(v);
  });
  const blocks = ['44','45'].filter(ed=>byEdital[ed].length).map(ed=>
    '<div class="dist-block"><h3 class="dist-edital-title">'+EDITAL_LABELS[ed]+'</h3>'+distTable(byEdital[ed])+'</div>'
  ).join('');
  return blocks || '<p style="text-align:center; color:var(--text-muted)">Nenhuma vaga para os filtros selecionados.</p>';
}
function editalFromPerfil(id_perfil){
  const m = /^PER-E(\d+)-/.exec(id_perfil || '');
  return m ? m[1] : '—';
}
let state = { municipio:null, formacao:null, edital:null };

function normalizeText(s){
  return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
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
  el.style.width = (s.offsetWidth + 24) + 'px';
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

  function currentOptions(){
    const q = normalizeText(input.value);
    const all = validList();
    return q ? all.filter(v=>normalizeText(v).includes(q)) : all;
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
    const rows = items.length
      ? items.map(v=>'<div class="fl-dropdown-option">'+v+'</div>').join('')
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
    select(opt.textContent);
  });

  fitInputWidth(input);
  input.addEventListener('focus', open);
  input.addEventListener('click', open);
  input.addEventListener('input', ()=>{ fitInputWidth(input); open(); });
  input.addEventListener('keydown', (e)=>{
    if (panel.hidden && (e.key === 'ArrowDown' || e.key === 'ArrowUp')){ open(); return; }
    if (e.key === 'ArrowDown'){ e.preventDefault(); activeIndex = Math.min(activeIndex + 1, items.length - 1); highlight(); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); activeIndex = Math.max(activeIndex - 1, -1); highlight(); }
    else if (e.key === 'Enter'){
      e.preventDefault();
      if (activeIndex >= 0 && items[activeIndex] !== undefined) select(items[activeIndex]);
      else {
        const val = input.value.trim();
        if (val === ''){ select(null); return; }
        const match = validList().find(x => normalizeText(x) === normalizeText(val));
        if (match) select(match); else input.classList.add('invalid');
      }
    } else if (e.key === 'Escape'){ close(); input.blur(); }
  });
  input.addEventListener('blur', ()=>{
    setTimeout(()=>{
      if (mouseDownOnPanel) return;
      close();
      const val = input.value.trim();
      if (val === ''){ setFieldValue([inputId], ''); onSet(null); render(); return; }
      const match = validList().find(x => normalizeText(x) === normalizeText(val));
      if (match){ setFieldValue([inputId], match); onSet(match); render(); }
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
document.addEventListener('click', (e)=>{
  const m = e.target.closest('[data-municipio]');
  if (m){ selectMunicipio(m.dataset.municipio); return; }
  const s = e.target.closest('[data-sort]');
  if (s){ toggleDistSort(s.dataset.sort); return; }
});

// ---- despachante ----
function render(){
  const { municipio, formacao, edital } = state;
  const filtered = filterVagas(municipio, formacao, edital);
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
  const ed = params.get('edital');
  if (f && allFormacoes().includes(f)) state.formacao = f;
  if (m && DATA.municipios.includes(m)) state.municipio = m;
  if (ed && ['44','45'].includes(ed)) state.edital = ed;
  if (state.formacao) setFieldValue(['formInputFlyer'], state.formacao);
  if (state.municipio) setFieldValue(['muniInputFlyer'], state.municipio);
  if (state.edital) setFieldValue(['editalInputFlyer'], 'Edital ' + state.edital);
}
function updateURL(){
  const params = new URLSearchParams();
  if (state.formacao) params.set('formacao', state.formacao);
  if (state.municipio) params.set('municipio', state.municipio);
  if (state.edital) params.set('edital', state.edital);
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
setupFieldDropdown('formField', 'formInputFlyer', allFormacoes, v => state.formacao = v, 'Todas as formações');
setupFieldDropdown('muniField', 'muniInputFlyer', () => DATA.municipios.slice().sort((a,b)=>a.localeCompare(b,'pt-BR')), v => state.municipio = v, 'Todos os municípios');
setupFieldDropdown('editalField', 'editalInputFlyer', () => ['Edital 44','Edital 45'], v => state.edital = v ? v.replace('Edital ', '') : null, 'Todos os editais');
render();
