// ==========================================================================
// IMPORTAÇÃO DOS MÓDULOS OFICIAIS DO SDK DO FIREBASE (V10+)
// ==========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, updateDoc, deleteDoc, doc,
    onSnapshot, query, orderBy, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// CONFIGURAÇÃO DO FIREBASE (IMUTÁVEL)
const firebaseConfig = {
    apiKey: "AIzaSyAUla_3nMh_eMlELHUsmYxWYaHaYwaaejE",
    authDomain: "dashboard-closer-3f088.firebaseapp.com",
    projectId: "dashboard-closer-3f088",
    storageBucket: "dashboard-closer-3f088.firebasestorage.app",
    messagingSenderId: "366563664458",
    appId: "1:366563664458:web:6e36507e266a720dd1bcb3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const leadsCollection = collection(db, "leads");

// VARIÁVEIS DE SESSÃO GLOBAL
let currentUser = null;
let isAdmin = false;
let isSuperAdmin = false; // só annatoledo + matheusmitt10
let localLeadsCache = [];
let allLeadsCache = []; // todos os leads (para comparativo admin)
let firebaseUnsubscribe = null;
let allLeadsUnsubscribe = null;
let metasUnsubscribe = null;

// Metas salvas — carregadas do Firebase em tempo real
// Estrutura: { metaGeral, supermetaGeral, metas: { "email": { meta, supermeta } } }
let metasConfig = { metaGeral: 0, supermetaGeral: 0, metas: {} };

// Lista de closers conhecidos (usada no modal de metas)
// A Anna pode querer definir meta para closers mesmo antes deles logar
const CLOSERS_CONHECIDOS = [
    { email: "closermatheus@gmail.com", nome: "Matheus" },
];

// CREDENCIAIS DA API GOOGLE CALENDAR
const CLIENT_ID = '258420488272-c2emtfbpljfq51kvrlbna83gunrsvsas.apps.googleusercontent.com'; 
const SCOPES = 'https://www.googleapis.com/auth/calendar.events.readonly';
let tokenClient;

// ==========================================================================
// CENTRAL DE AUTENTICAÇÃO
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    
    const loginBtn = document.getElementById("btn-google-login");
    if (loginBtn) {
        loginBtn.onclick = async () => {
            try {
                await signInWithPopup(auth, provider);
            } catch (err) {
                console.error("Erro no login do Firebase:", err);
                alert("Erro ao fazer login: " + err.message);
            }
        };
        loginBtn.removeAttribute("onclick");
    }

    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn) {
        logoutBtn.onclick = async () => { await signOut(auth); };
    }

    // Trata o retorno do redirect de login
    
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            
            // LIBERAÇÃO DE ADMIN: Agora aceita o seu e-mail de teste também!
            isAdmin = (
                user.email === 'anna@agenciarei.com' || 
                user.email === 'anna.agenciarei@gmail.com' || 
                user.email === 'annatoledo.agenciarei@gmail.com' || 
                user.email === 'matheusmitt10@gmail.com'
            );
            isSuperAdmin = (
                user.email === 'annatoledo.agenciarei@gmail.com' ||
                user.email === 'matheusmitt10@gmail.com'
            );
            
            const nameDisplay = document.getElementById("user-display-name");
            if (nameDisplay) nameDisplay.innerText = user.displayName || user.email;

            // Atualiza foto do Google no avatar
            
            const avatarEl = document.getElementById("user-display-photo");
            const avatarIcon = document.getElementById("user-default-avatar");
            if (avatarEl) {
                if (user.photoURL) {
                    avatarEl.src = user.photoURL;
                    avatarEl.style.display = 'block';
                    if (avatarIcon) avatarIcon.style.display = 'none';
                } else {
                    avatarEl.style.display = "none";
                    if (avatarIcon) avatarIcon.style.display = "block";
                }
            }

            if (document.getElementById("login-screen")) document.getElementById("login-screen").style.display = "none";
            if (document.getElementById("app-layout")) document.getElementById("app-layout").style.display = "block";

            if (isAdmin) {
                if (document.getElementById("admin-closer-filter-wrapper")) document.getElementById("admin-closer-filter-wrapper").style.display = "block";
                if (document.getElementById("btn-export-sheets")) document.getElementById("btn-export-sheets").style.display = "inline-flex";
                if (document.getElementById("btn-definir-metas")) document.getElementById("btn-definir-metas").style.display = "inline-flex";
                if (document.getElementById("insights-panel-title")) {
                    document.getElementById("insights-panel-title").innerHTML = `<i class="fa-solid fa-crown" style="color:var(--warning-clean)"></i> Auditoria Estratégica da Anna`;
                }
            } else {
                if (document.getElementById("admin-closer-filter-wrapper")) document.getElementById("admin-closer-filter-wrapper").style.display = "none";
                if (document.getElementById("btn-export-sheets")) document.getElementById("btn-export-sheets").style.display = "none";
                if (document.getElementById("btn-definir-metas")) document.getElementById("btn-definir-metas").style.display = "none";
            }

            // Liga o listener de metas em tempo real
            initMetasListener();

            // Inicializa a escuta dos leads
            initRealTimeListener();

            // SuperAdmin: listener separado com TODOS os leads para comparativo
            if (isSuperAdmin) {
                initAllLeadsListener();
            } else {
                // Garante que a seção NÃO aparece para closers/outros usuários
                const compSection = document.getElementById("admin-comparativo-section");
                if (compSection) compSection.style.display = "none";
            }
            
            setTimeout(() => {
                try { gisInit(); gapiLoad(); } catch(e) { }
            }, 1500);

        } else {
            currentUser = null;
            isAdmin = false;
            isSuperAdmin = false;
            if (firebaseUnsubscribe) firebaseUnsubscribe();
            if (metasUnsubscribe) metasUnsubscribe();
            if (allLeadsUnsubscribe) allLeadsUnsubscribe();
            if (document.getElementById("app-layout")) document.getElementById("app-layout").style.display = "none";
            if (document.getElementById("login-screen")) document.getElementById("login-screen").style.display = "flex";
        }
    });
    
    const saveNotesBtn = document.getElementById("save-notes-btn");
    if(saveNotesBtn) saveNotesBtn.onclick = saveQuickNotes;
});

// ==========================================================================
// LISTENER DE METAS EM TEMPO REAL (FIREBASE — coleção "metas")
// ==========================================================================
function initMetasListener() {
    if (metasUnsubscribe) metasUnsubscribe();

    // Ouve o documento "config" dentro da coleção "metas"
    const metasDocRef = doc(db, "metas", "config");
    metasUnsubscribe = onSnapshot(metasDocRef, (snap) => {
        if (snap.exists()) {
            metasConfig = snap.data();
        } else {
            // Documento ainda não existe — usa valores zerados
            metasConfig = { metaGeral: 0, supermetaGeral: 0, metas: {} };
        }
        // Atualiza os gráficos/cards sempre que as metas mudarem
        window.calculateAdvancedMetrics();
    }, (err) => {
        console.warn("Erro ao ler metas:", err);
    });
}

// ==========================================================================
// SALVAR METAS (só Anna chama isso)
// ==========================================================================
window.saveMetas = async function() {
    if (!isAdmin) return;

    const metaGeral = parseFloat(document.getElementById("meta-geral-input").value || 0);
    const supermetaGeral = parseFloat(document.getElementById("supermeta-geral-input").value || 0);

    // Lê os campos individuais de cada closer que foram gerados no modal
    const metasIndividuais = {};
    document.querySelectorAll(".meta-closer-row").forEach(row => {
        const email = row.dataset.email;
        const meta = parseFloat(row.querySelector(".input-meta-individual").value || 0);
        const supermeta = parseFloat(row.querySelector(".input-supermeta-individual").value || 0);
        if (email) metasIndividuais[email] = { meta, supermeta };
    });

    const payload = {
        metaGeral,
        supermetaGeral,
        metas: metasIndividuais
    };

    try {
        await setDoc(doc(db, "metas", "config"), payload);
        window.closeMetasModal();
        alert("Metas salvas com sucesso!");
    } catch (err) {
        console.error("Erro ao salvar metas:", err);
        alert("Erro ao salvar. Tente novamente.");
    }
};

// Abre o modal de metas e preenche os campos com os valores atuais
window.openMetasModal = function() {
    if (!isAdmin) return;

    // Preenche campos gerais
    const mg = document.getElementById("meta-geral-input");
    const smg = document.getElementById("supermeta-geral-input");
    if (mg) mg.value = metasConfig.metaGeral || "";
    if (smg) smg.value = metasConfig.supermetaGeral || "";

    // Descobre quais closers existem nos leads (para não depender só da lista fixa)
    const closersNosLeads = [];
    const emailsVistos = new Set();
    localLeadsCache.forEach(l => {
        if (l.closerEmail && !emailsVistos.has(l.closerEmail)) {
            emailsVistos.add(l.closerEmail);
            closersNosLeads.push({ email: l.closerEmail, nome: l.closerName || l.closerEmail });
        }
    });
    // Junta com os closers conhecidos sem duplicar
    CLOSERS_CONHECIDOS.forEach(c => {
        if (!emailsVistos.has(c.email)) {
            emailsVistos.add(c.email);
            closersNosLeads.push(c);
        }
    });

    // Gera os campos individuais no modal
    const container = document.getElementById("metas-por-closer-container");
    container.innerHTML = `<p style="margin:0 0 8px; font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Metas Individuais por Closer</p>`;
    
    closersNosLeads.forEach(closer => {
        const metaAtual = metasConfig.metas?.[closer.email]?.meta || "";
        const superAtual = metasConfig.metas?.[closer.email]?.supermeta || "";
        const row = document.createElement("div");
        row.className = "meta-closer-row";
        row.dataset.email = closer.email;
        row.style.cssText = "margin-bottom:10px;";
        row.innerHTML = `
            <p style="margin:0 0 4px; font-size:10px; color:var(--text-primary); font-weight:700;">
                <i class="fa-solid fa-user-tie" style="color:var(--purple-accent); margin-right:4px;"></i>${closer.nome}
                <span style="color:var(--text-muted); font-weight:400; font-size:9px;">${closer.email}</span>
            </p>
            <div class="form-row-grid" style="margin-bottom:0;">
                <div class="input-container">
                    <label>Meta (R$)</label>
                    <input type="number" class="input-meta-individual" value="${metaAtual}" placeholder="0" step="100">
                </div>
                <div class="input-container">
                    <label>Supermeta (R$)</label>
                    <input type="number" class="input-supermeta-individual" value="${superAtual}" placeholder="0" step="100">
                </div>
            </div>
        `;
        container.appendChild(row);
    });

    document.getElementById("metas-modal").style.display = "flex";
};

window.closeMetasModal = function() {
    document.getElementById("metas-modal").style.display = "none";
};

// ==========================================================================
// FILTRAGEM E ESCUTA EM TEMPO REAL (FIREBASE — leads)
// ==========================================================================
window.triggerRealTimeRefresh = function() { initRealTimeListener(); };

function initRealTimeListener() {
    if (firebaseUnsubscribe) firebaseUnsubscribe();

    const q = query(leadsCollection, orderBy("dataReuniao", "desc"));
    const selectedFilter = document.getElementById("filter-closer-select")?.value || "meus";

    firebaseUnsubscribe = onSnapshot(q, (snapshot) => {
        localLeadsCache = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (isAdmin && selectedFilter === "todos") {
                localLeadsCache.push({ id: doc.id, ...data });
            } else {
                if (data.closerEmail === currentUser.email) {
                    localLeadsCache.push({ id: doc.id, ...data });
                }
            }
        });
        
        renderLeadsTable();
        window.populateSdrFilterOptions();
        window.calculateAdvancedMetrics();
    }, (error) => console.error("Erro Firebase Snapshot: ", error));
}

// ==========================================================================
// RENDERIZAÇÃO DA MESA DE OPERAÇÕES
// ==========================================================================
function renderLeadsTable() {
    const container = document.getElementById("leads-container");
    const totalCounter = document.getElementById("table-total-count");
    if (!container) return;
    if (totalCounter) totalCounter.innerText = `${localLeadsCache.length} Lead${localLeadsCache.length !== 1 ? 's' : ''}`;

    if (localLeadsCache.length === 0) {
        container.innerHTML = `<tr><td colspan="9" class="text-muted" style="text-align: center; padding: 20px;">Nenhum lead sob sua gestão ativa no momento.</td></tr>`;
        return;
    }

    container.innerHTML = "";

    localLeadsCache.forEach((lead) => {
        const tr = document.createElement("tr");
        let dataFormatada = "Não definida";
        if (lead.dataReuniao) {
            const d = new Date(lead.dataReuniao);
            dataFormatada = d.toLocaleDateString('pt-BR') + " " + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        }

        const valorContrato = parseFloat(lead.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const badgeOrigem = lead.origem === "I.A Yara" ? "p-badge-blue" : "p-badge-info";
        
        let badgeDesfecho = "p-badge-warning";
        if (lead.desfecho === "Fechado") badgeDesfecho = "p-badge-success";
        if (lead.desfecho === "Downsell") badgeDesfecho = "p-badge-blue";
        if (lead.desfecho === "Perdido") badgeDesfecho = "p-badge-danger";

        const badgeDecisor = lead.decisor === "Sim" ? "p-badge-success" : "p-badge-danger";
        
        let badgeDiag = "p-badge-warning";
        if (lead.statusDiag === "Aprovado para Pitch") badgeDiag = "p-badge-success";
        if (lead.statusDiag?.includes("Reprovado") || lead.statusDiag?.includes("Qualificado")) badgeDiag = "p-badge-danger";
        if (lead.statusDiag === "No-Show") badgeDiag = "p-badge-danger";

        tr.innerHTML = `
            <td onclick="window.editLead('${lead.id}')" style="cursor: pointer;" title="Clique para abrir edição">
                <span class="lead-main-name">${lead.nome}</span>
                <span class="lead-co-name">${lead.empresa || 'Sem Empresa'}</span>
            </td>
            <td data-label="Faturamento" style="font-weight: 600;">${lead.faturamento || '—'}</td>
            <td data-label="SDR / Origem"><span style="font-weight: 600;">${lead.sdr || 'Direto'}</span> <span class="p-badge ${badgeOrigem}">${lead.origem}</span></td>
            <td data-label="Data Reunião">${dataFormatada}</td>
            <td data-label="Qualificação"><span class="p-badge ${badgeDecisor}">Decisor: ${lead.decisor || 'Não'}</span></td>
            <td data-label="Diagnóstico"><span class="p-badge ${badgeDiag}">${lead.statusDiag || 'Aprovado'}</span></td>
            <td data-label="Desfecho"><span class="p-badge ${badgeDesfecho}">${lead.desfecho}</span> <span style="font-weight:600;color:var(--neon-accent);">${valorContrato}</span></td>
            <td data-label="Closer" style="font-weight: 500; color:var(--text-muted);">${lead.closerName ? lead.closerName.split(' ')[0] : '—'}</td>
            <td data-label="Ações">
                <div class="btn-action-row">
                    <button class="btn-sm-note" onclick="event.stopPropagation(); window.openNotesModal('${lead.id}')"><i class="fa-solid fa-comment-dots"></i> Notas</button>
                    <button class="btn-action edit" onclick="event.stopPropagation(); window.editLead('${lead.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="btn-action delete" onclick="event.stopPropagation(); window.deleteLead('${lead.id}')"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </td>
        `;
        container.appendChild(tr);
    });
}

// ==========================================================================
// CONTROLE DOS MODAIS OPERACIONAIS (mantido igual ao original)
// ==========================================================================
window.openNewLeadModal = function() {
    const form = document.getElementById("lead-form");
    if(form) form.reset();
    document.getElementById("form-lead-id").value = "";
    document.getElementById("form-modal-title").innerHTML = `<i class="fa-solid fa-user-plus"></i> Inserir Lead na Mesa`;
    document.getElementById("loss-reason-group").style.display = "none";
    document.getElementById("lead-form-modal").style.display = "flex";
};

window.closeLeadModal = function() { document.getElementById("lead-form-modal").style.display = "none"; };

window.handleStatusDiagChange = function() {
    const currentDiag = document.getElementById("form-status-diag").value;
    const pitchSelect = document.getElementById("form-pitch");
    const desfechoSelect = document.getElementById("form-desfecho");

    if (currentDiag !== "Aprovado para Pitch") {
        pitchSelect.value = "Não";
        if (currentDiag === "No-Show") desfechoSelect.value = "Em Aberto";
        else desfechoSelect.value = "Perdido";
        window.toggleLossReasonField();
    } else {
        pitchSelect.value = "Sim";
    }
};

window.toggleLossReasonField = function() {
    const desfechoValue = document.getElementById("form-desfecho").value;
    const lossGroup = document.getElementById("loss-reason-group");
    if(lossGroup) {
        if(desfechoValue === "Perdido") lossGroup.style.display = "flex";
        else { lossGroup.style.display = "none"; document.getElementById("form-motivo-perda").value = ""; }
    }
};

window.handleLeadFormSubmit = async function(e) {
    if(e) e.preventDefault();
    const id = document.getElementById("form-lead-id").value;
    
    const leadData = {
        nome: document.getElementById("form-nome").value,
        empresa: document.getElementById("form-empresa").value,
        faturamento: document.getElementById("form-faturamento").value,
        sdr: document.getElementById("form-sdr").value.trim(),
        dataReuniao: document.getElementById("form-data-reuniao").value,
        origem: document.getElementById("form-origem").value,
        decisor: document.getElementById("form-decisor").value,
        statusDiag: document.getElementById("form-status-diag").value,
        pitch: document.getElementById("form-pitch").value,
        reagendado: document.getElementById("form-reagendado").value,
        desfecho: document.getElementById("form-desfecho").value,
        valor: parseFloat(document.getElementById("form-valor").value || 0),
        dataPagamento: document.getElementById("form-data-pagamento").value,
        motivoPerda: document.getElementById("form-motivo-perda").value,
        closerEmail: id ? (localLeadsCache.find(l => l.id === id)?.closerEmail || currentUser.email) : currentUser.email,
        closerName: id ? (localLeadsCache.find(l => l.id === id)?.closerName || currentUser.displayName) : currentUser.displayName,
        observacoes: id ? (localLeadsCache.find(l => l.id === id)?.observacoes || "") : ""
    };

    try {
        if (id) await updateDoc(doc(db, "leads", id), leadData);
        else await addDoc(leadsCollection, leadData);
        window.closeLeadModal();
    } catch (err) { console.error(err); alert("Erro ao salvar no banco."); }
};

window.editLead = function(id) {
    const lead = localLeadsCache.find(l => l.id === id);
    if (!lead) return;

    document.getElementById("form-lead-id").value = lead.id;
    document.getElementById("form-nome").value = lead.nome || "";
    document.getElementById("form-empresa").value = lead.empresa || "";
    document.getElementById("form-faturamento").value = lead.faturamento || "";
    document.getElementById("form-sdr").value = lead.sdr || "";
    document.getElementById("form-data-reuniao").value = lead.dataReuniao || "";
    document.getElementById("form-origem").value = lead.origem || "CRM";
    document.getElementById("form-decisor").value = lead.decisor || "Sim";
    document.getElementById("form-status-diag").value = lead.statusDiag || "Aprovado para Pitch";
    document.getElementById("form-pitch").value = lead.pitch || "Sim";
    document.getElementById("form-reagendado").value = lead.reagendado || "Não";
    document.getElementById("form-desfecho").value = lead.desfecho || "Em Aberto";
    document.getElementById("form-valor").value = lead.valor || 0;
    document.getElementById("form-data-pagamento").value = lead.dataPagamento || "";
    document.getElementById("form-motivo-perda").value = lead.motivoPerda || "";

    document.getElementById("form-modal-title").innerHTML = `<i class="fa-solid fa-sliders"></i> Atualizar Dados da Linha`;
    window.toggleLossReasonField();
    document.getElementById("lead-form-modal").style.display = "flex";
};

window.deleteLead = async function(id) {
    if (confirm("Deseja remover permanentemente esse lead do banco?")) {
        await deleteDoc(doc(db, "leads", id));
    }
};

let currentActiveNotesLeadId = null;
window.openNotesModal = function(id) {
    const lead = localLeadsCache.find(l => l.id === id);
    if (!lead) return;
    currentActiveNotesLeadId = id;
    document.getElementById("modal-lead-name").innerText = lead.nome;
    document.getElementById("lead-notes-area").value = lead.observacoes || "";

    const helperBox = document.getElementById("objection-helper-box");
    const helperText = document.getElementById("objection-helper-text");

    if (lead.desfecho === "Perdido" && lead.motivoPerda) {
        helperBox.style.display = "flex";
        if (lead.motivoPerda === "Sem Caixa") {
            helperText.innerText = '"Entendo perfeitamente, fulano. Mas me diga, é uma questão de não ter o valor disponível agora ou de não ter visto valor suficiente no retorno para o seu negócio? Se o caixa não fosse o problema, você começaria hoje?"';
        } else if (lead.motivoPerda === "Pensar / Sumiu") {
            helperText.innerText = '"Geralmente quando o cliente quer pensar, é porque ficou alguma dúvida ou faltou segurança em algum ponto. O que exatamente nós precisamos alinhar mais para você tomar essa decisão com 100% de convicção?"';
        } else {
            helperText.innerText = 'Revise as dores latentes mapeadas no diagnóstico do lead. Rememore o custo de ele continuar com o problema ativo antes de fechar a call.';
        }
    } else {
        helperBox.style.display = "none";
    }

    document.getElementById("notes-modal").style.display = "flex";
};

window.closeNotesModal = function() { document.getElementById("notes-modal").style.display = "none"; };
async function saveQuickNotes() {
    if (!currentActiveNotesLeadId) return;
    const txt = document.getElementById("lead-notes-area").value;
    await updateDoc(doc(db, "leads", currentActiveNotesLeadId), { observacoes: txt });
    window.closeNotesModal();
}

// ==========================================================================
// FILTRO DE SDR
// ==========================================================================
window.populateSdrFilterOptions = function() {
    const select = document.getElementById("filter-sdr-select");
    if (!select) return;
    const currentValue = select.value;
    const sdrs = [...new Set(localLeadsCache.map(l => l.sdr).filter(n => n && n.trim() !== ""))];
    select.innerHTML = `<option value="todos">Todos os SDRs (Visão Geral)</option>`;
    sdrs.forEach(sdr => select.innerHTML += `<option value="${sdr}">${sdr}</option>`);
    if (currentValue && sdrs.includes(currentValue)) select.value = currentValue;
};

// ==========================================================================
// CÁLCULO CENTRAL DE MÉTRICAS — coração do sistema
// ==========================================================================
window.calculateAdvancedMetrics = function() {
    const selectedSdr = document.getElementById("filter-sdr-select")?.value || "todos";
    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const inicioSemana = new Date(agora); inicioSemana.setDate(agora.getDate() - agora.getDay()); inicioSemana.setHours(0,0,0,0);
    const inicioQuinzena = new Date(agora); inicioQuinzena.setDate(agora.getDate() - 15); inicioQuinzena.setHours(0,0,0,0);

    // ── Contadores globais ──
    let faturamentoMes = 0, totalLeadsMes = 0, fechadosMes = 0;
    let totalPitches = 0, fechadosPops = 0, totalDecisoresValidados = 0, totalLeadsComDiag = 0;
    let yaraTotal = 0, yaraFechados = 0, crmTotal = 0, crmFechados = 0;
    let funnelTotal = 0, funnelNoShow = 0, funnelQualificados = 0, funnelReprovados = 0;
    const contagemObjecoes = { "Sem Caixa": 0, "Sem Decisor": 0, "Não tem o Perfil": 0, "Pensar / Sumiu": 0, "Outro": 0 };

    // ── Contadores por closer ──
    // { email: { nome, fat, total, fechados, pitches, fechadosPitch } }
    const closerStats = {};

    // ── Contadores por SDR (para os cards Ingrid/Bruno) ──
    // { nome: { agendadas, qualificados, aprovadosPitch, fechados, fat } }
    const sdrStats = {};

    localLeadsCache.forEach(lead => {
        if (!lead.dataReuniao) return;
        const dataReuniao = new Date(lead.dataReuniao);
        const valor = parseFloat(lead.valor || 0);
        const isFechado = lead.desfecho === "Fechado" || lead.desfecho === "Downsell";
        const passouFiltroSdr = (selectedSdr === "todos" || lead.sdr === selectedSdr);

        // ── Faturamento do mês (todos os closers / sem filtro SDR) ──
        if (dataReuniao >= inicioMes) {
            totalLeadsMes++;
            if (isFechado) { faturamentoMes += valor; fechadosMes++; }
        }

        // ── Stats por closer (mês corrente) ──
        if (dataReuniao >= inicioMes && lead.closerEmail) {
            if (!closerStats[lead.closerEmail]) {
                closerStats[lead.closerEmail] = {
                    nome: lead.closerName || lead.closerEmail,
                    fat: 0, total: 0, fechados: 0, pitches: 0, fechadosPitch: 0
                };
            }
            const cs = closerStats[lead.closerEmail];
            cs.total++;
            if (isFechado) { cs.fat += valor; cs.fechados++; }
            if (lead.pitch === "Sim") { cs.pitches++; if (isFechado) cs.fechadosPitch++; }
        }

        // ── Stats por SDR (mês corrente, sem filtro) ──
        if (dataReuniao >= inicioMes && lead.sdr && lead.sdr.trim()) {
            const sdrNome = lead.sdr.trim();
            if (!sdrStats[sdrNome]) {
                sdrStats[sdrNome] = { agendadas: 0, qualificados: 0, aprovadosPitch: 0, fechados: 0, fat: 0 };
            }
            const ss = sdrStats[sdrNome];
            ss.agendadas++;
            if (lead.statusDiag !== "No-Show") ss.qualificados++;
            if (lead.statusDiag === "Aprovado para Pitch") ss.aprovadosPitch++;
            if (isFechado) { ss.fechados++; ss.fat += valor; }
        }

        // ── Métricas gerais (com filtro SDR) ──
        if (passouFiltroSdr) {
            funnelTotal++;
            if (lead.statusDiag === "No-Show") funnelNoShow++;
            else if (lead.statusDiag === "Aprovado para Pitch") funnelQualificados++;
            else if (lead.statusDiag?.includes("Reprovado") || lead.statusDiag?.includes("Qualificado")) funnelReprovados++;

            if (lead.pitch === "Sim") { totalPitches++; if (isFechado) fechadosPops++; }
            if (lead.decisor) { totalLeadsComDiag++; if (lead.decisor === "Sim") totalDecisoresValidados++; }

            if (lead.origem === "I.A Yara") { yaraTotal++; if (isFechado) yaraFechados++; }
            else if (lead.origem === "CRM") { crmTotal++; if (isFechado) crmFechados++; }

            if (lead.desfecho === "Perdido" && lead.motivoPerda && contagemObjecoes[lead.motivoPerda] !== undefined)
                contagemObjecoes[lead.motivoPerda]++;
        }
    });

    // ── Atualiza métricas simples (funil, pitch, decisor, origem) ──
    if (document.getElementById("sdr-pitch-rate")) document.getElementById("sdr-pitch-rate").innerText = `${totalPitches > 0 ? Math.round((fechadosPops / totalPitches) * 100) : 0}%`;
    if (document.getElementById("sdr-pitch-details")) document.getElementById("sdr-pitch-details").innerText = `${fechadosPops} Fechados / ${totalPitches} Pitches`;
    if (document.getElementById("sdr-decisor-rate")) document.getElementById("sdr-decisor-rate").innerText = `${totalLeadsComDiag > 0 ? Math.round((totalDecisoresValidados / totalLeadsComDiag) * 100) : 0}%`;
    if (document.getElementById("sdr-decisor-details")) document.getElementById("sdr-decisor-details").innerText = `${totalDecisoresValidados} Presentes / ${totalLeadsComDiag} Reuniões`;
    if (document.getElementById("funnel-total")) document.getElementById("funnel-total").innerText = funnelTotal;
    if (document.getElementById("funnel-noshow")) document.getElementById("funnel-noshow").innerText = funnelNoShow;
    if (document.getElementById("funnel-qualificados")) document.getElementById("funnel-qualificados").innerText = funnelQualificados;
    if (document.getElementById("funnel-reprovados")) document.getElementById("funnel-reprovados").innerText = funnelReprovados;
    if (document.getElementById("channel-yara-rate")) document.getElementById("channel-yara-rate").innerText = `${yaraTotal > 0 ? Math.round((yaraFechados / yaraTotal) * 100) : 0}%`;
    if (document.getElementById("channel-crm-rate")) document.getElementById("channel-crm-rate").innerText = `${crmTotal > 0 ? Math.round((crmFechados / crmTotal) * 100) : 0}%`;

    // ── Renderiza os blocos novos ──
    renderBillingBlock(faturamentoMes, totalLeadsMes, fechadosMes, closerStats);
    renderConversionBlock(fechadosMes, totalLeadsMes, closerStats);
    renderSdrCards(sdrStats);
    renderCloserCards(closerStats);
    renderLossHistogram(contagemObjecoes);
    if (isSuperAdmin) renderComparativoFull();

    // ── Gráficos (mantidos) ──
    if (typeof window.renderAllCharts === 'function') window.renderAllCharts();
};

// ==========================================================================
// BLOCO 1 — FATURAMENTO DO MÊS COM BARRA DE PROGRESSO
// ==========================================================================
function renderBillingBlock(fatMes, totalLeads, fechados, closerStats) {
    const container = document.getElementById("billing-month-block");
    if (!container) return;

    const metaGeral = metasConfig.metaGeral || 0;
    const supermetaGeral = metasConfig.supermetaGeral || 0;

    // Função auxiliar que desenha uma barra de progresso
    function progressBar(atual, meta, corBarra, label) {
        if (!meta || meta <= 0) return "";
        const pct = Math.min(Math.round((atual / meta) * 100), 100);
        const fmtMeta = meta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
        return `
            <div style="margin-top:6px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <span style="font-size:9px;color:var(--text-muted);font-weight:700;">${label} — ${fmtMeta}</span>
                    <span style="font-size:9px;font-weight:800;color:${corBarra};">${pct}%</span>
                </div>
                <div style="background:rgba(255,255,255,0.04);border-radius:4px;height:7px;overflow:hidden;">
                    <div style="width:${pct}%;height:100%;background:${corBarra};border-radius:4px;transition:width 0.5s ease;"></div>
                </div>
            </div>
        `;
    }

    const fatFmt = fatMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const convPct = totalLeads > 0 ? Math.round((fechados / totalLeads) * 100) : 0;

    // Card principal — faturamento geral do mês
    let html = `
        <div class="parhub-card" style="padding:16px; border-top:2px solid var(--neon-accent);">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
                <div>
                    <div style="font-size:10px;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:4px;">
                        <i class="fa-solid fa-calendar-check" style="color:var(--neon-accent);margin-right:4px;"></i>
                        Faturamento do Mês Atual
                    </div>
                    <h2 style="margin:0;font-size:28px;font-weight:800;color:var(--neon-accent);">${fatFmt}</h2>
                    <span style="font-size:10px;color:var(--text-muted);">${fechados} contratos fechados · ${convPct}% de conversão</span>
                    ${progressBar(fatMes, metaGeral, '#00F2FE', 'Meta')}
                    ${progressBar(fatMes, supermetaGeral, '#7C3AED', 'Supermeta')}
                </div>
    `;

    // Anna vê o breakdown por closer dentro do mesmo card
    if (isAdmin && Object.keys(closerStats).length > 0) {
        html += `<div style="display:flex;flex-wrap:wrap;gap:8px;">`;
        Object.entries(closerStats).forEach(([email, cs]) => {
            const metaInd = metasConfig.metas?.[email]?.meta || 0;
            const supermetaInd = metasConfig.metas?.[email]?.supermeta || 0;
            const pctMeta = metaInd > 0 ? Math.min(Math.round((cs.fat / metaInd) * 100), 100) : null;
            const fatIndFmt = cs.fat.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const primeiroNome = cs.nome.split(' ')[0];
            html += `
                <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border-color);border-radius:8px;padding:10px 12px;min-width:150px;">
                    <div style="font-size:10px;color:var(--text-muted);font-weight:700;">${primeiroNome}</div>
                    <div style="font-size:15px;font-weight:800;color:var(--text-primary);margin:2px 0;">${fatIndFmt}</div>
                    <div style="font-size:9px;color:var(--text-muted);">${cs.fechados} fechados</div>
                    ${pctMeta !== null ? `
                        <div style="margin-top:5px;">
                            <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
                                <span style="font-size:8px;color:var(--text-muted);">Meta</span>
                                <span style="font-size:8px;font-weight:800;color:var(--neon-accent);">${pctMeta}%</span>
                            </div>
                            <div style="background:rgba(255,255,255,0.04);border-radius:3px;height:4px;overflow:hidden;">
                                <div style="width:${pctMeta}%;height:100%;background:var(--neon-accent);border-radius:3px;"></div>
                            </div>
                        </div>
                    ` : '<div style="font-size:8px;color:var(--text-muted);margin-top:4px;">Meta não definida</div>'}
                </div>
            `;
        });
        html += `</div>`;
    } else if (!isAdmin) {
        // Closer vê só o próprio progresso
        const meuEmail = currentUser?.email;
        const meusStats = closerStats[meuEmail];
        if (meusStats) {
            const metaInd = metasConfig.metas?.[meuEmail]?.meta || 0;
            const supermetaInd = metasConfig.metas?.[meuEmail]?.supermeta || 0;
            html += `
                <div>
                    <div style="font-size:10px;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:4px;">Meu Progresso</div>
                    <div style="font-size:20px;font-weight:800;color:var(--purple-accent);">
                        ${meusStats.fat.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                    <div style="font-size:9px;color:var(--text-muted);">${meusStats.fechados} contratos fechados</div>
                    ${progressBar(meusStats.fat, metaInd, '#00F2FE', 'Minha Meta')}
                    ${progressBar(meusStats.fat, supermetaInd, '#7C3AED', 'Minha Supermeta')}
                </div>
            `;
        }
    }

    html += `</div></div>`;
    container.innerHTML = html;
}

// ==========================================================================
// BLOCO 2 — TAXA DE CONVERSÃO GERAL + POR CLOSER
// ==========================================================================
function renderConversionBlock(fechados, total, closerStats) {
    // Número grande (geral)
    const pct = total > 0 ? Math.round((fechados / total) * 100) : 0;
    if (document.getElementById("conv-geral-numero")) document.getElementById("conv-geral-numero").innerText = `${pct}%`;
    if (document.getElementById("conv-geral-detalhe")) document.getElementById("conv-geral-detalhe").innerText = `${fechados} fechados / ${total} reuniões no mês`;

    // Lista por closer
    const lista = document.getElementById("conv-por-closer-lista");
    if (!lista) return;
    lista.innerHTML = "";

    // Anna vê todos; closer vê só o próprio
    const entries = isAdmin
        ? Object.entries(closerStats)
        : Object.entries(closerStats).filter(([email]) => email === currentUser?.email);

    if (entries.length === 0) {
        lista.innerHTML = `<p style="font-size:10px;color:var(--text-muted);">Sem dados no mês.</p>`;
        return;
    }

    entries.forEach(([email, cs]) => {
        const conv = cs.total > 0 ? Math.round((cs.fechados / cs.total) * 100) : 0;
        const primeiroNome = cs.nome.split(' ')[0];
        const cor = conv >= 30 ? 'var(--success-clean)' : conv >= 15 ? 'var(--warning-clean)' : 'var(--danger-clean)';
        const div = document.createElement("div");
        div.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:4px 8px;background:rgba(255,255,255,0.01);border:1px solid var(--border-color);border-radius:5px;font-size:10px;";
        div.innerHTML = `
            <span style="font-weight:700;">${primeiroNome}</span>
            <span style="font-weight:800;color:${cor};">${conv}%</span>
            <span style="color:var(--text-muted);">${cs.fechados}/${cs.total}</span>
        `;
        lista.appendChild(div);
    });
}

// ==========================================================================
// BLOCO 3 — CARDS DE SDR (Ingrid, Bruno, etc.)
// ==========================================================================
function renderSdrCards(sdrStats) {
    const container = document.getElementById("sdr-cards-container");
    if (!container) return;
    container.innerHTML = "";

    if (Object.keys(sdrStats).length === 0) {
        container.innerHTML = `<p style="font-size:11px;color:var(--text-muted);">Nenhum dado de SDR no mês.</p>`;
        return;
    }

    Object.entries(sdrStats).forEach(([nome, ss]) => {
        const conv = ss.agendadas > 0 ? Math.round((ss.fechados / ss.agendadas) * 100) : 0;
        const fatFmt = ss.fat.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const card = document.createElement("div");
        card.className = "parhub-card";
        card.style.cssText = "padding:14px;border-top:2px solid var(--warning-clean);";
        card.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;border-bottom:1px solid var(--border-color);padding-bottom:8px;">
                <div style="width:30px;height:30px;border-radius:50%;background:rgba(245,158,11,0.15);display:flex;align-items:center;justify-content:center;">
                    <i class="fa-solid fa-user-headset" style="color:var(--warning-clean);font-size:12px;"></i>
                </div>
                <div>
                    <h4 style="margin:0;font-size:13px;font-weight:800;">${nome}</h4>
                    <span style="font-size:9px;color:var(--text-muted);">SDR · Mês Atual</span>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <div style="text-align:center;padding:6px;background:rgba(255,255,255,0.02);border-radius:6px;">
                    <div style="font-size:9px;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Agendadas</div>
                    <div style="font-size:20px;font-weight:800;color:var(--text-primary);">${ss.agendadas}</div>
                </div>
                <div style="text-align:center;padding:6px;background:rgba(255,255,255,0.02);border-radius:6px;">
                    <div style="font-size:9px;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Qualificados</div>
                    <div style="font-size:20px;font-weight:800;color:var(--blue-accent);">${ss.qualificados}</div>
                </div>
                <div style="text-align:center;padding:6px;background:rgba(255,255,255,0.02);border-radius:6px;">
                    <div style="font-size:9px;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Aprovados Pitch</div>
                    <div style="font-size:20px;font-weight:800;color:var(--success-clean);">${ss.aprovadosPitch}</div>
                </div>
                <div style="text-align:center;padding:6px;background:rgba(255,255,255,0.02);border-radius:6px;">
                    <div style="font-size:9px;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Fechados</div>
                    <div style="font-size:20px;font-weight:800;color:var(--neon-accent);">${ss.fechados}</div>
                </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:8px;border-top:1px solid var(--border-color);">
                <div>
                    <span style="font-size:9px;color:var(--text-muted);font-weight:700;">CONV. GERAL</span>
                    <span style="font-size:14px;font-weight:800;margin-left:6px;color:${conv >= 20 ? 'var(--success-clean)' : conv >= 10 ? 'var(--warning-clean)' : 'var(--danger-clean)'};">${conv}%</span>
                </div>
                <div style="text-align:right;">
                    <span style="font-size:9px;color:var(--text-muted);font-weight:700;">RECEITA GERADA</span>
                    <div style="font-size:13px;font-weight:800;color:var(--neon-accent);">${fatFmt}</div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// ==========================================================================
// BLOCO 4 — CARDS DE PERFORMANCE POR CLOSER
// ==========================================================================
function renderCloserCards(closerStats) {
    const container = document.getElementById("closer-cards-container");
    if (!container) return;
    container.innerHTML = "";

    // Filtra: closer vê só si mesmo; Anna vê todos
    const entries = isAdmin
        ? Object.entries(closerStats)
        : Object.entries(closerStats).filter(([email]) => email === currentUser?.email);

    if (entries.length === 0) {
        container.innerHTML = `<p style="font-size:11px;color:var(--text-muted);">Nenhum dado de closer no mês.</p>`;
        return;
    }

    // Se Anna, adiciona card consolidado geral primeiro
    if (isAdmin && entries.length > 1) {
        const totalFat = entries.reduce((acc, [, cs]) => acc + cs.fat, 0);
        const totalFech = entries.reduce((acc, [, cs]) => acc + cs.fechados, 0);
        const totalReu = entries.reduce((acc, [, cs]) => acc + cs.total, 0);
        const convGeral = totalReu > 0 ? Math.round((totalFech / totalReu) * 100) : 0;
        const card = document.createElement("div");
        card.className = "parhub-card";
        card.style.cssText = "padding:14px;border-top:2px solid var(--neon-accent);grid-column:1/-1;";
        card.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                <i class="fa-solid fa-users-rectangle" style="color:var(--neon-accent);font-size:16px;"></i>
                <h4 style="margin:0;font-size:13px;font-weight:800;">Consolidado Geral — Todos os Closers</h4>
            </div>
            <div style="display:flex;gap:20px;flex-wrap:wrap;">
                <div><div style="font-size:9px;color:var(--text-muted);font-weight:700;">FATURAMENTO</div><div style="font-size:22px;font-weight:800;color:var(--neon-accent);">${totalFat.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div></div>
                <div><div style="font-size:9px;color:var(--text-muted);font-weight:700;">FECHADOS</div><div style="font-size:22px;font-weight:800;">${totalFech}</div></div>
                <div><div style="font-size:9px;color:var(--text-muted);font-weight:700;">REUNIÕES</div><div style="font-size:22px;font-weight:800;">${totalReu}</div></div>
                <div><div style="font-size:9px;color:var(--text-muted);font-weight:700;">CONVERSÃO</div><div style="font-size:22px;font-weight:800;color:var(--success-clean);">${convGeral}%</div></div>
            </div>
        `;
        container.appendChild(card);
    }

    entries.forEach(([email, cs]) => {
        const metaInd = metasConfig.metas?.[email]?.meta || 0;
        const supermetaInd = metasConfig.metas?.[email]?.supermeta || 0;
        const conv = cs.total > 0 ? Math.round((cs.fechados / cs.total) * 100) : 0;
        const pctMeta = metaInd > 0 ? Math.min(Math.round((cs.fat / metaInd) * 100), 100) : null;
        const pctSuper = supermetaInd > 0 ? Math.min(Math.round((cs.fat / supermetaInd) * 100), 100) : null;
        const fatFmt = cs.fat.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const primeiroNome = cs.nome.split(' ')[0];

        const card = document.createElement("div");
        card.className = "parhub-card";
        card.style.cssText = "padding:14px;border-top:2px solid var(--purple-accent);";
        card.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;border-bottom:1px solid var(--border-color);padding-bottom:8px;">
                <div style="width:30px;height:30px;border-radius:50%;background:rgba(124,58,237,0.15);display:flex;align-items:center;justify-content:center;">
                    <i class="fa-solid fa-user-tie" style="color:var(--purple-accent);font-size:12px;"></i>
                </div>
                <div>
                    <h4 style="margin:0;font-size:13px;font-weight:800;">${primeiroNome}</h4>
                    <span style="font-size:9px;color:var(--text-muted);">Closer · Mês Atual</span>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
                <div style="text-align:center;padding:6px;background:rgba(255,255,255,0.02);border-radius:6px;">
                    <div style="font-size:9px;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Reuniões</div>
                    <div style="font-size:20px;font-weight:800;">${cs.total}</div>
                </div>
                <div style="text-align:center;padding:6px;background:rgba(255,255,255,0.02);border-radius:6px;">
                    <div style="font-size:9px;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Fechados</div>
                    <div style="font-size:20px;font-weight:800;color:var(--success-clean);">${cs.fechados}</div>
                </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-top:1px solid var(--border-color);">
                <div>
                    <span style="font-size:9px;color:var(--text-muted);font-weight:700;">CONVERSÃO</span>
                    <span style="font-size:16px;font-weight:800;margin-left:6px;color:${conv>=30?'var(--success-clean)':conv>=15?'var(--warning-clean)':'var(--danger-clean)'};">${conv}%</span>
                </div>
                <div style="text-align:right;">
                    <span style="font-size:9px;color:var(--text-muted);font-weight:700;">FATURADO</span>
                    <div style="font-size:13px;font-weight:800;color:var(--neon-accent);">${fatFmt}</div>
                </div>
            </div>
            ${pctMeta !== null ? `
                <div style="margin-top:8px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                        <span style="font-size:9px;color:var(--text-muted);font-weight:700;">META</span>
                        <span style="font-size:9px;font-weight:800;color:var(--neon-accent);">${pctMeta}%</span>
                    </div>
                    <div style="background:rgba(255,255,255,0.04);border-radius:4px;height:6px;overflow:hidden;">
                        <div style="width:${pctMeta}%;height:100%;background:var(--neon-accent);border-radius:4px;"></div>
                    </div>
                </div>
            ` : ''}
            ${pctSuper !== null ? `
                <div style="margin-top:5px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                        <span style="font-size:9px;color:var(--text-muted);font-weight:700;">SUPERMETA</span>
                        <span style="font-size:9px;font-weight:800;color:var(--purple-accent);">${pctSuper}%</span>
                    </div>
                    <div style="background:rgba(255,255,255,0.04);border-radius:4px;height:6px;overflow:hidden;">
                        <div style="width:${pctSuper}%;height:100%;background:var(--purple-accent);border-radius:4px;"></div>
                    </div>
                </div>
            ` : ''}
        `;
        container.appendChild(card);
    });
}


// ==========================================================================
// BLOCO 5 — COMPARATIVO ADMIN: SDRs vs SDRs + Closers vs Closers
// ==========================================================================
function initAllLeadsListener() {
    if (allLeadsUnsubscribe) allLeadsUnsubscribe();
    const q = query(leadsCollection, orderBy("dataReuniao", "desc"));
    allLeadsUnsubscribe = onSnapshot(q, (snapshot) => {
        allLeadsCache = [];
        snapshot.forEach((d) => allLeadsCache.push({ id: d.id, ...d.data() }));
        renderComparativoFull();
    }, (err) => console.warn("Erro allLeads:", err));
}

// ==========================================================================
// COMPARATIVO COMPLETO — usa allLeadsCache (todos os leads do banco)
// CLOSERS FIXOS: Matheus + 2 slots livres
// SDRs DINÂMICOS: Ingrid, Bruno, Karol e quem mais existir
// ==========================================================================

// Closers cadastrados — email → nome amigável
const CLOSERS_MAP = {
    'closermatheus@gmail.com': 'Matheus',
    '__slot2__': 'Vaga 2',
    '__slot3__': 'Vaga 3',
};

function renderComparativoFull() {
    const section = document.getElementById("admin-comparativo-section");
    if (!section || !isSuperAdmin) return;
    section.style.display = "flex";

    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

    // ── Acumular stats SDR ──
    const sdrStats = {};
    // ── Acumular stats Closer ──
    const closerStats = {};

    allLeadsCache.forEach(lead => {
        if (!lead.dataReuniao) return;
        const dataReuniao = new Date(lead.dataReuniao);
        if (dataReuniao < inicioMes) return;

        const valor = parseFloat(lead.valor || 0);
        const isFechado = lead.desfecho === "Fechado" || lead.desfecho === "Downsell";

        // SDR stats
        if (lead.sdr && lead.sdr.trim()) {
            const sdrNome = lead.sdr.trim();
            if (!sdrStats[sdrNome]) sdrStats[sdrNome] = { agendadas:0, qualificados:0, aprovadosPitch:0, fechados:0, fat:0 };
            const ss = sdrStats[sdrNome];
            ss.agendadas++;
            if (lead.statusDiag !== "No-Show") ss.qualificados++;
            if (lead.statusDiag === "Aprovado para Pitch") ss.aprovadosPitch++;
            if (isFechado) { ss.fechados++; ss.fat += valor; }
        }

        // Closer stats
        if (lead.closerEmail) {
            if (!closerStats[lead.closerEmail]) {
                closerStats[lead.closerEmail] = {
                    nome: lead.closerName || lead.closerEmail,
                    fat:0, total:0, fechados:0, pitches:0, fechadosPitch:0
                };
            }
            const cs = closerStats[lead.closerEmail];
            cs.total++;
            if (isFechado) { cs.fat += valor; cs.fechados++; }
            if (lead.pitch === "Sim") { cs.pitches++; if (isFechado) cs.fechadosPitch++; }
        }
    });

    _renderComparativoSDR(sdrStats);
    _renderComparativoCloser(closerStats);
}

function _renderComparativoSDR(sdrStats) {
    const container = document.getElementById("comparativo-sdr-container");
    if (!container) return;
    container.innerHTML = "";

    const entries = Object.entries(sdrStats).sort((a, b) => b[1].agendadas - a[1].agendadas);

    if (entries.length === 0) {
        container.innerHTML = `<p style="font-size:11px;color:var(--text-muted);grid-column:1/-1;padding:8px 0;">Nenhum lead com SDR registrado no mês.</p>`;
        return;
    }

    const maxAgendadas = Math.max(...entries.map(([,s]) => s.agendadas), 1);
    const medals = ['🥇','🥈','🥉'];

    // Identifica se é social seller (Karol) ou SDR normal
    const SOCIAL_SELLERS = ['karol','carol'];

    entries.forEach(([nome, ss], idx) => {
        const conv = ss.agendadas > 0 ? Math.round((ss.fechados / ss.agendadas) * 100) : 0;
        const pitchRate = ss.agendadas > 0 ? Math.round((ss.aprovadosPitch / ss.agendadas) * 100) : 0;
        const qualRate = ss.agendadas > 0 ? Math.round((ss.qualificados / ss.agendadas) * 100) : 0;
        const fatFmt = ss.fat.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const barWidth = Math.round((ss.agendadas / maxAgendadas) * 100);
        const medal = medals[idx] || '';
        const corConv = conv >= 20 ? 'var(--success-clean)' : conv >= 10 ? 'var(--warning-clean)' : 'var(--danger-clean)';
        const isSocial = SOCIAL_SELLERS.some(s => nome.toLowerCase().includes(s));
        const roleLabel = isSocial ? 'Social Seller' : 'SDR';
        const accentColor = isSocial ? 'var(--neon-accent)' : 'var(--warning-clean)';
        const accentBg = isSocial ? 'rgba(0,242,254,0.08)' : 'rgba(245,158,11,0.04)';
        const accentBorder = isSocial ? 'rgba(0,242,254,0.25)' : 'rgba(245,158,11,0.2)';
        const iconClass = isSocial ? 'fa-solid fa-mobile-screen-button' : 'fa-solid fa-headset';

        const card = document.createElement("div");
        card.style.cssText = `background:${accentBg};border:1px solid ${accentBorder};border-top:2px solid ${accentColor};border-radius:8px;padding:12px;`;
        card.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                <div style="display:flex;align-items:center;gap:6px;">
                    <div style="width:28px;height:28px;border-radius:50%;background:${accentBg};border:1px solid ${accentBorder};display:flex;align-items:center;justify-content:center;">
                        <i class="${iconClass}" style="color:${accentColor};font-size:11px;"></i>
                    </div>
                    <div>
                        <div style="font-size:12px;font-weight:800;">${medal} ${nome}</div>
                        <div style="font-size:9px;color:var(--text-muted);">${roleLabel} · Mês Atual</div>
                    </div>
                </div>
                <span style="font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px;background:${accentBg};color:${accentColor};">#${idx+1}</span>
            </div>

            <div style="margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <span style="font-size:9px;color:var(--text-muted);font-weight:700;">VOLUME AGENDADAS</span>
                    <span style="font-size:9px;font-weight:800;">${ss.agendadas}</span>
                </div>
                <div style="background:rgba(255,255,255,0.04);border-radius:4px;height:6px;overflow:hidden;">
                    <div style="width:${barWidth}%;height:100%;background:${accentColor};border-radius:4px;transition:width 0.5s;"></div>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:10px;">
                <div style="text-align:center;padding:5px 4px;background:rgba(255,255,255,0.02);border-radius:6px;border:1px solid var(--border-color);">
                    <div style="font-size:8px;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Qualif.</div>
                    <div style="font-size:16px;font-weight:800;color:var(--blue-accent);">${ss.qualificados}</div>
                    <div style="font-size:8px;color:var(--text-muted);">${qualRate}%</div>
                </div>
                <div style="text-align:center;padding:5px 4px;background:rgba(255,255,255,0.02);border-radius:6px;border:1px solid var(--border-color);">
                    <div style="font-size:8px;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Pitch</div>
                    <div style="font-size:16px;font-weight:800;color:var(--success-clean);">${ss.aprovadosPitch}</div>
                    <div style="font-size:8px;color:var(--text-muted);">${pitchRate}%</div>
                </div>
                <div style="text-align:center;padding:5px 4px;background:rgba(255,255,255,0.02);border-radius:6px;border:1px solid var(--border-color);">
                    <div style="font-size:8px;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Fechados</div>
                    <div style="font-size:16px;font-weight:800;color:var(--neon-accent);">${ss.fechados}</div>
                    <div style="font-size:8px;color:var(--text-muted);">${conv}%</div>
                </div>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid var(--border-color);">
                <div>
                    <span style="font-size:8px;color:var(--text-muted);font-weight:700;">CONV. GERAL</span>
                    <span style="font-size:15px;font-weight:800;margin-left:4px;color:${corConv};">${conv}%</span>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:8px;color:var(--text-muted);font-weight:700;">RECEITA GERADA</div>
                    <div style="font-size:12px;font-weight:800;color:var(--neon-accent);">${fatFmt}</div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function _renderComparativoCloser(closerStats) {
    const container = document.getElementById("comparativo-closer-container");
    if (!container) return;
    container.innerHTML = "";

    // Closers fixos: Matheus + 2 slots
    const FIXED_SLOTS = [
        { email: 'closermatheus@gmail.com', nome: 'Matheus' },
        { email: '__slot2__', nome: 'Vaga 2' },
        { email: '__slot3__', nome: 'Vaga 3' },
    ];

    // Merge: dados reais sobreescrevem slots
    const entries = FIXED_SLOTS.map(slot => {
        const data = closerStats[slot.email];
        return {
            email: slot.email,
            nome: data ? (data.nome.split(' ')[0]) : slot.nome,
            cs: data || null,
            isSlot: !data
        };
    });

    // Também inclui closers reais não listados nos slots
    Object.entries(closerStats).forEach(([email, cs]) => {
        if (!FIXED_SLOTS.find(s => s.email === email)) {
            entries.push({ email, nome: cs.nome.split(' ')[0], cs, isSlot: false });
        }
    });

    const maxFat = Math.max(...entries.filter(e => e.cs).map(e => e.cs.fat), 1);
    const medals = ['🥇','🥈','🥉'];
    // Ordena por faturamento (slots vão pro fim)
    entries.sort((a, b) => {
        if (!a.cs && !b.cs) return 0;
        if (!a.cs) return 1;
        if (!b.cs) return -1;
        return b.cs.fat - a.cs.fat;
    });

    entries.forEach((entry, idx) => {
        const card = document.createElement("div");

        if (entry.isSlot) {
            // Card vazio para vaga
            card.style.cssText = "background:rgba(255,255,255,0.01);border:1px dashed var(--border-color);border-radius:8px;padding:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:180px;gap:8px;";
            card.innerHTML = `
                <div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.03);border:1px dashed var(--border-color);display:flex;align-items:center;justify-content:center;">
                    <i class="fa-solid fa-user-plus" style="color:var(--border-color);font-size:14px;"></i>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:11px;font-weight:700;color:var(--border-color);">${entry.nome}</div>
                    <div style="font-size:9px;color:var(--border-color);margin-top:2px;">Closer · Aguardando</div>
                </div>
            `;
        } else {
            const cs = entry.cs;
            const conv = cs.total > 0 ? Math.round((cs.fechados / cs.total) * 100) : 0;
            const pitchConv = cs.pitches > 0 ? Math.round((cs.fechadosPitch / cs.pitches) * 100) : 0;
            const fatFmt = cs.fat.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const barWidth = maxFat > 0 ? Math.round((cs.fat / maxFat) * 100) : 0;
            const medal = medals[idx] || '';
            const metaInd = metasConfig.metas?.[entry.email]?.meta || 0;
            const supermetaInd = metasConfig.metas?.[entry.email]?.supermeta || 0;
            const pctMeta = metaInd > 0 ? Math.min(Math.round((cs.fat / metaInd) * 100), 100) : null;
            const pctSuper = supermetaInd > 0 ? Math.min(Math.round((cs.fat / supermetaInd) * 100), 100) : null;
            const corConv = conv >= 30 ? 'var(--success-clean)' : conv >= 15 ? 'var(--warning-clean)' : 'var(--danger-clean)';

            card.style.cssText = "background:rgba(124,58,237,0.04);border:1px solid rgba(124,58,237,0.2);border-top:2px solid var(--purple-accent);border-radius:8px;padding:12px;";
            card.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                    <div style="display:flex;align-items:center;gap:6px;">
                        <div style="width:28px;height:28px;border-radius:50%;background:rgba(124,58,237,0.15);display:flex;align-items:center;justify-content:center;">
                            <i class="fa-solid fa-user-tie" style="color:var(--purple-accent);font-size:11px;"></i>
                        </div>
                        <div>
                            <div style="font-size:12px;font-weight:800;">${medal} ${entry.nome}</div>
                            <div style="font-size:9px;color:var(--text-muted);">Closer · Mês Atual</div>
                        </div>
                    </div>
                    <span style="font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px;background:rgba(124,58,237,0.1);color:var(--purple-accent);">#${idx+1}</span>
                </div>

                <div style="margin-bottom:10px;">
                    <div style="font-size:9px;color:var(--text-muted);font-weight:700;margin-bottom:2px;">FATURAMENTO</div>
                    <div style="font-size:20px;font-weight:800;color:var(--neon-accent);line-height:1.1;margin-bottom:5px;">${fatFmt}</div>
                    <div style="background:rgba(255,255,255,0.04);border-radius:4px;height:6px;overflow:hidden;">
                        <div style="width:${barWidth}%;height:100%;background:linear-gradient(90deg,var(--neon-accent),var(--purple-accent));border-radius:4px;transition:width 0.5s;"></div>
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:10px;">
                    <div style="text-align:center;padding:5px 4px;background:rgba(255,255,255,0.02);border-radius:6px;border:1px solid var(--border-color);">
                        <div style="font-size:8px;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Reuniões</div>
                        <div style="font-size:16px;font-weight:800;">${cs.total}</div>
                    </div>
                    <div style="text-align:center;padding:5px 4px;background:rgba(255,255,255,0.02);border-radius:6px;border:1px solid var(--border-color);">
                        <div style="font-size:8px;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Fechados</div>
                        <div style="font-size:16px;font-weight:800;color:var(--success-clean);">${cs.fechados}</div>
                    </div>
                    <div style="text-align:center;padding:5px 4px;background:rgba(255,255,255,0.02);border-radius:6px;border:1px solid var(--border-color);">
                        <div style="font-size:8px;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Conv. Pitch</div>
                        <div style="font-size:16px;font-weight:800;color:var(--blue-accent);">${pitchConv}%</div>
                    </div>
                </div>

                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-top:1px solid var(--border-color);${pctMeta !== null ? 'border-bottom:1px solid var(--border-color);margin-bottom:8px;' : ''}">
                    <div>
                        <span style="font-size:8px;color:var(--text-muted);font-weight:700;">CONVERSÃO</span>
                        <span style="font-size:15px;font-weight:800;margin-left:4px;color:${corConv};">${conv}%</span>
                    </div>
                    <div style="font-size:8px;color:var(--text-muted);">${cs.pitches} pitches</div>
                </div>

                ${pctMeta !== null ? `
                <div style="margin-top:4px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
                        <span style="font-size:8px;color:var(--text-muted);font-weight:700;">META</span>
                        <span style="font-size:8px;font-weight:800;color:var(--neon-accent);">${pctMeta}%</span>
                    </div>
                    <div style="background:rgba(255,255,255,0.04);border-radius:3px;height:5px;overflow:hidden;">
                        <div style="width:${pctMeta}%;height:100%;background:var(--neon-accent);border-radius:3px;"></div>
                    </div>
                </div>` : ''}
                ${pctSuper !== null ? `
                <div style="margin-top:4px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
                        <span style="font-size:8px;color:var(--text-muted);font-weight:700;">SUPERMETA</span>
                        <span style="font-size:8px;font-weight:800;color:var(--purple-accent);">${pctSuper}%</span>
                    </div>
                    <div style="background:rgba(255,255,255,0.04);border-radius:3px;height:5px;overflow:hidden;">
                        <div style="width:${pctSuper}%;height:100%;background:var(--purple-accent);border-radius:3px;"></div>
                    </div>
                </div>` : ''}
            `;
        }
        container.appendChild(card);
    });
}


// ==========================================================================
// HISTOGRAMA DE OBJEÇÕES (mantido igual)
// ==========================================================================
function renderLossHistogram(objetoPerdas) {
    const container = document.getElementById("loss-reasons-container");
    if (!container) return;
    const valores = Object.values(objetoPerdas);
    const maxPerdas = Math.max(...valores, 1); 
    if (valores.reduce((a, b) => a + b, 0) === 0) { container.innerHTML = `<p class="text-muted" style="padding:5px 0;">Nenhum lead perdido registrado.</p>`; return; }
    
    container.innerHTML = "";
    const nomesAmigaveis = { "Sem Caixa": "Sem Caixa / Preço", "Sem Decisor": "Sem Decisor na Call", "Não tem o Perfil": "Sem Perfil", "Pensar / Sumiu": "Sumiu", "Outro": "Outros" };

    Object.keys(objetoPerdas).forEach(chave => {
        const row = document.createElement("div"); row.className = "rk-row";
        row.innerHTML = `<div class="rk-label">${nomesAmigaveis[chave] || chave}</div><div class="rk-bar-bg"><div class="rk-bar-fill" style="width: ${(objetoPerdas[chave]/maxPerdas)*100}%;"></div></div><div class="rk-count">${objetoPerdas[chave]}</div>`;
        container.appendChild(row);
    });
}

// ==========================================================================
// EXPORTADOR CSV (mantido igual)
// ==========================================================================
window.exportToSheetsCSV = function() {
    if (!isAdmin) return;
    
    let csvContent = "data:text/csv;charset=utf-8,Nome,Empresa,Faturamento,SDR,Data Reuniao,Origem,Decisor,Status Diagnostico,Desfecho,Valor,Closer\n";
    
    localLeadsCache.forEach(lead => {
        const row = [
            `"${lead.nome || ''}"`, `"${lead.empresa || ''}"`, `"${lead.faturamento || ''}"`,
            `"${lead.sdr || ''}"`, `"${lead.dataReuniao || ''}"`, `"${lead.origem || ''}"`,
            `"${lead.decisor || ''}"`, `"${lead.statusDiag || ''}"`, `"${lead.desfecho || ''}"`,
            `"${lead.valor || 0}"`, `"${lead.closerName || ''}"`
        ].join(",");
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_agencia_rei_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// ==========================================================================
// INTEGRAÇÃO GOOGLE CALENDAR (mantida igual)
// ==========================================================================
function gapiLoad() { gapi.load('client', () => gapi.client.init({ discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"] })); }
function gisInit() { tokenClient = google.accounts.oauth2.initTokenClient({ client_id: CLIENT_ID, scope: SCOPES, callback: '' }); }

window.handleAuthClick = function() {
    tokenClient.callback = async (resp) => { if (resp.error !== undefined) throw (resp); await listUpcomingEvents(); };
    if (gapi.client.getToken() === null) tokenClient.requestAccessToken({prompt: 'consent'});
    else tokenClient.requestAccessToken({prompt: ''});
};

async function listUpcomingEvents() {
    try {
        const agora = new Date(); const daquiUmaSemana = new Date(); daquiUmaSemana.setDate(agora.getDate() + 7);
        const response = await gapi.client.calendar.events.list({ 'calendarId': 'primary', 'timeMin': agora.toISOString(), 'timeMax': daquiUmaSemana.toISOString(), 'showDeleted': false, 'singleEvents': true, 'orderBy': 'startTime' });
        const events = response.result.items; const container = document.getElementById('calendar-events-list');
        if (!container) return; container.innerHTML = '';
        if (!events || events.length === 0) { container.innerHTML = '<p class="text-muted" style="padding:15px; text-align:center;">Nenhuma reunião agendada na sua agenda para os próximos 7 dias.</p>'; document.getElementById('calendar-modal').style.display = 'flex'; return; }

        const salvosIds = localLeadsCache.map(l => l.calendarEventId).filter(id => id);
        events.forEach((event) => {
            const start = event.start.dateTime || event.start.date; const dataObjeto = new Date(start); const dataTexto = dataObjeto.toLocaleDateString('pt-BR') + ' ' + dataObjeto.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
            const titulo = event.summary || 'Reunião Sem Título'; const jaImportado = salvosIds.includes(event.id);
            const div = document.createElement('div'); div.className = 'calendar-import-row';
            div.innerHTML = `<div style="max-width:70%; display:flex; flex-direction:column; gap:2px;"><strong>${titulo}</strong><span style="font-size:10px; color:var(--text-muted);"><i class="fa-solid fa-clock"></i> ${dataTexto}</span></div><div>${jaImportado ? `<span class="badge-count" style="background-color:rgba(255,255,255,0.05); color:var(--text-muted);">Importado</span>` : `<button class="btn-sm-note" onclick="window.importEventToForm('${btoa(unescape(encodeURIComponent(JSON.stringify(event))))}')">Puxar</button>`}</div>`;
            container.appendChild(div);
        });
        document.getElementById('calendar-modal').style.display = 'flex';
    } catch (err) { console.error(err); }
}

window.importEventToForm = function(base64Event) {
    const event = JSON.parse(decodeURIComponent(escape(atob(base64Event)))); document.getElementById('calendar-modal').style.display = 'none'; window.openNewLeadModal(); document.getElementById('form-nome').value = event.summary || '';
    const start = event.start.dateTime || event.start.date;
    if(start) { const d = new Date(start); const pad = (n) => n.toString().padStart(2, '0'); document.getElementById('form-data-reuniao').value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
    
    const form = document.getElementById('lead-form'); const antigoId = document.getElementById('form-calendar-id-holder'); if(antigoId) antigoId.remove();
    const hiddenId = document.createElement('input'); hiddenId.type = 'hidden'; hiddenId.id = 'form-calendar-id-holder'; hiddenId.value = event.id; form.appendChild(hiddenId);

    const originalSubmit = window.handleLeadFormSubmit;
    window.handleLeadFormSubmit = async function(e) {
        e.preventDefault();
        const id = document.getElementById("form-lead-id").value;
        const leadData = {
            nome: document.getElementById("form-nome").value, empresa: document.getElementById("form-empresa").value, faturamento: document.getElementById("form-faturamento").value, sdr: document.getElementById("form-sdr").value.trim(), dataReuniao: document.getElementById("form-data-reuniao").value, origem: document.getElementById("form-origem").value, decisor: document.getElementById("form-decisor").value, statusDiag: document.getElementById("form-status-diag").value, pitch: document.getElementById("form-pitch").value, reagendado: document.getElementById("form-reagendado").value, desfecho: document.getElementById("form-desfecho").value, valor: parseFloat(document.getElementById("form-valor").value || 0), dataPagamento: document.getElementById("form-data-pagamento").value, motivoPerda: document.getElementById("form-motivo-perda").value, calendarEventId: event.id, closerEmail: currentUser.email, closerName: currentUser.displayName, observacoes: id ? (localLeadsCache.find(l => l.id === id)?.observacoes || "") : ""
        };
        try { if (id) await updateDoc(doc(db, "leads", id), leadData); else await addDoc(leadsCollection, leadData); window.closeLeadModal(); window.handleLeadFormSubmit = originalSubmit; } catch (err) { console.error(err); }
    };
};

// ==========================================================================
// ENGINE DE GRÁFICOS — CHART.JS (mantida, apenas removido gráfico SDR antigo)
// ==========================================================================
const chartInstances = {};

function destroyChart(id) {
    if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
}

const CHART_DEFAULTS = {
    color: '#9CA3AF',
    borderColor: '#1F2937',
    plugins: {
        legend: { labels: { color: '#9CA3AF', font: { size: 10, family: 'Plus Jakarta Sans' }, boxWidth: 10 } },
        tooltip: { backgroundColor: '#111827', titleColor: '#F3F4F6', bodyColor: '#9CA3AF', borderColor: '#1F2937', borderWidth: 1 }
    }
};

window.renderAllCharts = function() {
    if (typeof Chart === 'undefined') return;

    const agora = new Date();

    // ── 1. FATURAMENTO AO LONGO DO TEMPO ──
    const mesesLabels = [];
    const mesesFaturamento = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
        mesesLabels.push(d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }));
        const fat = localLeadsCache
            .filter(l => { if (!l.dataReuniao) return false; const dr = new Date(l.dataReuniao); return dr.getMonth() === d.getMonth() && dr.getFullYear() === d.getFullYear() && (l.desfecho === 'Fechado' || l.desfecho === 'Downsell'); })
            .reduce((acc, l) => acc + parseFloat(l.valor || 0), 0);
        mesesFaturamento.push(fat);
    }
    destroyChart('faturamento');
    const ctxFat = document.getElementById('chart-faturamento');
    if (ctxFat) {
        chartInstances['faturamento'] = new Chart(ctxFat, {
            type: 'line',
            data: { labels: mesesLabels, datasets: [{ label: 'Faturamento (R$)', data: mesesFaturamento, borderColor: '#00F2FE', backgroundColor: 'rgba(0,242,254,0.08)', pointBackgroundColor: '#00F2FE', pointRadius: 4, tension: 0.4, fill: true }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { x: { ticks: { color: '#9CA3AF', font: { size: 9 } }, grid: { color: '#1F2937' } }, y: { ticks: { color: '#9CA3AF', font: { size: 9 }, callback: v => 'R$' + (v/1000).toFixed(0) + 'k' }, grid: { color: '#1F2937' } } }, plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } } }
        });
    }

    // ── 2. FUNIL DE VENDAS (rosca) ──
    const funnelData = [
        localLeadsCache.filter(l => l.statusDiag === 'No-Show').length,
        localLeadsCache.filter(l => l.statusDiag === 'Aprovado para Pitch').length,
        localLeadsCache.filter(l => l.statusDiag?.includes('Reprovado') || l.statusDiag?.includes('Qualificado')).length,
        localLeadsCache.filter(l => l.desfecho === 'Fechado').length,
    ];
    destroyChart('funil');
    const ctxFunil = document.getElementById('chart-funil');
    if (ctxFunil) {
        chartInstances['funil'] = new Chart(ctxFunil, {
            type: 'doughnut',
            data: { labels: ['No-Show', 'Pitch', 'Reprovado', 'Fechado'], datasets: [{ data: funnelData, backgroundColor: ['#EF4444', '#3B82F6', '#F59E0B', '#10B981'], borderColor: '#111827', borderWidth: 2 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { ...CHART_DEFAULTS.plugins } }
        });
    }

    // ── 3. LEADS POR ORIGEM (rosca) ──
    const yaraCount = localLeadsCache.filter(l => l.origem === 'I.A Yara').length;
    const crmCount = localLeadsCache.filter(l => l.origem === 'CRM').length;
    destroyChart('origem');
    const ctxOrigem = document.getElementById('chart-origem');
    if (ctxOrigem) {
        chartInstances['origem'] = new Chart(ctxOrigem, {
            type: 'doughnut',
            data: { labels: ['I.A Yara', 'CRM'], datasets: [{ data: [yaraCount, crmCount], backgroundColor: ['rgba(59,130,246,0.8)', 'rgba(124,58,237,0.8)'], borderColor: '#111827', borderWidth: 2 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { ...CHART_DEFAULTS.plugins } }
        });
    }
};