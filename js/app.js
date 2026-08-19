/* =====================================================
   MANUTENÇÃO ESCOLAR — APLICAÇÃO PRINCIPAL (V5 - Filtro por Período de Datas & UI Estilizada)
   ===================================================== */
'use strict';

// ─── Supabase Client ─────────────────────────────────
const { createClient } = supabase;
const realSb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let sb = realSb;
let demoMode = false;

const DEMO_KEY = 'manutencao_escolar_demo_v1';
function demoSeed() {
  return {
    escolas: [
      {id:'d-escola-1',nome:'Escola Modelo Jardim',email:'demo@exemplo.local',created_at:'2026-08-01T10:00:00Z'},
      {id:'d-escola-2',nome:'Centro Educacional Aurora',email:'demo@exemplo.local',created_at:'2026-08-02T10:00:00Z'},
      {id:'d-escola-3',nome:'EM Prof. João Silva',email:'demo@exemplo.local',created_at:'2026-08-03T10:00:00Z'}
    ],
    materiais: [
      {id:'d-mat-1',nome:'Lâmpada LED 12W',unidade:'un',custo_ref:18,created_at:'2026-08-01T10:00:00Z'},
      {id:'d-mat-2',nome:'Torneira de pia',unidade:'un',custo_ref:45,created_at:'2026-08-01T10:00:00Z'},
      {id:'d-mat-3',nome:'Cano PVC 50mm',unidade:'m',custo_ref:8,created_at:'2026-08-01T10:00:00Z'}
    ],
    ordens_servico: [
      {id:'d-os-1',numero:1001,escola_id:'d-escola-1',solicitante:'Ana Souza',descricao_problema:'Lâmpadas queimadas no corredor.',descricao_servico:'Substituição das lâmpadas.',tecnico:'Equipe de manutenção',status:'Aberta',origem:'Manual',data_abertura:'2026-08-12',data_conclusao:null,created_at:'2026-08-12T09:00:00Z'},
      {id:'d-os-2',numero:1002,escola_id:'d-escola-2',solicitante:'Carlos Lima',descricao_problema:'Vazamento na pia.',descricao_servico:'Troca do sifão e vedação.',tecnico:'Equipe de manutenção',status:'Em Andamento',origem:'Formulario',data_abertura:'2026-08-10',data_conclusao:null,created_at:'2026-08-10T09:00:00Z'},
      {id:'d-os-3',numero:1003,escola_id:'d-escola-3',solicitante:'Marina Alves',descricao_problema:'Torneira com defeito.',descricao_servico:'Torneira substituída.',tecnico:'Equipe de manutenção',status:'Concluída',origem:'Manual',data_abertura:'2026-08-05',data_conclusao:'2026-08-06',created_at:'2026-08-05T09:00:00Z'}
    ],
    os_materiais: [
      {id:'d-oi-1',os_id:'d-os-3',material_id:'d-mat-2',descricao:'Torneira de pia',quantidade:1,custo_unitario:45,created_at:'2026-08-06T09:00:00Z'}
    ],
    notas_compra: [
      {id:'d-nota-1',numero:501,data_compra:'2026-08-08',fornecedor:'Fornecedor Demonstrativo',responsavel_compra:'Usuário Demo',responsavel_autorizacao:'Gestão Demo',valor_total:126,status:'Autorizada',observacoes:'Registro fictício para apresentação.',created_at:'2026-08-08T09:00:00Z'}
    ],
    itens_compra: [
      {id:'d-item-1',nota_compra_id:'d-nota-1',material_id:'d-mat-1',descricao:'Lâmpada LED 12W',quantidade:3,custo_unitario:18,data_retirada:'2026-08-09',escola_id:'d-escola-1',os_id:'d-os-1',created_at:'2026-08-09T09:00:00Z'},
      {id:'d-item-2',nota_compra_id:'d-nota-1',material_id:'d-mat-2',descricao:'Torneira de pia',quantidade:1,custo_unitario:45,data_retirada:'2026-08-09',escola_id:'d-escola-2',os_id:'d-os-2',created_at:'2026-08-09T09:00:00Z'},
      {id:'d-item-3',nota_compra_id:'d-nota-1',material_id:'d-mat-3',descricao:'Cano PVC 50mm',quantidade:3,custo_unitario:8,data_retirada:'2026-08-09',escola_id:'d-escola-2',os_id:'d-os-2',created_at:'2026-08-09T09:00:00Z'}
    ]
  };
}

function getDemoDB() {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  const db = demoSeed();
  localStorage.setItem(DEMO_KEY, JSON.stringify(db));
  return db;
}
function saveDemoDB(db) { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); }

function makeDemoClient() {
  const db = getDemoDB();
  const api = {
    from(table) {
      const state = { table, action:'select', columns:'*', filters:[], orderBy:null, single:false, payload:null };
      const builder = {
        select(columns='*') { state.columns=columns; return builder; },
        order(column, opts={}) { state.orderBy={column, ascending: opts.ascending !== false}; return builder; },
        eq(column,value) { state.filters.push([column,value]); return builder; },
        single() { state.single=true; return builder; },
        insert(payload) { state.action='insert'; state.payload=payload; return builder; },
        update(payload) { state.action='update'; state.payload=payload; return builder; },
        delete() { state.action='delete'; return builder; },
        then(resolve,reject) {
          try { resolve(executeDemoQuery(state)); } catch(e) { if(reject) reject(e); else throw e; }
        }
      };
      return builder;
    }
  };

  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function match(row, filters) { return filters.every(([k,v]) => String(row[k]) === String(v)); }

  function enrich(row, columns) {
    const out=clone(row);
    if (columns && columns.includes('escola:escola_id(nome)')) {
      const e=db.escolas.find(x=>x.id===row.escola_id);
      out.escola=e ? {nome:e.nome} : null;
    }
    return out;
  }

  function executeDemoQuery(s) {
    let rows=db[s.table] || [];
    if (s.action==='select') {
      let data=rows.filter(r=>match(r,s.filters)).map(r=>enrich(r,s.columns));
      if (s.orderBy) {
        const {column,ascending}=s.orderBy;
        data.sort((a,b)=>String(a[column]??'').localeCompare(String(b[column]??''),undefined,{numeric:true})*(ascending?1:-1));
      }
      if (s.single) return {data:data[0]||null,error:data[0]?null:{message:'Registro não encontrado'}};
      return {data,error:null};
    }
    if (s.action==='insert') {
      const payloads=Array.isArray(s.payload)?s.payload:[s.payload];
      const inserted=payloads.map((p,i)=>{
        const row={...p,id:p.id||('d-'+s.table+'-'+Date.now()+'-'+i),created_at:p.created_at||new Date().toISOString()};
        if (s.table==='ordens_servico') row.numero=p.numero||Math.max(0,...rows.map(x=>Number(x.numero)||0))+1;
        if (s.table==='notas_compra') row.numero=p.numero||Math.max(0,...rows.map(x=>Number(x.numero)||0))+1;
        rows.push(row); return clone(row);
      });
      saveDemoDB(db);
      const data=inserted.map(r=>enrich(r,s.columns));
      if (s.single) return {data:data[0],error:null};
      return {data,error:null};
    }
    const targets=rows.filter(r=>match(r,s.filters));
    if (s.action==='update') { targets.forEach(r=>Object.assign(r,s.payload)); saveDemoDB(db); return {data:null,error:null}; }
    if (s.action==='delete') { db[s.table]=rows.filter(r=>!match(r,s.filters)); saveDemoDB(db); return {data:null,error:null}; }
    return {data:null,error:null};
  }
  return api;
}

function showLogin() {
  document.body.classList.remove('app-ready');
  document.getElementById('auth-screen').hidden=false;
  document.querySelectorAll('#sidebar,#main-wrapper').forEach(el=>el.style.display='none');
}
function hideLogin() {
  document.body.classList.add('app-ready');
  document.getElementById('auth-screen').hidden=true;
  document.querySelector('#sidebar').style.display='';
  document.querySelector('#main-wrapper').style.display='';
}
function loginError(message) {
  const el=document.getElementById('login-error');
  el.textContent=message; el.hidden=false;
}
async function startRealSession() {
  demoMode=false; sb=realSb; hideLogin();
  document.body.classList.remove('demo-mode');
  try { await loadGlobal(); } catch(e) { console.error(e); toast('Erro de conexão com o banco de dados.','error'); }
  router();
}
async function startDemoSession() {
  demoMode=true; sb=makeDemoClient();
  localStorage.setItem('manutencao_demo_session','1');
  hideLogin();
  document.body.classList.add('demo-mode');
  await loadGlobal(true);
  router();
}
async function logout() {
  if (demoMode) {
    localStorage.removeItem('manutencao_demo_session');
    demoMode=false; sb=realSb; G._loaded=false; G._loadingPromise=null;
    showLogin(); return;
  }
  await realSb.auth.signOut();
  G._loaded=false; G._loadingPromise=null;
  showLogin();
}


// ─── Estado Global ────────────────────────────────────
const G = {
  escolas: [],
  materiais: [],
  osItens: [],       // itens temporários no form de OS
  notaItens: [],     // itens temporários no form de Nota de Compra
};

// ─── Utilitários ──────────────────────────────────────
const fmt = {
  currency: v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  date: d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—',
  today: () => new Date().toISOString().split('T')[0],
  monthName: m => ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][m - 1],
};

function badgeStatus(status) {
  const map = {
    'Aberta':      'badge-aberta',
    'Em Andamento':'badge-andamento',
    'Concluída':   'badge-concluida',
    'Pendente':    'badge-andamento',
    'Autorizada':  'badge-ativa',
    'Concluída/Paga': 'badge-concluida',
    'Ativa':       'badge-ativa',
    'Encerrada':   'badge-encerrada',
  };
  return `<span class="badge ${map[status] || ''}">${status}</span>`;
}

function loader() {
  return `<div class="loader"><div class="spinner"></div></div>`;
}

function emptyState(title, desc) {
  return `<div class="empty-state">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z"/>
    </svg>
    <h3>${title}</h3><p>${desc}</p></div>`;
}

function formatarMateriaisTexto(itens) {
  if (!itens || !itens.length) return '<span class="text-muted">Sem material registrado</span>';
  return itens.map(i => `${Number(i.quantidade).toLocaleString('pt-BR')}x ${i.descricao}`).join(', ');
}

// Escapa texto para uso seguro dentro de atributos HTML (evita que aspas ou
// tags dentro de nomes/descrições "quebrem" a tag e vazem como texto na tela)
function escAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── Toast ────────────────────────────────────────────
function toast(msg, type = 'success') {
  const icons = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>`,
    error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>`,
  };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `${icons[type] || ''}${msg}`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ─── Confirm Dialog ───────────────────────────────────
function confirmDialog(msg) {
  return new Promise(resolve => {
    const bd = document.createElement('div');
    bd.className = 'modal-backdrop';
    bd.innerHTML = `
      <div class="modal" style="max-width:380px">
        <div class="modal-header"><h3>Confirmar</h3></div>
        <div class="modal-body"><p style="font-size:14px;color:var(--slate-600)">${msg}</p></div>
        <div class="modal-footer">
          <button class="btn btn-outline" id="conf-no">Cancelar</button>
          <button class="btn btn-danger" id="conf-yes">Confirmar</button>
        </div>
      </div>`;
    document.body.appendChild(bd);
    bd.querySelector('#conf-yes').onclick = () => { bd.remove(); resolve(true); };
    bd.querySelector('#conf-no').onclick  = () => { bd.remove(); resolve(false); };
    bd.onclick = e => { if (e.target === bd) { bd.remove(); resolve(false); } };
  });
}

// ─── Navigation ───────────────────────────────────────
function navigate(page, id) {
  location.hash = id ? `/${page}/${id}` : `/${page}`;
  document.getElementById('sidebar')?.classList.remove('open');
}

function setPageTitle(title, breadcrumb = '') {
  document.getElementById('page-title').innerHTML =
    `${title}${breadcrumb ? `<span class="breadcrumb">/ ${breadcrumb}</span>` : ''}`;
}

function setHeaderAction(html) {
  document.getElementById('header-actions').innerHTML = html;
}

function setContent(html) {
  const el = document.getElementById('content');
  el.innerHTML = html;
  el.classList.remove('page-enter');
  void el.offsetWidth;
  el.style.animation = 'slideUp .2s ease';
}

// ─── Carregamento Global ──────────────────────────────
// Escolas e materiais mudam raramente, então mantemos em cache em vez de
// buscar de novo a cada troca de tela. Use loadGlobal(true) para forçar
// atualização (ex: depois de criar/editar/excluir uma escola ou material).
G._loaded = false;
G._loadingPromise = null;

async function loadGlobal(force = false) {
  if (G._loaded && !force) return;
  if (G._loadingPromise && !force) return G._loadingPromise;

  G._loadingPromise = (async () => {
    const [e, m] = await Promise.all([
      sb.from('escolas').select('*').order('nome'),
      sb.from('materiais').select('*').order('nome'),
    ]);
    G.escolas   = e.data || [];
    G.materiais = m.data || [];
    G._loaded = true;
  })();

  try {
    await G._loadingPromise;
  } finally {
    G._loadingPromise = null;
  }
}

function escolaOptions(selected = '') {
  return G.escolas.map(e =>
    `<option value="${e.id}" ${e.id === selected ? 'selected' : ''}>${e.nome}</option>`
  ).join('');
}

function escolaFilterOptions() {
  return `<option value="">Todas as Escolas / Setores</option>` +
    G.escolas.map(e => `<option value="${e.id}">${e.nome}</option>`).join('');
}

// ─── Router ───────────────────────────────────────────
function router() {
  const hash  = location.hash.replace('#/', '') || 'dashboard';
  const parts = hash.split('/');
  const page  = parts[0];
  const id    = parts[1];

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  switch (page) {
    case 'dashboard':    renderDashboard();          break;
    case 'os':
      if (id === 'new')  renderOsForm();
      else if (id)       renderOsDetail(id);
      else               renderOsList();
      break;
    case 'compras':
      if (id === 'new')  renderComprasForm();
      else if (id)       renderComprasDetail(id);
      else               renderComprasList();
      break;
    case 'materiais':    renderMateriais();          break;
    case 'relatorios':   renderRelatorios();         break;
    case 'configuracoes': renderConfiguracoes();     break;
    default:             renderDashboard();
  }
}

/* =====================================================
   DASHBOARD
   ===================================================== */
async function renderDashboard() {
  setPageTitle('Dashboard');
  setHeaderAction('');
  setContent(loader());

  const [{ data: os }, { data: notas }, { data: itens }] = await Promise.all([
    sb.from('ordens_servico').select('status, origem'),
    sb.from('notas_compra').select('status, data_compra'),
    sb.from('itens_compra').select('quantidade, data_retirada'),
  ]);

  const osAbertas    = (os || []).filter(o => o.status === 'Aberta').length;
  const osAndamento  = (os || []).filter(o => o.status === 'Em Andamento').length;
  const osConcluidas = (os || []).filter(o => o.status === 'Concluída').length;
  const osFormulario = (os || []).filter(o => o.origem === 'Formulario').length;

  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();

  const totalNotasMes = (notas || [])
    .filter(n => {
      const d = new Date(n.data_compra + 'T12:00:00');
      return d.getMonth() + 1 === mesAtual && d.getFullYear() === anoAtual;
    }).length;

  const totalItensRetirados = (itens || [])
    .filter(i => {
      const d = new Date(i.data_retirada + 'T12:00:00');
      return d.getMonth() + 1 === mesAtual && d.getFullYear() === anoAtual;
    })
    .reduce((s, i) => s + Number(i.quantidade || 0), 0);

  setContent(`
    <div class="stats-grid">
      <div class="stat-card stat-yellow" style="cursor:pointer" onclick="navigate('os')">
        <div class="stat-icon">${svgClipboard()}</div>
        <div class="stat-info">
          <div class="stat-value">${osAbertas + osAndamento}</div>
          <div class="stat-label">OS em Aberto</div>
        </div>
      </div>
      <div class="stat-card stat-green" style="cursor:pointer" onclick="navigate('os')">
        <div class="stat-icon">${svgCheck()}</div>
        <div class="stat-info">
          <div class="stat-value">${osConcluidas}</div>
          <div class="stat-label">OS Concluídas</div>
        </div>
      </div>
      <div class="stat-card stat-blue" style="cursor:pointer" onclick="navigate('compras')">
        <div class="stat-icon">${svgCart()}</div>
        <div class="stat-info">
          <div class="stat-value">${totalNotasMes}</div>
          <div class="stat-label">Notas em ${fmt.monthName(mesAtual)}</div>
        </div>
      </div>
      <div class="stat-card stat-red">
        <div class="stat-icon">${svgCart()}</div>
        <div class="stat-info">
          <div class="stat-value" style="font-size:22px">${totalItensRetirados} itens</div>
          <div class="stat-label">Materiais Pegos no Mês</div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card">
        <div class="card-header">
          <h3>Ordens de Serviço por Status</h3>
          <button class="btn btn-outline btn-sm" onclick="navigate('os')">Ver todas</button>
        </div>
        <div class="card-body">
          ${[['Aberta', osAbertas, 'badge-aberta'],['Em Andamento', osAndamento, 'badge-andamento'],['Concluída', osConcluidas, 'badge-concluida']]
            .map(([s, n, cls]) => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--slate-100)">
              <span class="badge ${cls}">${s}</span>
              <strong style="font-size:18px">${n}</strong>
            </div>`).join('')}
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;">
              <span style="font-size:12.5px;color:var(--slate-600)">Recebidas do Formulário Google</span>
              <span class="badge badge-ativa">${osFormulario} OS</span>
            </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Controle de Notas e Materiais Gastos</h3>
          <button class="btn btn-outline btn-sm" onclick="navigate('compras')">Lançar Nota</button>
        </div>
        <div class="card-body">
          <p style="font-size:13.5px;color:var(--slate-600);line-height:1.6;margin-bottom:20px">
            Digitalize as notinhas dos materiais retirados e controle o destino de cada item para gerar relatórios completos de consumo por escola/setor.
          </p>
          <div style="display:flex;gap:10px">
            <button class="btn btn-primary w-full" onclick="navigate('compras','new')">
              ${svgPlus()} Lançar Nota de Compra
            </button>
            <button class="btn btn-outline w-full" onclick="navigate('relatorios')">
              ${svgChart()} Ver Relatórios
            </button>
          </div>
        </div>
      </div>
    </div>
  `);
}

/* =====================================================
   ORDENS DE SERVIÇO
   ===================================================== */
async function renderOsList() {
  setPageTitle('Ordens de Serviço');
  setHeaderAction(`
    <button class="btn btn-outline" onclick="showFormScriptModal()">${svgCode()} Integração Google Forms</button>
    <button class="btn btn-primary" onclick="navigate('os','new')">${svgPlus()} Nova OS Manual</button>
  `);
  setContent(loader());

  const [, { data: lista }] = await Promise.all([
    loadGlobal(),
    sb.from('ordens_servico')
      .select('*, escola:escola_id(id, nome), os_materiais(*)')
      .order('numero', { ascending: false }),
  ]);

  if (!lista || !lista.length) {
    setContent(`<div class="page-header"><div><h2>Ordens de Serviço</h2></div></div>` +
      emptyState('Nenhuma OS registrada', 'As solicitações feitas no Formulário Escolar aparecerão aqui automaticamente, ou clique em "Nova OS Manual".'));
    return;
  }

  setContent(`
    <div class="page-header">
      <div><h2>Ordens de Serviço</h2><p>${lista.length} ordens registradas no sistema</p></div>
    </div>
    
    <div class="filters-bar">
      <div class="filter-group" style="flex:2;min-width:200px">
        <label>Pesquisar</label>
        <input type="text" id="os-search" placeholder="Busque por problema, solicitante, nº ou material..." oninput="filterOsTable()">
      </div>
      <div class="filter-group" style="flex:1.5;min-width:160px">
        <label>Escola / Setor</label>
        <select id="os-filter-escola" onchange="filterOsTable()">
          ${escolaFilterOptions()}
        </select>
      </div>
      <div class="filter-group" style="flex:1;min-width:130px">
        <label>Status</label>
        <select id="os-filter-status" onchange="filterOsTable()">
          <option value="">Todos os status</option>
          <option>Aberta</option><option>Em Andamento</option><option>Concluída</option>
        </select>
      </div>
      <div class="filter-group" style="flex:1;min-width:130px">
        <label>Origem</label>
        <select id="os-filter-origem" onchange="filterOsTable()">
          <option value="">Todas origens</option>
          <option value="Formulario">Google Forms</option>
          <option value="Manual">Manual</option>
        </select>
      </div>
      <div class="filter-group">
        <label>De (Data Inicial)</label>
        <input type="date" id="os-filter-dt-ini" onchange="filterOsTable()">
      </div>
      <div class="filter-group">
        <label>Até (Data Final)</label>
        <input type="date" id="os-filter-dt-fim" onchange="filterOsTable()">
      </div>
    </div>

    <div class="table-wrapper">
      <table id="os-table">
        <thead><tr>
          <th>OS Nº</th><th>Origem</th><th>Data</th><th>Escola / Setor</th><th>Solicitante</th><th>Descrição do Problema</th><th>Materiais Gastos</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>
          ${lista.map(os => {
            const matTexto = formatarMateriaisTexto(os.os_materiais);
            const matTextoPlano = (os.os_materiais || []).map(i => i.descricao).join(' '); // sem HTML, só para busca
            const desc = escAttr((os.descricao_problema + ' ' + os.solicitante + ' ' + os.numero + ' ' + matTextoPlano).toLowerCase());
            return `
            <tr data-escola-id="${os.escola_id || ''}" data-escola-nome="${escAttr((os.escola?.nome || '').toLowerCase())}" data-desc="${desc}" data-status="${escAttr(os.status)}" data-origem="${escAttr(os.origem || 'Manual')}" data-data="${os.data_abertura}">              <td><strong class="text-blue">#${os.numero}</strong></td>
              <td>${os.origem === 'Formulario' ? '<span class="badge badge-ativa">Formulário</span>' : '<span class="badge badge-aberta">Manual</span>'}</td>
              <td>${fmt.date(os.data_abertura)}</td>
              <td><strong>${os.escola?.nome || '<span class="text-muted">—</span>'}</strong></td>
              <td>${os.solicitante || '<span class="text-muted">—</span>'}</td>
              <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${os.descricao_problema}</td>
              <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${matTexto}</td>
              <td>${badgeStatus(os.status)}</td>
              <td><div class="td-actions">
                <button class="btn btn-ghost btn-sm btn-icon" title="Ver detalhes / Lançar Materiais" onclick="navigate('os','${os.id}')">${svgEye()}</button>
                <button class="btn btn-ghost btn-sm btn-icon text-red" title="Excluir" onclick="deleteOs('${os.id}','${os.numero}')">${svgTrash()}</button>
              </div></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `);
}

function filterOsTable() {
  const search = document.getElementById('os-search').value.toLowerCase();
  const escolaId = document.getElementById('os-filter-escola').value;
  const status = document.getElementById('os-filter-status').value;
  const origem = document.getElementById('os-filter-origem').value;
  const dtIni = document.getElementById('os-filter-dt-ini').value;
  const dtFim = document.getElementById('os-filter-dt-fim').value;

  document.querySelectorAll('#os-table tbody tr').forEach(tr => {
    const matchSearch = !search || tr.dataset.desc.includes(search) || tr.dataset.escolaNome.includes(search);
    const matchEscola = !escolaId || tr.dataset.escolaId === escolaId;
    const matchStatus = !status || tr.dataset.status === status;
    const matchOrigem = !origem || tr.dataset.origem === origem;
    const trData = tr.dataset.data;
    const matchDtIni = !dtIni || trData >= dtIni;
    const matchDtFim = !dtFim || trData <= dtFim;

    tr.style.display = matchSearch && matchEscola && matchStatus && matchOrigem && matchDtIni && matchDtFim ? '' : 'none';
  });
}

function showFormScriptModal() {
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.id = 'script-modal';
  bd.innerHTML = `
    <div class="modal" style="max-width:640px">
      <div class="modal-header">
        <h3>Como conectar seu Formulário Google ao Sistema</h3>
        <button class="btn btn-ghost btn-icon" onclick="document.getElementById('script-modal').remove()">${svgX()}</button>
      </div>
      <div class="modal-body">
        <ol style="margin-left:20px;line-height:1.6;font-size:13px;color:var(--slate-700)">
          <li>Abra a planilha de respostas do seu Formulário Google.</li>
          <li>No menu, vá em <strong>Extensões > Apps Script</strong>.</li>
          <li>Apague qualquer código e cole o conteúdo do arquivo <code>google-forms-script.js</code> que preparamos para você.</li>
          <li>Salve o projeto e clique no menu <strong>Acionadores (relógio no menu esquerdo)</strong>.</li>
          <li>Adicione um acionador para a função <code>enviarParaSupabase</code> no evento <strong>Ao enviar formulário</strong>.</li>
        </ol>
        <p style="margin-top:12px;font-size:12px;color:var(--slate-500)">
          Pronto! Toda vez que uma escola responder ao formulário, a OS aparecerá automaticamente no sistema em tempo real.
        </p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="document.getElementById('script-modal').remove()">Entendi</button>
      </div>
    </div>`;
  document.body.appendChild(bd);
  bd.onclick = e => { if (e.target === bd) bd.remove(); };
}

async function renderOsForm(id) {
  const isEdit = !!id;
  let os = null;
  let osItens = [];

  setPageTitle('Ordens de Serviço', isEdit ? 'Editar OS' : 'Nova OS');
  setHeaderAction(`<button class="btn btn-outline" onclick="navigate('os')">${svgArrowLeft()} Voltar</button>`);
  setContent(loader());

  if (isEdit) {
    const [, { data: d }, { data: itens }] = await Promise.all([
      loadGlobal(),
      sb.from('ordens_servico').select('*, escola:escola_id(nome)').eq('id', id).single(),
      sb.from('os_materiais').select('*').eq('os_id', id),
    ]);
    os = d;
    osItens = itens || [];
  } else {
    await loadGlobal();
  }

  G.osItens = osItens.map(i => ({ ...i, _key: Math.random() }));

  setContent(`
    <div class="page-header">
      <div><h2>${isEdit ? `Editar OS #${os?.numero}` : 'Nova Ordem de Serviço'}</h2></div>
    </div>
    <form id="os-form" onsubmit="saveOs(event, ${isEdit ? `'${id}'` : 'null'})">
      <div class="card">
        <div class="card-header"><h3>Dados da OS</h3></div>
        <div class="card-body">
          <div class="form-grid">
            <div class="form-group">
              <label>Escola / Setor Solicitante *</label>
              <select name="escola_id" required>
                <option value="">Selecionar escola ou setor...</option>
                ${escolaOptions(os?.escola_id)}
              </select>
            </div>
            <div class="form-group">
              <label>Solicitante / Responsável</label>
              <input type="text" name="solicitante" value="${os?.solicitante || ''}" placeholder="Nome do responsável">
            </div>
            <div class="form-group">
              <label>Técnico Responsável</label>
              <input type="text" name="tecnico" value="${os?.tecnico || ''}" placeholder="Nome do técnico">
            </div>
            <div class="form-group">
              <label>Status</label>
              <select name="status">
                ${['Aberta','Em Andamento','Concluída'].map(s =>
                  `<option ${(os?.status || 'Aberta') === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Data de Abertura</label>
              <input type="date" name="data_abertura" value="${os?.data_abertura || fmt.today()}" required>
            </div>
            <div class="form-group">
              <label>Data de Conclusão</label>
              <input type="date" name="data_conclusao" value="${os?.data_conclusao || ''}">
            </div>
            <div class="form-group span-full">
              <label>Descrição do Problema *</label>
              <textarea name="descricao_problema" rows="3" required placeholder="Descreva o problema relatado...">${os?.descricao_problema || ''}</textarea>
            </div>
            <div class="form-group span-full">
              <label>Descrição do Serviço Realizado</label>
              <textarea name="descricao_servico" rows="3" placeholder="Descreva o que foi feito...">${os?.descricao_servico || ''}</textarea>
            </div>
          </div>
        </div>
      </div>

      <div class="card mt-16">
        <div class="card-header">
          <h3>Materiais Utilizados nesta Manutenção</h3>
          <button type="button" class="btn btn-outline btn-sm" onclick="addOsItem()">${svgPlus()} Adicionar Material</button>
        </div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:2fr 100px 40px;gap:8px;margin-bottom:8px">
            <span style="font-size:11px;font-weight:600;color:var(--slate-500);text-transform:uppercase">Descrição do Material Utilizado</span>
            <span style="font-size:11px;font-weight:600;color:var(--slate-500);text-transform:uppercase">Quantidade</span>
            <span></span>
          </div>
          <div id="os-itens-container" class="material-rows"></div>
        </div>
      </div>

      <div class="flex justify-between mt-16 no-print" style="gap:8px">
        <button type="button" class="btn btn-outline" onclick="navigate('os')">Cancelar</button>
        <button type="submit" class="btn btn-primary" id="os-save-btn">${svgCheck()} Salvar Ordem de Serviço</button>
      </div>
    </form>
  `);

  renderOsItens();
}

function renderOsItens() {
  const container = document.getElementById('os-itens-container');
  if (!container) return;

  if (!G.osItens.length) {
    container.innerHTML = `<p class="text-muted text-sm" style="padding:8px 0">Nenhum material adicionado ainda.</p>`;
    return;
  }

  container.innerHTML = G.osItens.map((item, i) => `
    <div style="display:grid;grid-template-columns:2fr 100px 40px;gap:8px;align-items:center;margin-bottom:8px">
      <input type="text" placeholder="Ex: Torneira de pia, lampada..." value="${item.descricao || ''}"
        oninput="G.osItens[${i}].descricao=this.value">
      <input type="number" min="0.01" step="0.01" placeholder="1" value="${item.quantidade || 1}"
        oninput="G.osItens[${i}].quantidade=parseFloat(this.value)||0">
      <button type="button" class="btn btn-ghost btn-icon text-red" onclick="removeOsItem(${i})">${svgTrash()}</button>
    </div>
  `).join('');
}

function addOsItem() {
  G.osItens.push({ descricao: '', quantidade: 1, custo_unitario: 0 });
  renderOsItens();
}

function removeOsItem(i) {
  G.osItens.splice(i, 1);
  renderOsItens();
}

function updateOsTotal() {}

async function saveOs(e, id) {
  e.preventDefault();
  const form = e.target;
  const btn = document.getElementById('os-save-btn');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  const payload = {
    escola_id:          form.escola_id.value || null,
    solicitante:        form.solicitante.value,
    tecnico:            form.tecnico.value,
    status:             form.status.value,
    data_abertura:      form.data_abertura.value,
    data_conclusao:     form.data_conclusao.value || null,
    descricao_problema: form.descricao_problema.value,
    descricao_servico:  form.descricao_servico.value,
  };

  let osId = id;
  if (id) {
    const { error } = await sb.from('ordens_servico').update(payload).eq('id', id);
    if (error) { toast('Erro ao salvar: ' + error.message, 'error'); btn.disabled = false; btn.textContent = 'Salvar'; return; }
  } else {
    payload.origem = 'Manual';
    const { data, error } = await sb.from('ordens_servico').insert(payload).select().single();
    if (error) { toast('Erro ao criar OS: ' + error.message, 'error'); btn.disabled = false; btn.textContent = 'Salvar'; return; }
    osId = data.id;
  }

  if (id) await sb.from('os_materiais').delete().eq('os_id', osId);
  const itens = G.osItens.filter(i => i.descricao?.trim());
  if (itens.length) {
    await sb.from('os_materiais').insert(itens.map(i => ({
      os_id: osId,
      descricao: i.descricao,
      quantidade: parseFloat(i.quantidade) || 1,
      custo_unitario: 0,
    })));
  }

  toast(id ? 'OS atualizada com sucesso!' : 'OS criada com sucesso!');
  navigate('os', osId);
}

async function renderOsDetail(id) {
  setPageTitle('Ordens de Serviço', 'Detalhes da OS');
  setHeaderAction('');
  setContent(loader());

  const [{ data: os }, { data: itens }] = await Promise.all([
    sb.from('ordens_servico').select('*, escola:escola_id(nome)').eq('id', id).single(),
    sb.from('os_materiais').select('*').eq('os_id', id).order('created_at'),
  ]);

  if (!os) { toast('OS não encontrada', 'error'); navigate('os'); return; }

  setHeaderAction(`
    <button class="btn btn-outline" onclick="navigate('os')">${svgArrowLeft()} Voltar</button>
    <button class="btn btn-outline" onclick="navigate('os','${id}');setTimeout(()=>renderOsForm('${id}'),0)">
      ${svgEdit()} Editar OS
    </button>
    <button class="btn btn-primary" onclick="printOs()">${svgPrint()} Imprimir OS</button>
  `);

  setContent(`
    <div id="print-area">
      <div class="page-header">
        <div>
          <h2>OS #${os.numero} <span style="font-size:14px;font-weight:400;margin-left:8px">${badgeStatus(os.status)}</span></h2>
          <p>Recebida via ${os.origem === 'Formulario' ? 'Formulário Google' : 'Lançamento Manual'} em ${fmt.date(os.data_abertura)}</p>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>Informações Gerais</h3></div>
        <div class="card-body">
          <div class="detail-grid">
            <div class="detail-field"><label>Escola / Setor Solicitante</label><p>${os.escola?.nome || '—'}</p></div>
            <div class="detail-field"><label>Solicitante</label><p>${os.solicitante || '—'}</p></div>
            <div class="detail-field"><label>Técnico Responsável</label><p>${os.tecnico || '—'}</p></div>
            <div class="detail-field"><label>Data de Abertura</label><p>${fmt.date(os.data_abertura)}</p></div>
            <div class="detail-field"><label>Data Conclusão</label><p>${fmt.date(os.data_conclusao)}</p></div>
            <div class="detail-field"><label>Status</label><p>${badgeStatus(os.status)}</p></div>
          </div>
          <hr class="divider">
          <div class="detail-field" style="margin-bottom:12px">
            <label>Descrição do Problema Relatado</label>
            <p style="margin-top:6px;line-height:1.6;color:var(--slate-700)">${os.descricao_problema}</p>
          </div>
          <div class="detail-field">
            <label>Serviço Realizado</label>
            <p style="margin-top:6px;line-height:1.6;color:var(--slate-700)">${os.descricao_servico || '<span class="text-muted">Serviço ainda não registrado</span>'}</p>
          </div>
        </div>
      </div>

      <div class="card mt-16">
        <div class="card-header">
          <h3>Materiais Utilizados nesta OS</h3>
        </div>
        ${itens && itens.length ? `
        <div class="table-wrapper" style="border:none;border-radius:0;box-shadow:none">
          <table>
            <thead><tr><th>Material / Descrição</th><th>Quantidade Gastos</th></tr></thead>
            <tbody>
              ${itens.map(i => `
                <tr>
                  <td><strong>${i.descricao}</strong></td>
                  <td>${Number(i.quantidade).toLocaleString('pt-BR')} item(ns)</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : `<div class="card-body">${emptyState('Sem materiais lançados', 'Clique em Editar para cadastrar os materiais gastos nesta manutenção.')}</div>`}
      </div>
    </div>
  `);

  window._printOsData = { os, itens: itens || [] };
}

function printOs() {
  const d = window._printOsData;
  if (!d) return;
  const { os, itens } = d;

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
    <meta charset="UTF-8"><title>OS #${os.numero}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;font-size:12px;color:#000;padding:20px}
      .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:20px}
      .header h1{font-size:14px;font-weight:bold;text-transform:uppercase}
      .header .num{font-size:28px;font-weight:bold;color:#2563eb}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
      .field label{font-size:9px;font-weight:bold;text-transform:uppercase;color:#666;display:block;margin-bottom:2px}
      .field p{font-size:12px}
      .section{margin-bottom:16px}
      .section h3{font-size:10px;font-weight:bold;text-transform:uppercase;border-bottom:1px solid #ccc;padding-bottom:4px;margin-bottom:8px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th{background:#f0f0f0;padding:5px 8px;text-align:left;border:1px solid #ccc;font-size:10px}
      td{padding:5px 8px;border:1px solid #ccc}
      .sign{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:48px}
      .sign-line{border-top:1px solid #000;padding-top:6px;font-size:10px;text-align:center}
    </style>
  </head><body>
    <div class="header">
      <div>
        <h1>Prefeitura Municipal de Portobelo</h1>
        <h1>Ordem de Serviço — Manutenção Escolar</h1>
      </div>
      <div class="num">OS #${os.numero}</div>
    </div>
    <div class="grid">
      <div class="field"><label>Escola / Setor</label><p>${os.escola?.nome || '—'}</p></div>
      <div class="field"><label>Solicitante</label><p>${os.solicitante || '—'}</p></div>
      <div class="field"><label>Técnico</label><p>${os.tecnico || '—'}</p></div>
      <div class="field"><label>Data Abertura</label><p>${fmt.date(os.data_abertura)}</p></div>
      <div class="field"><label>Data Conclusão</label><p>${fmt.date(os.data_conclusao)}</p></div>
      <div class="field"><label>Status</label><p>${os.status}</p></div>
    </div>
    <div class="section">
      <h3>Descrição do Problema</h3>
      <p style="line-height:1.5">${os.descricao_problema}</p>
    </div>
    <div class="section">
      <h3>Serviço Realizado</h3>
      <p style="line-height:1.5">${os.descricao_servico || 'Não informado'}</p>
    </div>
    <div class="section">
      <h3>Materiais Utilizados</h3>
      ${itens.length ? `
      <table>
        <thead><tr><th>Material / Descrição</th><th>Quantidade</th></tr></thead>
        <tbody>
          ${itens.map(i => `<tr><td>${i.descricao}</td><td>${Number(i.quantidade).toLocaleString('pt-BR')} item(ns)</td></tr>`).join('')}
        </tbody>
      </table>` : '<p>Nenhum material registrado.</p>'}
    </div>
    <div class="sign">
      <div class="sign-line">Técnico Responsável<br>${os.tecnico || '&nbsp;'}</div>
      <div class="sign-line">Solicitante<br>${os.solicitante || '&nbsp;'}</div>
      <div class="sign-line">Supervisor / Aprovação</div>
    </div>
  </body></html>`);
  win.document.close();
  win.print();
}

async function deleteOs(id, num) {
  if (!await confirmDialog(`Excluir a OS #${num}? Esta ação não pode ser desfeita.`)) return;
  const { error } = await sb.from('ordens_servico').delete().eq('id', id);
  if (error) { toast('Erro ao excluir: ' + error.message, 'error'); return; }
  toast('OS excluída.');
  renderOsList();
}

/* =====================================================
   NOTAS DE COMPRA (Material de Construção)
   ===================================================== */
async function renderComprasList() {
  setPageTitle('Controle de Compras', 'Notas do Material de Construção');
  setHeaderAction(`<button class="btn btn-primary" onclick="navigate('compras','new')">${svgPlus()} Lançar Nova Nota</button>`);
  setContent(loader());

  const [, { data: lista }] = await Promise.all([
    loadGlobal(),
    sb.from('notas_compra')
      .select('*, itens_compra(quantidade, escola_id, escola:escola_id(nome))')
      .order('numero', { ascending: false }),
  ]);

  if (!lista || !lista.length) {
    setContent(`<div class="page-header"><div><h2>Notas do Material de Construção</h2></div></div>` +
      emptyState('Nenhuma nota lançada', 'Digitalize e lance aqui as notinhas trazidas do material de construção antes que se percam!'));
    return;
  }

  setContent(`
    <div class="page-header">
      <div><h2>Notas do Material de Construção</h2><p>${lista.length} notas digitalizadas no sistema</p></div>
    </div>
    
    <div class="filters-bar">
      <div class="filter-group" style="flex:2;min-width:200px">
        <label>Pesquisar</label>
        <input type="text" id="nc-search" placeholder="Busque por fornecedor, número ou responsável..." oninput="filterNcTable()">
      </div>
      <div class="filter-group" style="flex:1.5;min-width:160px">
        <label>Escola / Setor Destino</label>
        <select id="nc-filter-escola" onchange="filterNcTable()">
          ${escolaFilterOptions()}
        </select>
      </div>
      <div class="filter-group" style="flex:1;min-width:130px">
        <label>Status</label>
        <select id="nc-filter-status" onchange="filterNcTable()">
          <option value="">Todos os status</option>
          <option>Pendente</option><option>Autorizada</option><option>Concluída/Paga</option>
        </select>
      </div>
      <div class="filter-group">
        <label>De (Data Inicial)</label>
        <input type="date" id="nc-filter-dt-ini" onchange="filterNcTable()">
      </div>
      <div class="filter-group">
        <label>Até (Data Final)</label>
        <input type="date" id="nc-filter-dt-fim" onchange="filterNcTable()">
      </div>
    </div>

    <div class="table-wrapper">
      <table id="nc-table">
        <thead><tr>
          <th>Nota Nº</th><th>Data</th><th>Fornecedor</th><th>Quem Buscou</th><th>Quem Autorizou</th><th>Destinos (Escolas)</th><th>Total de Itens</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>
          ${lista.map(nc => {
            const escolasDestino = Array.from(new Set((nc.itens_compra || []).map(i => i.escola?.nome).filter(Boolean))).join(', ');
            const escolaIds = (nc.itens_compra || []).map(i => i.escola_id).filter(Boolean).join(',');
            const totalQtd = (nc.itens_compra || []).reduce((s, i) => s + Number(i.quantidade || 0), 0);
            return `
            <tr data-forn="${escAttr((nc.fornecedor || '').toLowerCase())}" data-resp="${escAttr((nc.responsavel_compra + ' ' + nc.responsavel_autorizacao + ' ' + nc.numero).toLowerCase())}" data-escolas-id="${escolaIds}" data-status="${escAttr(nc.status)}" data-data="${nc.data_compra}">
              <td><strong class="text-blue">Nota #${nc.numero}</strong></td>
              <td>${fmt.date(nc.data_compra)}</td>
              <td><strong>${nc.fornecedor}</strong></td>
              <td>${nc.responsavel_compra || '<span class="text-muted">—</span>'}</td>
              <td>${nc.responsavel_autorizacao || '<span class="text-muted">—</span>'}</td>
              <td>${escolasDestino ? `<span class="badge badge-ativa" title="${escolasDestino}">${escolasDestino}</span>` : '<span class="text-muted">Estoque Geral</span>'}</td>
              <td><strong>${totalQtd} item(ns)</strong></td>
              <td>${badgeStatus(nc.status)}</td>
              <td><div class="td-actions">
                <button class="btn btn-ghost btn-sm btn-icon" title="Ver detalhes da Nota" onclick="navigate('compras','${nc.id}')">${svgEye()}</button>
                <button class="btn btn-ghost btn-sm btn-icon text-red" title="Excluir" onclick="deleteNota('${nc.id}','${nc.numero}')">${svgTrash()}</button>
              </div></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `);
}

function filterNcTable() {
  const search = document.getElementById('nc-search').value.toLowerCase();
  const escolaId = document.getElementById('nc-filter-escola').value;
  const status = document.getElementById('nc-filter-status').value;
  const dtIni = document.getElementById('nc-filter-dt-ini').value;
  const dtFim = document.getElementById('nc-filter-dt-fim').value;

  document.querySelectorAll('#nc-table tbody tr').forEach(tr => {
    const matchSearch = !search || tr.dataset.forn.includes(search) || tr.dataset.resp.includes(search);
    const matchEscola = !escolaId || tr.dataset.escolasId.includes(escolaId);
    const matchStatus = !status || tr.dataset.status === status;
    const trData = tr.dataset.data;
    const matchDtIni = !dtIni || trData >= dtIni;
    const matchDtFim = !dtFim || trData <= dtFim;

    tr.style.display = matchSearch && matchEscola && matchStatus && matchDtIni && matchDtFim ? '' : 'none';
  });
}

async function renderComprasForm(id) {
  const isEdit = !!id;
  let nota = null;
  let itens = [];

  setPageTitle('Controle de Compras', isEdit ? 'Editar Nota' : 'Lançar Nova Nota');
  setHeaderAction(`<button class="btn btn-outline" onclick="navigate('compras')">${svgArrowLeft()} Voltar</button>`);
  setContent(loader());

  if (isEdit) {
    const [, { data: n }, { data: it }] = await Promise.all([
      loadGlobal(),
      sb.from('notas_compra').select('*').eq('id', id).single(),
      sb.from('itens_compra').select('*').eq('nota_compra_id', id),
    ]);
    nota = n;
    itens = it || [];
  } else {
    await loadGlobal();
  }

  G.notaItens = itens.map(i => ({ ...i, _key: Math.random() }));
  if (!G.notaItens.length) {
    G.notaItens.push({ descricao: '', quantidade: 1, escola_id: '' });
  }

  setContent(`
    <div class="page-header">
      <div><h2>${isEdit ? `Editar Nota #${nota?.numero}` : 'Digitalizar / Lançar Notinha do Material de Construção'}</h2></div>
    </div>
    <form id="nota-form" onsubmit="saveNota(event, ${isEdit ? `'${id}'` : 'null'})">
      <div class="card">
        <div class="card-header"><h3>Dados da Notinha de Compra</h3></div>
        <div class="card-body">
          <div class="form-grid">
            <div class="form-group">
              <label>Data da Compra / Retirada *</label>
              <input type="date" name="data_compra" value="${nota?.data_compra || fmt.today()}" required>
            </div>
            <div class="form-group">
              <label>Fornecedor (Material de Construção) *</label>
              <input type="text" name="fornecedor" required value="${nota?.fornecedor || 'Material de Construção'}" placeholder="Ex: Material de Construção Portobelo">
            </div>
            <div class="form-group">
              <label>Responsável que foi Buscar o Material *</label>
              <input type="text" name="responsavel_compra" required value="${nota?.responsavel_compra || ''}" placeholder="Nome de quem pegou o material">
            </div>
            <div class="form-group">
              <label>Responsável do Compras que Autorizou *</label>
              <input type="text" name="responsavel_autorizacao" required value="${nota?.responsavel_autorizacao || ''}" placeholder="Nome de quem autorizou no compras">
            </div>
            <div class="form-group">
              <label>Status da Notinha</label>
              <select name="status">
                <option ${(nota?.status || 'Autorizada') === 'Autorizada' ? 'selected' : ''}>Autorizada</option>
                <option ${nota?.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
                <option ${nota?.status === 'Concluída/Paga' ? 'selected' : ''}>Concluída/Paga</option>
              </select>
            </div>
            <div class="form-group span-full">
              <label>Observações</label>
              <textarea name="observacoes" placeholder="Anotações adicionais sobre esta notinha...">${nota?.observacoes || ''}</textarea>
            </div>
          </div>
        </div>
      </div>

      <div class="card mt-16">
        <div class="card-header">
          <h3>Itens Pegos no Material de Construção e seu Destino</h3>
          <button type="button" class="btn btn-outline btn-sm" onclick="addNotaItem()">${svgPlus()} Adicionar Item</button>
        </div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:2fr 100px 1.5fr 40px;gap:8px;margin-bottom:8px">
            <span style="font-size:11px;font-weight:600;color:var(--slate-500);text-transform:uppercase">Descrição do Material</span>
            <span style="font-size:11px;font-weight:600;color:var(--slate-500);text-transform:uppercase">Quantidade</span>
            <span style="font-size:11px;font-weight:600;color:var(--slate-500);text-transform:uppercase">Destino (Escola/Setor)</span>
            <span></span>
          </div>
          <div id="nota-itens-container"></div>
        </div>
      </div>

      <div class="flex justify-between mt-16" style="gap:8px">
        <button type="button" class="btn btn-outline" onclick="navigate('compras')">Cancelar</button>
        <button type="submit" class="btn btn-primary" id="nota-save-btn">${svgCheck()} Salvar Nota de Compra</button>
      </div>
    </form>
  `);

  renderNotaItens();
}

function renderNotaItens() {
  const container = document.getElementById('nota-itens-container');
  if (!container) return;

  container.innerHTML = G.notaItens.map((item, i) => `
    <div style="display:grid;grid-template-columns:2fr 100px 1.5fr 40px;gap:8px;align-items:center;margin-bottom:8px">
      <input type="text" placeholder="Ex: Cano PVC 100mm, Tinta..." value="${item.descricao || ''}"
        oninput="G.notaItens[${i}].descricao=this.value">
      <input type="number" min="0.01" step="0.01" placeholder="1" value="${item.quantidade || 1}"
        oninput="G.notaItens[${i}].quantidade=parseFloat(this.value)||0">
      <select onchange="G.notaItens[${i}].escola_id=this.value">
        <option value="">Estoque / Geral</option>
        ${escolaOptions(item.escola_id)}
      </select>
      <button type="button" class="btn btn-ghost btn-icon text-red" onclick="removeNotaItem(${i})">${svgTrash()}</button>
    </div>
  `).join('');
}

function addNotaItem() {
  G.notaItens.push({ descricao: '', quantidade: 1, escola_id: '' });
  renderNotaItens();
}

function removeNotaItem(i) {
  G.notaItens.splice(i, 1);
  renderNotaItens();
}

function updateNotaTotal() {}

async function saveNota(e, id) {
  e.preventDefault();
  const form = e.target;
  const btn = document.getElementById('nota-save-btn');
  btn.disabled = true; btn.textContent = 'Salvando...';

  const payload = {
    data_compra:             form.data_compra.value,
    fornecedor:              form.fornecedor.value,
    responsavel_compra:      form.responsavel_compra.value,
    responsavel_autorizacao: form.responsavel_autorizacao.value,
    status:                  form.status.value,
    observacoes:             form.observacoes.value,
    valor_total:             0,
  };

  let notaId = id;
  if (id) {
    const { error } = await sb.from('notas_compra').update(payload).eq('id', id);
    if (error) { toast('Erro ao atualizar nota: ' + error.message, 'error'); btn.disabled = false; return; }
  } else {
    const { data, error } = await sb.from('notas_compra').insert(payload).select().single();
    if (error) { toast('Erro ao lançar nota: ' + error.message, 'error'); btn.disabled = false; return; }
    notaId = data.id;
  }

  if (id) await sb.from('itens_compra').delete().eq('nota_compra_id', notaId);
  const itens = G.notaItens.filter(i => i.descricao?.trim());
  if (itens.length) {
    await sb.from('itens_compra').insert(itens.map(i => ({
      nota_compra_id: notaId,
      descricao:       i.descricao,
      quantidade:      parseFloat(i.quantidade) || 1,
      custo_unitario:  0,
      escola_id:       i.escola_id || null,
      data_retirada:   form.data_compra.value
    })));
  }

  toast(id ? 'Nota atualizada!' : 'Nota de Compra lançada com sucesso!');
  navigate('compras', notaId);
}

async function renderComprasDetail(id) {
  setPageTitle('Controle de Compras', 'Detalhes da Nota');
  setHeaderAction(`<button class="btn btn-outline" onclick="navigate('compras')">${svgArrowLeft()} Voltar</button>`);
  setContent(loader());

  const [{ data: nota }, { data: itens }] = await Promise.all([
    sb.from('notas_compra').select('*').eq('id', id).single(),
    sb.from('itens_compra').select('*, escola:escola_id(nome)').eq('nota_compra_id', id),
  ]);

  if (!nota) { toast('Nota não encontrada', 'error'); navigate('compras'); return; }

  const totalQtd = (itens || []).reduce((s, i) => s + Number(i.quantidade || 0), 0);

  setHeaderAction(`
    <button class="btn btn-outline" onclick="navigate('compras')">${svgArrowLeft()} Voltar</button>
    <button class="btn btn-outline" onclick="navigate('compras','${id}');setTimeout(()=>renderComprasForm('${id}'),0)">${svgEdit()} Editar Nota</button>
    <button class="btn btn-primary" onclick="printNota()">${svgPrint()} Imprimir Comprovante</button>
  `);

  setContent(`
    <div id="print-area">
      <div class="page-header">
        <div>
          <h2>Nota de Compra #${nota.numero} <span style="font-size:14px;font-weight:400;margin-left:8px">${badgeStatus(nota.status)}</span></h2>
          <p>Digitalizada em ${fmt.date(nota.data_compra)} · ${nota.fornecedor}</p>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>Dados da Nota</h3></div>
        <div class="card-body">
          <div class="detail-grid">
            <div class="detail-field"><label>Número da Nota</label><p>#${nota.numero}</p></div>
            <div class="detail-field"><label>Data da Compra</label><p>${fmt.date(nota.data_compra)}</p></div>
            <div class="detail-field"><label>Fornecedor</label><p>${nota.fornecedor}</p></div>
            <div class="detail-field"><label>Responsável que Buscou</label><p>${nota.responsavel_compra || '—'}</p></div>
            <div class="detail-field"><label>Autorizado no Compras por</label><p>${nota.responsavel_autorizacao || '—'}</p></div>
            <div class="detail-field"><label>Total de Itens Pegos</label><p class="text-blue text-bold" style="font-size:16px">${totalQtd} item(ns)</p></div>
          </div>
          ${nota.observacoes ? `<hr class="divider"><div class="detail-field"><label>Observações</label><p style="margin-top:4px">${nota.observacoes}</p></div>` : ''}
        </div>
      </div>

      <div class="card mt-16">
        <div class="card-header">
          <h3>Itens Pegos no Material de Construção e seu Destino</h3>
        </div>
        ${itens && itens.length ? `
        <div class="table-wrapper" style="border:none;border-radius:0;box-shadow:none">
          <table>
            <thead><tr><th>Material / Item</th><th>Quantidade Pega</th><th>Destino (Escola/Setor)</th></tr></thead>
            <tbody>
              ${itens.map(i => `
                <tr>
                  <td><strong>${i.descricao}</strong></td>
                  <td>${Number(i.quantidade).toLocaleString('pt-BR')} item(ns)</td>
                  <td>${i.escola?.nome ? `<span class="badge badge-ativa">${i.escola.nome}</span>` : '<span class="text-muted">Estoque / Uso Geral</span>'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : `<div class="card-body">${emptyState('Sem itens', 'Nenhum item foi registrado nesta nota.')}</div>`}
      </div>
    </div>
  `);

  window._printNotaData = { nota, itens: itens || [], totalQtd };
}

function printNota() {
  const d = window._printNotaData;
  if (!d) return;
  const { nota, itens, totalQtd } = d;

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
    <meta charset="UTF-8"><title>Nota de Compra #${nota.numero}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;font-size:12px;color:#000;padding:20px}
      .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:20px}
      .header h1{font-size:14px;font-weight:bold;text-transform:uppercase}
      .header .num{font-size:24px;font-weight:bold;color:#2563eb}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
      .field label{font-size:9px;font-weight:bold;text-transform:uppercase;color:#666;display:block;margin-bottom:2px}
      .field p{font-size:12px}
      table{width:100%;border-collapse:collapse;font-size:11px;margin-top:16px}
      th{background:#f0f0f0;padding:5px 8px;text-align:left;border:1px solid #ccc;font-size:10px}
      td{padding:5px 8px;border:1px solid #ccc}
      .sign{display:grid;grid-template-columns:repeat(2,1fr);gap:40px;margin-top:60px}
      .sign-line{border-top:1px solid #000;padding-top:6px;font-size:10px;text-align:center}
    </style>
  </head><body>
    <div class="header">
      <div>
        <h1>Prefeitura Municipal de Portobelo</h1>
        <h1>Comprovante de Retirada / Notinha do Material de Construção</h1>
      </div>
      <div class="num">Nota #${nota.numero}</div>
    </div>
    <div class="grid">
      <div class="field"><label>Data da Compra</label><p>${fmt.date(nota.data_compra)}</p></div>
      <div class="field"><label>Fornecedor</label><p>${nota.fornecedor}</p></div>
      <div class="field"><label>Status</label><p>${nota.status}</p></div>
      <div class="field"><label>Quem Buscou no Material</label><p>${nota.responsavel_compra || '—'}</p></div>
      <div class="field"><label>Autorizado no Compras por</label><p>${nota.responsavel_autorizacao || '—'}</p></div>
      <div class="field"><label>Total de Itens</label><p><strong>${totalQtd} item(ns)</strong></p></div>
    </div>
    <table>
      <thead><tr><th>Material / Descrição</th><th>Quantidade Pega</th><th>Destino (Escola/Setor)</th></tr></thead>
      <tbody>
        ${itens.map(i => `<tr><td>${i.descricao}</td><td>${Number(i.quantidade).toLocaleString('pt-BR')} item(ns)</td><td>${i.escola?.nome || 'Estoque / Geral'}</td></tr>`).join('')}
      </tbody>
    </table>
    <div class="sign">
      <div class="sign-line">Responsável que Retirou o Material<br>${nota.responsavel_compra || '&nbsp;'}</div>
      <div class="sign-line">Autorização do Setor de Compras<br>${nota.responsavel_autorizacao || '&nbsp;'}</div>
    </div>
  </body></html>`);
  win.document.close();
  win.print();
}

async function deleteNota(id, num) {
  if (!await confirmDialog(`Excluir a Nota #${num}? Todos os itens da nota serão removidos.`)) return;
  await sb.from('notas_compra').delete().eq('id', id);
  toast('Nota excluída.');
  renderComprasList();
}

/* =====================================================
   MATERIAIS
   ===================================================== */
async function renderMateriais() {
  setPageTitle('Materiais');
  setHeaderAction(`<button class="btn btn-primary" onclick="showMaterialModal()">${svgPlus()} Novo Material</button>`);
  setContent(loader());

  const { data: lista } = await sb.from('materiais').select('*').order('nome');

  setContent(`
    <div class="page-header">
      <div><h2>Catálogo de Materiais</h2><p>${(lista || []).length} materiais cadastrados</p></div>
    </div>
    <div class="filters-bar">
      <div class="filter-group" style="flex:1">
        <label>Pesquisar Material</label>
        <input type="text" id="mat-search" placeholder="Digite o nome..." oninput="filterMatTable()">
      </div>
    </div>
    <div class="table-wrapper">
      <table id="mat-table">
        <thead><tr><th>Nome do Material</th><th>Unidade</th><th></th></tr></thead>
        <tbody>
          ${(lista || []).map(m => `
            <tr data-nome="${escAttr(m.nome.toLowerCase())}">
              <td><strong>${m.nome}</strong></td>
              <td><span class="badge badge-ativa">${m.unidade}</span></td>
              <td><div class="td-actions">
                <button class="btn btn-ghost btn-sm btn-icon text-red" onclick="deleteMaterial('${m.id}','${m.nome.replace(/'/g, "\\'")}')">${svgTrash()}</button>
              </div></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${!(lista && lista.length) ? emptyState('Sem materiais', 'Adicione materiais ao catálogo.') : ''}
  `);
}

function filterMatTable() {
  const search = document.getElementById('mat-search').value.toLowerCase();
  document.querySelectorAll('#mat-table tbody tr').forEach(tr => {
    tr.style.display = !search || tr.dataset.nome.includes(search) ? '' : 'none';
  });
}

function showMaterialModal() {
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.id = 'material-modal';
  bd.innerHTML = `
    <div class="modal" style="max-width:440px">
      <div class="modal-header">
        <h3>Novo Material</h3>
        <button class="btn btn-ghost btn-icon" onclick="document.getElementById('material-modal').remove()">${svgX()}</button>
      </div>
      <form id="material-form" onsubmit="saveMaterial(event)">
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group span-full">
              <label>Nome do Material *</label>
              <input type="text" name="nome" required placeholder="Ex: Torneira de pia, Assento sanitário...">
            </div>
            <div class="form-group span-full">
              <label>Unidade de Medida *</label>
              <select name="unidade">
                ${['un','m','m²','m³','kg','L','rolo','saco','balde','lata','cx','par','jogo'].map(u => `<option>${u}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="document.getElementById('material-modal').remove()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(bd);
  bd.onclick = e => { if (e.target === bd) bd.remove(); };
}

async function saveMaterial(e) {
  e.preventDefault();
  const form = e.target;
  const { error } = await sb.from('materiais').insert({
    nome: form.nome.value,
    unidade: form.unidade.value,
    custo_ref: 0,
  });
  if (error) { toast('Erro: ' + error.message, 'error'); return; }
  toast('Material adicionado!');
  document.getElementById('material-modal')?.remove();
  await loadGlobal(true); // força atualização do cache, pois a lista mudou
  renderMateriais();
}

async function deleteMaterial(id, nome) {
  if (!await confirmDialog(`Excluir o material "${nome}"?`)) return;
  await sb.from('materiais').delete().eq('id', id);
  toast('Material excluído.');
  await loadGlobal(true); // força atualização do cache, pois a lista mudou
  renderMateriais();
}

/* =====================================================
   RELATÓRIOS (COM PERÍODO DE DATA INICIAL E FINAL)
   ===================================================== */
async function renderRelatorios() {
  setPageTitle('Relatórios');
  setHeaderAction('');
  await loadGlobal();

  const hoje = new Date();
  const primeiroDia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
  const ultimoDia = fmt.today();

  setContent(`
    <div class="page-header"><div><h2>Relatórios de Manutenção e Consumo</h2><p>Gere relatórios por faixa de data e por escola/setor</p></div></div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <!-- Relatório de OS -->
      <div class="card">
        <div class="card-header"><h3>${svgClipboard()} Relatório de Manutenções (OS)</h3></div>
        <div class="card-body">
          <p style="font-size:13.5px;color:var(--slate-600);margin-bottom:16px">
            Lista as OS do período selecionado, com o problema relatado, serviço realizado e <strong>materiais utilizados</strong>.
          </p>
          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div class="form-group">
              <label>Data Inicial</label>
              <input type="date" id="os-rel-dt-ini" value="${primeiroDia}">
            </div>
            <div class="form-group">
              <label>Data Final</label>
              <input type="date" id="os-rel-dt-fim" value="${ultimoDia}">
            </div>
            <div class="form-group span-full">
              <label>Filtrar por Escola / Setor</label>
              <select id="os-rel-escola">
                ${escolaFilterOptions()}
              </select>
            </div>
          </div>
          <button class="btn btn-primary w-full" onclick="gerarRelatorioOS()">
            ${svgChart()} Gerar Relatório de OS
          </button>
        </div>
      </div>

      <!-- Relatório de Compras -->
      <div class="card">
        <div class="card-header"><h3>${svgCart()} Relatório de Retiradas (Material de Construção)</h3></div>
        <div class="card-body">
          <p style="font-size:13.5px;color:var(--slate-600);margin-bottom:16px">
            Relatório de tudo o que foi pego no material de construção na faixa de datas e seu destino final.
          </p>
          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div class="form-group">
              <label>Data Inicial</label>
              <input type="date" id="cp-rel-dt-ini" value="${primeiroDia}">
            </div>
            <div class="form-group">
              <label>Data Final</label>
              <input type="date" id="cp-rel-dt-fim" value="${ultimoDia}">
            </div>
            <div class="form-group span-full">
              <label>Filtrar por Escola / Setor Destino</label>
              <select id="cp-rel-escola">
                ${escolaFilterOptions()}
              </select>
            </div>
          </div>
          <button class="btn btn-primary w-full" onclick="gerarRelatorioCompras()">
            ${svgChart()} Gerar Relatório de Compras
          </button>
        </div>
      </div>
    </div>

    <div id="relatorio-resultado" class="mt-24"></div>
  `);
}

async function gerarRelatorioOS() {
  const dtIni = document.getElementById('os-rel-dt-ini').value;
  const dtFim = document.getElementById('os-rel-dt-fim').value;
  const escolaId = document.getElementById('os-rel-escola').value;

  const container = document.getElementById('relatorio-resultado');
  container.innerHTML = loader();

  let query = sb
    .from('ordens_servico')
    .select('*, escola:escola_id(nome), os_materiais(*)')
    .order('numero');

  if (dtIni) query = query.gte('data_abertura', dtIni);
  if (dtFim) query = query.lte('data_abertura', dtFim);
  if (escolaId) query = query.eq('escola_id', escolaId);

  const { data: os } = await query;

  if (!os || !os.length) {
    container.innerHTML = `<div class="card"><div class="card-body">${emptyState('Sem dados', `Nenhuma OS encontrada para a faixa de datas e escola selecionadas.`)}</div></div>`;
    return;
  }

  const nomeEscolaFiltro = escolaId ? (G.escolas.find(e => e.id === escolaId)?.nome || '') : 'Todas as Escolas';
  const periodoTexto = `${fmt.date(dtIni)} até ${fmt.date(dtFim)}`;

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>Relatório de OS — Período: ${periodoTexto} (${nomeEscolaFiltro})</h3>
        <button class="btn btn-outline btn-sm" onclick="printRelatorioOS('${dtIni}','${dtFim}','${nomeEscolaFiltro.replace(/'/g, "\\'")}')">${svgPrint()} Imprimir Relatório</button>
      </div>
      <div style="padding:14px 24px;background:var(--primary-light);display:flex;gap:28px;flex-wrap:wrap">
        <div><span style="font-size:11px;color:var(--slate-500);font-weight:700">Total de OS</span><br><strong style="font-size:18px">${os.length}</strong></div>
        <div><span style="font-size:11px;color:var(--slate-500);font-weight:700">Via Form Google</span><br><strong style="font-size:18px">${os.filter(o=>o.origem==='Formulario').length}</strong></div>
        <div><span style="font-size:11px;color:var(--slate-500);font-weight:700">Concluídas</span><br><strong style="font-size:18px" class="text-green">${os.filter(o=>o.status==='Concluída').length}</strong></div>
      </div>
      <div class="table-wrapper" style="border:none;border-radius:0;box-shadow:none">
        <table>
          <thead><tr><th>Nº</th><th>Origem</th><th>Data</th><th>Escola / Setor</th><th>Problema Relatado</th><th>Serviço Realizado</th><th>Materiais Gastos</th><th>Status</th></tr></thead>
          <tbody>
            ${os.map(o => `<tr>
                <td class="text-blue text-bold">#${o.numero}</td>
                <td>${o.origem === 'Formulario' ? '<span class="badge badge-ativa">Form</span>' : '<span class="badge badge-aberta">Manual</span>'}</td>
                <td>${fmt.date(o.data_abertura)}</td>
                <td><strong>${o.escola?.nome||'—'}</strong></td>
                <td style="max-width:200px">${o.descricao_problema}</td>
                <td style="max-width:180px">${o.descricao_servico||'—'}</td>
                <td style="max-width:220px"><strong>${formatarMateriaisTexto(o.os_materiais)}</strong></td>
                <td>${badgeStatus(o.status)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  window._relOS = { os, dtIni, dtFim, filtroEscola: nomeEscolaFiltro };
}

async function gerarRelatorioCompras() {
  const dtIni = document.getElementById('cp-rel-dt-ini').value;
  const dtFim = document.getElementById('cp-rel-dt-fim').value;
  const escolaId = document.getElementById('cp-rel-escola').value;

  const container = document.getElementById('relatorio-resultado');
  container.innerHTML = loader();

  let query = sb
    .from('notas_compra')
    .select('*, itens_compra(*, escola:escola_id(id, nome))')
    .order('numero');

  if (dtIni) query = query.gte('data_compra', dtIni);
  if (dtFim) query = query.lte('data_compra', dtFim);

  const { data: notas } = await query;

  if (!notas || !notas.length) {
    container.innerHTML = `<div class="card"><div class="card-body">${emptyState('Sem dados', `Nenhuma nota de compra encontrada para o período selecionado.`)}</div></div>`;
    return;
  }

  let notasFiltradas = notas.map(n => {
    const itens = (n.itens_compra || []).filter(i => !escolaId || i.escola_id === escolaId);
    return { ...n, itens_compra: itens };
  }).filter(n => n.itens_compra.length > 0);

  if (!notasFiltradas.length) {
    container.innerHTML = `<div class="card"><div class="card-body">${emptyState('Sem dados', `Nenhuma retirada encontrada para a escola selecionada no período.`)}</div></div>`;
    return;
  }

  const totalItens = notasFiltradas.reduce((s, n) => s + n.itens_compra.reduce((ss, i) => ss + Number(i.quantidade || 0), 0), 0);
  const nomeEscolaFiltro = escolaId ? (G.escolas.find(e => e.id === escolaId)?.nome || '') : 'Todas as Escolas';
  const periodoTexto = `${fmt.date(dtIni)} até ${fmt.date(dtFim)}`;

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>Relatório de Retiradas — Período: ${periodoTexto} (${nomeEscolaFiltro})</h3>
        <button class="btn btn-outline btn-sm" onclick="printRelatorioCompras('${dtIni}','${dtFim}','${nomeEscolaFiltro.replace(/'/g, "\\'")}')">${svgPrint()} Imprimir Relatório</button>
      </div>
      <div style="padding:14px 24px;background:var(--success-light);display:flex;gap:28px;flex-wrap:wrap">
        <div><span style="font-size:11px;color:var(--slate-500);font-weight:700">Notas com Retiradas</span><br><strong style="font-size:18px">${notasFiltradas.length}</strong></div>
        <div><span style="font-size:11px;color:var(--slate-500);font-weight:700">Total de Itens Pegos</span><br><strong class="text-blue" style="font-size:18px">${totalItens} item(ns)</strong></div>
      </div>
      ${notasFiltradas.map(n => `
        <div style="border-top:1px solid var(--slate-200)">
          <div style="padding:12px 24px;background:var(--slate-50);display:flex;justify-content:space-between;align-items:center">
            <div>
              <strong class="text-blue">Nota #${n.numero}</strong> — ${n.fornecedor} (${fmt.date(n.data_compra)})
              <span style="font-size:11px;color:var(--slate-500);margin-left:10px">Buscou: ${n.responsavel_compra || '—'} | Autorizou: ${n.responsavel_autorizacao || '—'}</span>
            </div>
            <span class="badge badge-ativa">${n.itens_compra.reduce((s,i)=>s+Number(i.quantidade||0),0)} itens</span>
          </div>
          <div class="table-wrapper" style="border:none;border-radius:0;box-shadow:none">
            <table>
              <thead><tr><th>Material Pego</th><th>Quantidade Pega</th><th>Destino (Escola / Setor)</th></tr></thead>
              <tbody>
                ${n.itens_compra.map(i => `
                  <tr>
                    <td><strong>${i.descricao}</strong></td>
                    <td>${Number(i.quantidade).toLocaleString('pt-BR')} item(ns)</td>
                    <td>${i.escola?.nome ? `<span class="badge badge-ativa">${i.escola.nome}</span>` : 'Estoque / Geral'}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>`).join('')}
      <div class="card-footer">
        <div style="display:flex;justify-content:flex-end">
          <span style="font-size:14px;font-weight:700">TOTAL DE ITENS RETIRADOS NO PERÍODO (${nomeEscolaFiltro}): <span class="text-blue">${totalItens} item(ns)</span></span>
        </div>
      </div>
    </div>`;

  window._relCompras = { notas: notasFiltradas, dtIni, dtFim, totalItens, filtroEscola: nomeEscolaFiltro };
}

function printRelatorioOS(dtIni, dtFim, filtroEscola) {
  const d = window._relOS;
  if (!d) return;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
    <meta charset="UTF-8"><title>Relatório OS ${fmt.date(dtIni)} a ${fmt.date(dtFim)}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;padding:20px}
      h1{font-size:16px;font-weight:bold;margin-bottom:4px}h2{font-size:13px;color:#555;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;margin-bottom:16px}
      th{background:#f0f0f0;padding:5px 8px;text-align:left;border:1px solid #ccc;font-size:10px}
      td{padding:5px 8px;border:1px solid #ccc}
      .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;padding:12px;background:#eff6ff;border-radius:6px}
    </style></head><body>
    <h1>Prefeitura Municipal de Portobelo — Relatório de Ordens de Serviço</h1>
    <h2>Período: ${fmt.date(dtIni)} a ${fmt.date(dtFim)} — ${filtroEscola || 'Todas as Escolas'}</h2>
    <div class="summary">
      <div><strong>Total de OS:</strong> ${d.os.length}</div>
      <div><strong>Via Form Google:</strong> ${d.os.filter(o=>o.origem==='Formulario').length}</div>
      <div><strong>Concluídas:</strong> ${d.os.filter(o=>o.status==='Concluída').length}</div>
    </div>
    <table>
      <thead><tr><th>Nº</th><th>Origem</th><th>Data</th><th>Escola / Setor</th><th>Problema</th><th>Serviço Realizado</th><th>Materiais Utilizados</th><th>Status</th></tr></thead>
      <tbody>
        ${d.os.map(o=>`<tr><td>#${o.numero}</td><td>${o.origem}</td><td>${fmt.date(o.data_abertura)}</td><td>${o.escola?.nome||'—'}</td><td>${o.descricao_problema}</td><td>${o.descricao_servico||'—'}</td><td>${formatarMateriaisTexto(o.os_materiais)}</td><td>${o.status}</td></tr>`).join('')}
      </tbody>
    </table>
  </body></html>`);
  win.document.close(); win.print();
}

function printRelatorioCompras(dtIni, dtFim, filtroEscola) {
  const d = window._relCompras;
  if (!d) return;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
    <meta charset="UTF-8"><title>Relatório Compras ${fmt.date(dtIni)} a ${fmt.date(dtFim)}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;padding:20px}
      h1{font-size:16px;font-weight:bold;margin-bottom:4px}h2{font-size:13px;color:#555;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;margin-bottom:12px}
      th{background:#f0f0f0;padding:5px 8px;text-align:left;border:1px solid #ccc;font-size:10px}
      td{padding:5px 8px;border:1px solid #ccc}
      .nc-header{background:#e2f5e9;padding:8px;font-weight:bold;margin-bottom:0;border:1px solid #ccc;border-bottom:none}
      .summary{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px;padding:12px;background:#f0fdf4;border-radius:6px}
    </style></head><body>
    <h1>Prefeitura Municipal de Portobelo — Relatório de Retiradas (Material de Construção)</h1>
    <h2>Período: ${fmt.date(dtIni)} a ${fmt.date(dtFim)} — ${filtroEscola || 'Todas as Escolas'}</h2>
    <div class="summary">
      <div><strong>Total de Notas:</strong> ${d.notas.length}</div>
      <div><strong>Total de Itens Pegos:</strong> ${d.totalItens} item(ns)</div>
    </div>
    ${d.notas.map(n=>`
      <div class="nc-header">Nota #${n.numero} — ${n.fornecedor} (${fmt.date(n.data_compra)}) | Buscou: ${n.responsavel_compra || '—'} | Autorizou: ${n.responsavel_autorizacao || '—'}</div>
      <table>
        <thead><tr><th>Material Pego</th><th>Quantidade Pega</th><th>Destino (Escola/Setor)</th></tr></thead>
        <tbody>
          ${(n.itens_compra||[]).map(i=>`<tr><td>${i.descricao}</td><td>${Number(i.quantidade).toLocaleString('pt-BR')} item(ns)</td><td>${i.escola?.nome||'Estoque / Geral'}</td></tr>`).join('')}
        </tbody>
      </table>`).join('')}
  </body></html>`);
  win.document.close(); win.print();
}

/* =====================================================
   CONFIGURAÇÕES (Gerenciar Escolas e Setores)
   ===================================================== */
async function renderConfiguracoes() {
  setPageTitle('Configurações');
  setHeaderAction(`<button class="btn btn-primary" onclick="showEscolaModal()">${svgPlus()} Nova Escola / Setor</button>`);
  setContent(loader());

  const { data: escolas } = await sb.from('escolas').select('*').order('nome');

  setContent(`
    <div class="page-header"><div><h2>Configurações</h2><p>Gerenciar escolas e setores municipais cadastrados</p></div></div>
    <div class="card">
      <div class="card-header">
        <h3>Escolas e Setores Cadastrados</h3>
        <button class="btn btn-outline btn-sm" onclick="showEscolaModal()">${svgPlus()} Adicionar</button>
      </div>
      <div class="table-wrapper" style="border:none;border-radius:0;box-shadow:none">
        <table>
          <thead><tr><th>Nome da Escola / Setor</th><th>E-mail</th><th></th></tr></thead>
          <tbody>
            ${(escolas || []).map(e => `
              <tr>
                <td><strong>${e.nome}</strong></td>
                <td>${e.email || '<span class="text-muted">—</span>'}</td>
                <td><div class="td-actions">
                  <button class="btn btn-ghost btn-sm btn-icon text-red" onclick="deleteEscola('${e.id}','${e.nome.replace(/'/g, "\\'")}')">${svgTrash()}</button>
                </div></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `);
}

function showEscolaModal() {
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.id = 'escola-modal';
  bd.innerHTML = `
    <div class="modal" style="max-width:420px">
      <div class="modal-header">
        <h3>Nova Escola ou Setor</h3>
        <button class="btn btn-ghost btn-icon" onclick="document.getElementById('escola-modal').remove()">${svgX()}</button>
      </div>
      <form id="escola-form" onsubmit="saveEscola(event)">
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group span-full">
              <label>Nome da Escola / Setor *</label>
              <input type="text" name="nome" required placeholder="Ex: Escola Maria Benta, Almoxarifado, etc.">
            </div>
            <div class="form-group span-full">
              <label>E-mail (opcional)</label>
              <input type="email" name="email" placeholder="escola@portobelo.sc.gov.br">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="document.getElementById('escola-modal').remove()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(bd);
  bd.onclick = e => { if (e.target === bd) bd.remove(); };
}

async function saveEscola(e) {
  e.preventDefault();
  const form = e.target;
  const { error } = await sb.from('escolas').insert({ nome: form.nome.value, email: form.email.value });
  if (error) { toast('Erro: ' + error.message, 'error'); return; }
  toast('Escola/Setor adicionado!');
  document.getElementById('escola-modal')?.remove();
  await loadGlobal(true); // força atualização do cache, pois a lista mudou
  renderConfiguracoes();
}

async function deleteEscola(id, nome) {
  if (!await confirmDialog(`Excluir a escola/setor "${nome}"?`)) return;
  await sb.from('escolas').delete().eq('id', id);
  toast('Escola/Setor excluído.');
  await loadGlobal(true); // força atualização do cache, pois a lista mudou
  renderConfiguracoes();
}

/* =====================================================
   SVG ICONS
   ===================================================== */
const svgAttrs = `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;

function svgClipboard() { return `<svg ${svgAttrs}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>`; }
function svgCheck()     { return `<svg ${svgAttrs}><path d="M5 13l4 4L19 7"/></svg>`; }
function svgCart()      { return `<svg ${svgAttrs}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6"/></svg>`; }
function svgMoney()     { return `<svg ${svgAttrs}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>`; }
function svgChart()     { return `<svg ${svgAttrs}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`; }
function svgPlus()      { return `<svg ${svgAttrs}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`; }
function svgEye()       { return `<svg ${svgAttrs}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`; }
function svgTrash()     { return `<svg ${svgAttrs}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>`; }
function svgEdit()      { return `<svg ${svgAttrs}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`; }
function svgPrint()     { return `<svg ${svgAttrs}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`; }
function svgArrowLeft() { return `<svg ${svgAttrs}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`; }
function svgX()         { return `<svg ${svgAttrs}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`; }
function svgCode()      { return `<svg ${svgAttrs}><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`; }

/* =====================================================
   INICIALIZAÇÃO
   ===================================================== */
window.addEventListener('DOMContentLoaded', async () => {
  const form=document.getElementById('login-form');
  const button=document.getElementById('login-button');
  const demoButton=document.getElementById('demo-button');

  form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  document.getElementById('login-error').hidden = true;

  button.disabled = true;
  button.textContent = 'Entrando...';

  // Login da demonstração — nunca acessa o Supabase
  if (email === 'demo@portfolio.local' && password === 'demo1234') {
    button.disabled = false;
    button.textContent = 'Entrar';
    await startDemoSession();
    return;
  }

  // Login real pelo Supabase
  const { error } = await realSb.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error('Erro Supabase Auth:', error);

    loginError(error.message);

    button.disabled = false;
    button.textContent = 'Entrar';
    return;
  }

  button.disabled = false;
  button.textContent = 'Entrar';

  await startRealSession();
});

  demoButton.addEventListener('click', startDemoSession);
  window.addEventListener('hashchange', router);

  const demoSession=localStorage.getItem('manutencao_demo_session')==='1';
  if (demoSession) {
    await startDemoSession();
    return;
  }

  const { data:{ session } } = await realSb.auth.getSession();
  if (session) await startRealSession();
  else showLogin();

  realSb.auth.onAuthStateChange(async (_event, session) => {
    if (!session && !demoMode) showLogin();
  });
});

// Expor funções globais chamadas via onclick no HTML
Object.assign(window, {
  navigate, filterOsTable, filterNcTable, filterMatTable,
  addOsItem, removeOsItem, updateOsTotal,
  saveOs, deleteOs, printOs, showFormScriptModal,
  addNotaItem, removeNotaItem, updateNotaTotal,
  saveNota, deleteNota, printNota,
  renderMateriais, showMaterialModal, saveMaterial, deleteMaterial,
  gerarRelatorioOS, gerarRelatorioCompras, printRelatorioOS, printRelatorioCompras,
  renderConfiguracoes, showEscolaModal, saveEscola, deleteEscola, logout,
  renderOsForm, renderComprasForm, G,
});