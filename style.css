/* ==========================================
   VARIÁVEIS DE TEMA DINÂMICAS (PARHUB STYLE)
   ========================================== */
.dark-theme {
    --bg-main: #0b0c10;
    --bg-side: #0e1017;
    --bg-surface: #141722;
    --bg-field: #1c2030;
    --border-soft: #202538;
    --text-primary: #f8fafc;
    --text-secondary: #94a3b8;
    --neon-blue: #00f2fe;
    --neon-glow: rgba(0, 242, 254, 0.25);
}

.light-theme {
    --bg-main: #f1f5f9;
    --bg-side: #ffffff;
    --bg-surface: #ffffff;
    --bg-field: #f8fafc;
    --border-soft: #e2e8f0;
    --text-primary: #0f172a;
    --text-secondary: #64748b;
    --neon-blue: #0284c7; /* Azul mais denso para contraste no claro */
    --neon-glow: rgba(2, 132, 199, 0.15);
}

:root {
    --success-clean: #10b981;
    --warning-clean: #f59e0b;
    --danger-clean: #f43f5e;
    --radius-premium: 10px;
    --transition-smooth: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ==========================================
   RESET E ESTRUTURA BASE
   ========================================== */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

body {
    background-color: var(--bg-main);
    color: var(--text-primary);
    transition: var(--transition-smooth);
    min-height: 100vh;
}

.dashboard-layout {
    display: flex;
    min-height: 100vh;
}

/* ==========================================
   SIDEBAR (BARRA LATERAL PARHUB)
   ========================================== */
.sidebar {
    width: 260px;
    background-color: var(--bg-side);
    border-right: 1px solid var(--border-soft);
    display: flex;
    flex-direction: column;
    padding: 24px;
    flex-shrink: 0;
    transition: var(--transition-smooth);
}

.sidebar-brand {
    margin-bottom: 30px;
}

.logo-neon {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--neon-blue);
    letter-spacing: 1px;
    display: flex;
    align-items: center;
    gap: 8px;
    text-shadow: 0 0 10px var(--neon-glow);
}

.sub-brand {
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 600;
    margin-top: 2px;
    display: block;
}

.user-profile-side {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: rgba(255,255,255,0.02);
    border-radius: var(--radius-premium);
    margin-bottom: 30px;
    border: 1px solid var(--border-soft);
}

.user-profile-side .avatar {
    width: 38px;
    height: 38px;
    background-color: var(--neon-blue);
    color: #000;
    font-weight: bold;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
}

.user-info {
    display: flex;
    flex-direction: column;
}

.user-info .welcome {
    font-size: 0.7rem;
    color: var(--text-secondary);
}

.user-info .username {
    font-size: 0.85rem;
    font-weight: 600;
}

.sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex-grow: 1;
}

.nav-item {
    background: transparent;
    border: none;
    padding: 12px 16px;
    color: var(--text-secondary);
    text-align: left;
    font-size: 0.9rem;
    font-weight: 500;
    border-radius: var(--radius-premium);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: var(--transition-smooth);
}

.nav-item:hover {
    color: var(--text-primary);
    background-color: var(--bg-surface);
}

.nav-item.active {
    color: var(--text-primary);
    background-color: var(--bg-field);
    border-left: 3px solid var(--neon-blue);
    border-radius: 0 var(--radius-premium) var(--radius-premium) 0;
}

.sidebar-footer {
    font-size: 0.75rem;
    color: var(--text-secondary);
}

/* ==========================================
   CONTEÚDO PRINCIPAL & HEADER
   ========================================== */
.main-wrapper {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    overflow-x: hidden;
}

.top-meta-bar {
    padding: 24px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-soft);
    background-color: var(--bg-side);
}

.page-title-area h1 {
    font-size: 1.5rem;
    font-weight: 700;
}

.page-subtitle {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-top: 2px;
}

.theme-toggle-btn {
    background: var(--bg-surface);
    border: 1px solid var(--border-soft);
    color: var(--text-primary);
    width: 40px;
    height: 40px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: var(--transition-smooth);
}
.theme-toggle-btn:hover {
    border-color: var(--neon-blue);
    box-shadow: 0 0 8px var(--neon-glow);
}

.main-content {
    padding: 40px;
}

/* ==========================================
   ELEMENTOS DE BOTÃO E CARTÃO PREMIUM
   ========================================== */
.action-bar {
    display: flex;
    justify-content: space-between;
    margin-bottom: 24px;
}

.btn-neon {
    background-color: var(--neon-blue);
    color: #000 !important;
    border: none;
    padding: 12px 24px;
    border-radius: var(--radius-premium);
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 14px var(--neon-glow);
    transition: var(--transition-smooth);
}
.btn-neon:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px var(--neon-glow);
}

.parhub-card {
    background-color: var(--bg-surface);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-premium);
    padding: 24px;
    transition: var(--transition-smooth);
}

/* ==========================================
   TABELA MINIMALISTA ESTILO PARHUB
   ========================================== */
.table-card {
    padding: 0;
    overflow: hidden;
}

.table-responsive {
    width: 100%;
    overflow-x: auto;
}

.leads-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: 0.85rem;
}

.leads-table th {
    padding: 16px 20px;
    color: var(--text-secondary);
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.7rem;
    letter-spacing: 0.5px;
    background: rgba(0,0,0,0.05);
    border-bottom: 1px solid var(--border-soft);
}

.leads-table td {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-soft);
    white-space: nowrap;
}

.leads-table tbody tr:last-child td {
    border-bottom: none;
}

.leads-table tbody tr:hover {
    background: rgba(255,255,255,0.01);
}

/* Modificadores de Células */
.lead-main-name { font-weight: 600; color: var(--text-primary); }
.lead-co-name { font-size: 0.75rem; color: var(--text-secondary); display: block; }

/* Badges e Status */
.p-badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
}
.p-badge-blue { background: rgba(0, 242, 254, 0.1); color: var(--neon-blue); }
.p-badge-success { background: rgba(16, 185, 129, 0.1); color: var(--success-clean); }
.p-badge-warning { background: rgba(245, 158, 11, 0.1); color: var(--warning-clean); }
.p-badge-danger { background: rgba(244, 63, 94, 0.1); color: var(--danger-clean); }

/* ==========================================
   PÁGINA 2: GRAPHICS & METRICS LAYOUT
   ========================================== */
.metrics-summary-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    margin-bottom: 24px;
}

.stat-card {
    position: relative;
    border-left: 4px solid var(--border-soft);
}
.stat-card.border-neon { border-left-color: var(--neon-blue); }

.card-meta {
    font-size: 0.75rem;
    text-transform: uppercase;
    color: var(--text-secondary);
    letter-spacing: 0.5px;
    font-weight: 600;
}

.card-main-val {
    font-size: 1.8rem;
    font-weight: 700;
    margin: 8px 0 4px 0;
}

.card-sub-val {
    font-size: 0.8rem;
    color: var(--success-clean);
    font-weight: 500;
}

.filter-card {
    padding: 16px 24px;
    margin-bottom: 24px;
}

.filter-group {
    display: flex;
    align-items: center;
    gap: 12px;
}
.filter-group label { font-size: 0.85rem; font-weight: 600; }

.filter-group select, .input-container input, .input-container select, .modal-box-body textarea {
    background-color: var(--bg-field);
    border: 1px solid var(--border-soft);
    color: var(--text-primary);
    padding: 10px 14px;
    border-radius: var(--radius-premium);
    outline: none;
    font-size: 0.9rem;
    transition: var(--transition-smooth);
}
.filter-group select:focus, .input-container input:focus, .input-container select:focus {
    border-color: var(--neon-blue);
}

.analytics-row-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    margin-bottom: 24px;
}

.intelligence-card .intel-header {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--text-secondary);
}
.intelligence-card .intel-header i { font-size: 1.2rem; color: var(--neon-blue); }
.intelligence-card .intel-header h4 { font-size: 0.9rem; color: var(--text-primary); }
.intelligence-card .intel-header span { font-size: 0.75rem; }

.intel-big-num {
    font-size: 2.2rem;
    font-weight: 800;
    margin: 16px 0 4px 0;
}
.intel-footer-text { font-size: 0.8rem; color: var(--text-secondary); }

.channel-list-wrapper {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 15px;
}
.channel-item {
    display: flex;
    justify-content: space-between;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-soft);
    font-size: 0.85rem;
}
.color-neon { color: var(--neon-blue) !important; font-weight: bold; }

/* Histograma de Perdas */
.ranking-card .ranking-header h4 { font-size: 1rem; margin-bottom: 16px; }
.rk-row { display: flex; align-items: center; gap: 15px; margin-bottom: 12px; font-size: 0.85rem; }
.rk-label { width: 140px; color: var(--text-secondary); }
.rk-bar-bg { flex-grow: 1; height: 8px; background: var(--bg-field); border-radius: 4px; overflow: hidden; }
.rk-bar-fill { height: 100%; background: var(--neon-blue); border-radius: 4px; width: 0%; transition: width 0.4s ease; }
.rk-count { width: 40px; text-align: right; font-weight: 600; }

/* ==========================================
   MODAIS MODÉRNICAS
   ========================================== */
.parhub-modal {
    display: none;
    position: fixed;
    z-index: 1000;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.7);
    backdrop-filter: blur(5px);
    align-items: center;
    justify-content: center;
}

.modal-box {
    background: var(--bg-surface);
    border: 1px solid var(--border-soft);
    padding: 30px;
    border-radius: var(--radius-premium);
    width: 90%; max-width: 480px;
    animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.modal-box.large-box { max-width: 750px; }

@keyframes fadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }

.modal-box-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.modal-close-icon { background: transparent; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer; }
.modal-close-icon:hover { color: var(--text-primary); }

.modal-box-body textarea { width: 100%; height: 130px; resize: none; margin-top: 10px; }
.lead-context-display { font-size: 0.85rem; color: var(--text-secondary); }

.modal-box-footer { display: flex; justify-content: flex-end; gap: 12px; margin-top: 15px; }
.btn-cancel { background: transparent; border: 1px solid var(--border-soft); color: var(--text-primary); padding: 12px 20px; border-radius: var(--radius-premium); cursor: pointer; font-weight: 600; }

/* Grid Interno dos Formúlario */
.parhub-form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; max-height: 60vh; overflow-y: auto; }
.input-container { display: flex; flex-direction: column; gap: 6px; }
.input-container label { font-size: 0.75rem; color: var(--text-secondary); font-weight: 600; }

.btn-action-row { display: flex; gap: 8px; }
.text-muted { color: var(--text-secondary); font-size: 0.85rem; }