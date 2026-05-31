// ==========================================================================
// IMPORTAÇÃO DOS MÓDULOS OFICIAIS DO SDK DO FIREBASE (V10+)
// ==========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// CONFIGURAÇÃO DO FIREBASE (IMUTÁVEL)
const firebaseConfig = {
    apiKey: "AIzaSyAUla_3nMh_eMlELHUsmyXWYaHayWAAEJE",
    authDomain: "dashboard-closer-3f088.firebaseapp.com",
    projectId: "dashboard-closer-3f088",
    storageBucket: "dashboard-closer-3f088.appspot.com",
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
let localLeadsCache = [];
let firebaseUnsubscribe = null;

// CREDENCIAIS DA API GOOGLE CALENDAR
const CLIENT_ID = '258420488272-c2emtfbpljfq51kvrlbna83gunrsvsas.apps.googleusercontent.com'; 
const SCOPES = 'https://www.googleapis.com/auth/calendar.events.readonly';
let tokenClient;

// ==========================================================================
// CENTRAL DE AUTENTICAÇÃO E CONTROLE DE TRAVA DE SESSÃO
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    
    // Força a função de login a ficar disponível globalmente na janela (window)
    window.executeGoogleLogin = async function() {
        try {
            console.log("Disparando pop-up do Firebase Auth...");
            await signInWithPopup(auth, provider);
        } catch (err) {
            console.error("Erro interno no pop-up do Firebase:", err);
            alert("Erro ao abrir o login: " + err.message);
        }
    };

    // Injeta o clique de forma direta via atributo para o navegador não bloquear
    const loginBtn = document.getElementById("btn-google-login");
    if (loginBtn) {
        loginBtn.setAttribute("onclick", "window.executeGoogleLogin()");
    } else {
        console.warn("Aviso: Botão 'btn-google-login' não foi encontrado no HTML ainda.");
    }

    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn) {
        logoutBtn.onclick = async () => { await signOut(auth); };
    }

    // Monitor do Estado de Login do Usuário
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("Usuário autenticado com sucesso:", user.email);
            currentUser = user;
            isAdmin = (user.email === 'anna@agenciarei.com' || user.email === 'anna.agenciarei@gmail.com');
            
            const nameDisplay = document.getElementById("user-display-name");
            if (nameDisplay) nameDisplay.innerText = user.displayName || user.email;
            
            if (document.getElementById("login-screen")) document.getElementById("login-screen").style.display = "none";
            if (document.getElementById("app-layout")) document.getElementById("app-layout").style.display = "block";

            if (isAdmin) {
                if (document.getElementById("admin-closer-filter-wrapper")) document.getElementById("admin-closer-filter-wrapper").style.display = "block";
                if (document.getElementById("btn-export-sheets")) document.getElementById("btn-export-sheets").style.display = "inline-flex";
                if (document.getElementById("insights-panel-title")) {
                    document.getElementById("insights-panel-title").innerHTML = `<i class="fa-solid fa-crown" style="color:var(--warning-clean)"></i> Auditoria Estratégica da Anna`;
                }
            } else {
                if (document.getElementById("admin-closer-filter-wrapper")) document.getElementById("admin-closer-filter-wrapper").style.display = "none";
                if (document.getElementById("btn-export-sheets")) document.getElementById("btn-export-sheets").style.display = "none";
            }

            // Inicializa a escuta do banco
            initRealTimeListener();
            
            // Carrega os scripts da agenda em segundo plano após o login para não travar
            setTimeout(() => {
                try {
                    gisInit();
                    gapiLoad();
                } catch(e) { console.warn("Aguardando carregamento final dos scripts Google..."); }
            }, 1500);

        } else {
            currentUser = null;
            isAdmin = false;
            if (firebaseUnsubscribe) firebaseUnsubscribe();
            if (document.getElementById("app-layout")) document.getElementById("app-layout").style.display = "none";
            if (document.getElementById("login-screen")) document.getElementById("login-screen").style.display = "flex";
        }
    });

    window.addEventListener('refresh-metrics', () => {
        window.populateSdrFilterOptions();
        window.calculateAdvancedMetrics();
    });
    
    const saveNotesBtn = document.getElementById("save-notes-btn");
    if(saveNotesBtn) saveNotesBtn.onclick = saveQuickNotes;
});

// ==========================================================================
// FILTRAGEM E ESCUTA EM TEMPO REAL (FIREBASE)
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
            // Regra de Isolamento: Anna vê tudo se selecionar "todos", Closers só veem o próprio e-mail
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
// RENDERIZAÇÃO DA MESA DE OPERAÇÕES OTIMIZADA
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
                <span class="lead-main-name" style="text-decoration: underline; text-decoration-color: transparent; transition: text-decoration-color 0.2s;">${lead.nome}</span>
                <span class="lead-co-name">${lead.empresa || 'Sem Empresa'}</span>
            </td>
            <td style="font-weight: 600;">${lead.faturamento || '—'}</td>
            <td><span style="font-weight: 600;">${lead.sdr || 'Direto'}</span><span class="lead-co-name"><span class="p-badge ${badgeOrigem}">${lead.origem}</span></span></td>
            <td>${dataFormatada}</td>
            <td><span class="p-badge ${badgeDecisor}">Decisor: ${lead.decisor || 'Não'}</span></td>
            <td><span class="p-badge ${badgeDiag}">${lead.statusDiag || 'Aprovado'}</span></td>
            <td><span class="p-badge ${badgeDesfecho}">${lead.desfecho}</span><span class="lead-co-name color-neon" style="font-weight: 600;">${valorContrato}</span></td>
            <td style="font-weight: 500; color:var(--text-muted);">${lead.closerName ? lead.closerName.split(' ')[0] : '—'}</td>
            <td>
                <div class="btn-action-row">
                    <button class="btn-sm-note" onclick="event.stopPropagation(); window.openNotesModal('${lead.id}')" title="Notas / Scripts"><i class="fa-solid fa-comment-dots"></i> Notas</button>
                    <button class="btn-action edit" onclick="event.stopPropagation(); window.editLead('${lead.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="btn-action delete" onclick="event.stopPropagation(); window.deleteLead('${lead.id}')"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </td>
        `;
        container.appendChild(tr);
    });
}

// ==========================================================================
// CONTROLE DOS MODAIS OPERACIONAIS
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
        if (currentDiag === "No-Show") {
            desfechoSelect.value = "Em Aberto";
        } else {
            desfechoSelect.value = "Perdido";
        }
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

// MODAL DE NOTAS + PLAYBOOK DE OBJEÇÕES EM TEMPO REAL
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
// CENTRAL DE METRICAS AVANÇADAS & SCORECARD SDR
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

window.calculateAdvancedMetrics = function() {
    const selectedSdr = document.getElementById("filter-sdr-select")?.value || "todos";
    const agora = new Date();
    
    const inicioSemana = new Date(agora); inicioSemana.setDate(agora.getDate() - agora.getDay()); inicioSemana.setHours(0,0,0,0);
    const inicioQuinzena = new Date(agora); inicioQuinzena.setDate(agora.getDate() - 15); inicioQuinzena.setHours(0,0,0,0);
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

    let faturamentoSemana = 0, totalLeadsSemana = 0, fechadosSemana = 0;
    let faturamentoQuinzena = 0, totalLeadsQuinzena = 0, fechadosQuinzena = 0;
    let faturamentoMes = 0, totalLeadsMes = 0, fechadosMes = 0;

    let totalPitches = 0, fechadosPops = 0, totalDecisoresValidados = 0, totalLeadsComDiag = 0;
    let yaraTotal = 0, yaraFechados = 0, crmTotal = 0, crmFechados = 0;
    let funnelTotal = 0, funnelNoShow = 0, funnelQualificados = 0, funnelReprovados = 0;

    const contagemObjecoes = { "Sem Caixa": 0, "Sem Decisor": 0, "Não tem o Perfil": 0, "Pensar / Sumiu": 0, "Outro": 0 };

    localLeadsCache.forEach(lead => {
        if (!lead.dataReuniao) return;
        const dataReuniao = new Date(lead.dataReuniao);
        const valor = parseFloat(lead.valor || 0);
        const passouFiltroSdr = (selectedSdr === "todos" || lead.sdr === selectedSdr);

        if (dataReuniao >= inicioSemana) { totalLeadsSemana++; if (lead.desfecho === "Fechado" || lead.desfecho === "Downsell") { faturamentoSemana += valor; fechadosSemana++; } }
        if (dataReuniao >= inicioQuinzena) { totalLeadsQuinzena++; if (lead.desfecho === "Fechado" || lead.desfecho === "Downsell") { faturamentoQuinzena += valor; fechadosQuinzena++; } }
        if (dataReuniao >= inicioMes) { totalLeadsMes++; if (lead.desfecho === "Fechado" || lead.desfecho === "Downsell") { faturamentoMes += valor; fechadosMes++; } }

        if (passouFiltroSdr) {
            funnelTotal++;
            if (lead.statusDiag === "No-Show") funnelNoShow++;
            else if (lead.statusDiag === "Aprovado para Pitch") funnelQualificados++;
            else if (lead.statusDiag?.includes("Reprovado") || lead.statusDiag?.includes("Qualificado")) funnelReprovados++;

            if (lead.pitch === "Sim") { totalPitches++; if (lead.desfecho === "Fechado" || lead.desfecho === "Downsell") fechadosPops++; }
            if (lead.decisor) { totalLeadsComDiag++; if (lead.decisor === "Sim") totalDecisoresValidados++; }

            if (lead.origem === "I.A Yara") { yaraTotal++; if (lead.desfecho === "Fechado" || lead.desfecho === "Downsell") yaraFechados++; } 
            else if (lead.origem === "CRM") { crmTotal++; if (lead.desfecho === "Fechado" || lead.desfecho === "Downsell") crmFechados++; }

            if (lead.desfecho === "Perdido" && lead.motivoPerda && contagemObjecoes[lead.motivoPerda] !== undefined) contagemObjecoes[lead.motivoPerda]++;
        }
    });

    if (document.getElementById("metrics-week-money")) document.getElementById("metrics-week-money").innerText = faturamentoSemana.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (document.getElementById("metrics-week-conv")) document.getElementById("metrics-week-conv").innerText = `Conversão: ${totalLeadsSemana > 0 ? Math.round((fechadosSemana / totalLeadsSemana) * 100) : 0}%`;
    if (document.getElementById("metrics-fortnight-money")) document.getElementById("metrics-fortnight-money").innerText = faturamentoQuinzena.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (document.getElementById("metrics-fortnight-conv")) document.getElementById("metrics-fortnight-conv").innerText = `Conversão: ${totalLeadsQuinzena > 0 ? Math.round((fechadosQuinzena / totalLeadsQuinzena) * 100) : 0}%`;
    if (document.getElementById("metrics-month-money")) document.getElementById("metrics-month-money").innerText = faturamentoMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (document.getElementById("metrics-month-conv")) document.getElementById("metrics-month-conv").innerText = `Conversão: ${totalLeadsMes > 0 ? Math.round((fechadosMes / totalLeadsMes) * 100) : 0}%`;

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

    renderLossHistogram(contagemObjecoes);
};

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
// EXPORTADOR AUTOMÁTICO DE RELATÓRIO EM CSV (EXCLUSIVO PARA A ANNA)
// ==========================================================================
window.exportToSheetsCSV = function() {
    if (!isAdmin) return;
    
    let csvContent = "data:text/csv;charset=utf-8,Nome,Empresa,Faturamento,SDR,Data Reuniao,Origem,Decisor,Status Diagnostico,Desfecho,Valor,Closer\n";
    
    localLeadsCache.forEach(lead => {
        const row = [
            `"${lead.nome || ''}"`,
            `"${lead.empresa || ''}"`,
            `"${lead.faturamento || ''}"`,
            `"${lead.sdr || ''}"`,
            `"${lead.dataReuniao || ''}"`,
            `"${lead.origem || ''}"`,
            `"${lead.decisor || ''}"`,
            `"${lead.statusDiag || ''}"`,
            `"${lead.desfecho || ''}"`,
            `"${lead.valor || 0}"`,
            `"${lead.closerName || ''}"`
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
// INTEGRAÇÃO EXCLUSIVA GOOGLE CALENDAR
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
            div.innerHTML = `<div style="max-width:70%; display:flex; flex-direction:column; gap:2px;"><strong>${titulo}</strong><span style="font-size:10px; color:var(--text-muted);"><i class="fa-solid fa-clock"></i> ${dataTexto}</span></div><div>${jaImportado ? `<span class="badge-count" style="background-color:rgba(255,255,255,0.05); color:var(--text-muted);">Importado</span>` : `<button class="btn-sm-note" onclick="window.importEventToForm('${btoa(unescape(encodeURIComponent(JSON.stringify(event))))}')" style="color:var(--neon-accent); border-color:var(--neon-accent);">Puxar</button>`}</div>`;
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