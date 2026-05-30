// ==========================================================================
// IMPORTAÇÃO DOS MÓDULOS OFICIAIS DO SDK DO FIREBASE (V10+)
// ==========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    onSnapshot,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================================================
// CONFIGURAÇÃO DO TEU BANCO DE DADOS
// ==========================================================================
const firebaseConfig = {
    apiKey: "AIzaSyAUla_3nMh_eMlELHUsmyXWYaHayWAAEJE",
    authDomain: "dashboard-closer-3f088.firebaseapp.com",
    projectId: "dashboard-closer-3f088",
    storageBucket: "dashboard-closer-3f088.appspot.com",
    messagingSenderId: "366563664458",
    appId: "1:366563664458:web:6e36507e266a720dd1bcb3"
};

// Inicialização do Firebase e Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const leadsCollection = collection(db, "leads");

// Variável Global para Armazenar os Leads em Memória Real-time
let localLeadsCache = [];

// ==========================================================================
// CONFIGURAÇÕES DA INTEGRAÇÃO COOGLE CALENDAR
// ==========================================================================
const CLIENT_ID = '366563664458-ap982j8l8m6m7b9m8q7p9r7s8t9u1v2w.apps.googleusercontent.com'; // Gerado no console google associado ao teu app id
const SCOPES = 'https://www.googleapis.com/auth/calendar.events.readonly';
let tokenClient;
let gapiInited = false;
let gisInited = false;

// ==========================================================================
// ROTINAS DE INICIALIZAÇÃO E ESCUTA EM TEMPO REAL
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    initRealTimeListener();
    setupGlobalEvents();
    gisInit();
    gapiLoad();
});

function setupGlobalEvents() {
    window.addEventListener('refresh-metrics', () => {
        window.populateSdrFilterOptions();
        window.calculateAdvancedMetrics();
    });

    const saveNotesBtn = document.getElementById("save-notes-btn");
    if(saveNotesBtn) {
        saveNotesBtn.onclick = saveQuickNotes;
    }
}

function initRealTimeListener() {
    const q = query(leadsCollection, orderBy("dataReuniao", "desc"));
    
    onSnapshot(q, (snapshot) => {
        localLeadsCache = [];
        snapshot.forEach((doc) => {
            localLeadsCache.push({ id: doc.id, ...doc.data() });
        });
        
        renderLeadsTable();
        window.populateSdrFilterOptions();
        window.calculateAdvancedMetrics();
    }, (error) => {
        console.error("Erro na escuta em tempo real do Firebase: ", error);
    });
}

// ==========================================================================
// RENDERIZAÇÃO DA PÁGINA 1: MESA DE OPERAÇÕES
// ==========================================================================
function renderLeadsTable() {
    const container = document.getElementById("leads-container");
    const totalCounter = document.getElementById("table-total-count");
    if (!container) return;
    
    if (totalCounter) totalCounter.innerText = `${localLeadsCache.length} Lead${localLeadsCache.length !== 1 ? 's' : ''}`;

    if (localLeadsCache.length === 0) {
        container.innerHTML = `<tr><td colspan="9" class="text-muted" style="text-align: center; padding: 30px;">Nenhum lead na mesa de operações até o momento.</td></tr>`;
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
        if (lead.statusDiag === "No-Show") badgeDiag = "p-badge-danger";

        tr.innerHTML = `
            <td>
                <span class="lead-main-name">${lead.nome}</span>
                <span class="lead-co-name">${lead.empresa || 'Sem Empresa'}</span>
            </td>
            <td style="font-weight: 600;">${lead.faturamento || '—'}</td>
            <td>
                <span style="font-weight: 600;">${lead.sdr || 'Direto'}</span>
                <span class="lead-co-name"><span class="p-badge ${badgeOrigem}">${lead.origem}</span></span>
            </td>
            <td>${dataFormatada}</td>
            <td>
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <span>Decisor: <span class="p-badge ${badgeDecisor}">${lead.decisor || 'Não'}</span></span>
                    <span class="p-badge ${badgeDiag}" style="margin-top:2px; text-align:center;">${lead.statusDiag || 'Aprovado para Pitch'}</span>
                </div>
            </td>
            <td>
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <span>Pitch: <strong>${lead.pitch}</strong></span>
                    <span class="lead-co-name">Reag. 2ª Call: ${lead.reagendado}</span>
                </div>
            </td>
            <td>
                <span class="p-badge ${badgeDesfecho}">${lead.desfecho}</span>
                <span class="lead-co-name color-neon" style="font-weight: 600;">${valorContrato}</span>
            </td>
            <td>${lead.dataPagamento ? new Date(lead.dataPagamento).toLocaleDateString('pt-BR') : '—'}</td>
            <td>
                <div class="btn-action-row">
                    <button class="btn-sm-note" onclick="window.openNotesModal('${lead.id}')" title="Notas da Call">
                        <i class="fa-solid fa-comment-dots"></i> Notas
                    </button>
                    <button class="btn-action edit" onclick="window.editLead('${lead.id}')" title="Editar Linha Completa">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn-action delete" onclick="window.deleteLead('${lead.id}')" title="Deletar Lead">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </td>
        `;
        container.appendChild(tr);
    });
}

// ==========================================================================
// CONTROLE DOS MODAIS E FLUXOS OPERACIONAIS (PÁGINA 1) - ESCOPO GLOBAL
// ==========================================================================
window.openNewLeadModal = function() {
    const form = document.getElementById("lead-form");
    if(form) form.reset();
    document.getElementById("form-lead-id").value = "";
    document.getElementById("form-modal-title").innerHTML = `<i class="fa-solid fa-user-plus"></i> Inserir Lead na Mesa`;
    document.getElementById("loss-reason-group").style.display = "none";
    document.getElementById("lead-form-modal").style.display = "flex";
};

window.closeLeadModal = function() {
    document.getElementById("lead-form-modal").style.display = "none";
};

window.toggleLossReasonField = function() {
    const desfechoValue = document.getElementById("form-desfecho").value;
    const lossGroup = document.getElementById("loss-reason-group");
    if(lossGroup) {
        if(desfechoValue === "Perdido") {
            lossGroup.style.display = "flex";
        } else {
            lossGroup.style.display = "none";
            document.getElementById("form-motivo-perda").value = "";
        }
    }
};

window.handleLeadFormSubmit = async function(e) {
    if(e) e.preventDefault();
    
    const id = document.getElementById("form-lead-id").value;
    const leadData = {
        nome: document.getElementById("form-nome").value,
        empresa: document.getElementById("form-empresa").value,
        faturamento: document.getElementById("form-faturamento").value,
        sdr: document.getElementById("form-sdr").value.trim() || "Direto",
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
        observacoes: id ? (localLeadsCache.find(l => l.id === id)?.observacoes || "") : ""
    };

    try {
        if (id) {
            const docRef = doc(db, "leads", id);
            await updateDoc(docRef, leadData);
        } else {
            await addDoc(leadsCollection, leadData);
        }
        window.closeLeadModal();
    } catch (err) {
        console.error("Erro ao salvar documento: ", err);
        alert("Falha ao salvar dados no Firebase.");
    }
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
    if (confirm("Tem certeza que deseja remover este lead da mesa de operações?")) {
        try {
            await deleteDoc(doc(db, "leads", id));
        } catch (err) {
            console.error("Erro ao deletar lead: ", err);
        }
    }
};

// ==========================================================================
// CONTROLE DO POP-UP LEVE: HISTÓRICO E NOTAS RÁPIDAS
// ==========================================================================
let currentActiveNotesLeadId = null;

window.openNotesModal = function(id) {
    const lead = localLeadsCache.find(l => l.id === id);
    if (!lead) return;

    currentActiveNotesLeadId = id;
    document.getElementById("modal-lead-name").innerText = lead.nome;
    document.getElementById("lead-notes-area").value = lead.observacoes || "";
    document.getElementById("notes-modal").style.display = "flex";
    document.getElementById("lead-notes-area").focus();
};

window.closeNotesModal = function() {
    document.getElementById("notes-modal").style.display = "none";
    currentActiveNotesLeadId = null;
};

async function saveQuickNotes() {
    if (!currentActiveNotesLeadId) return;
    const textValue = document.getElementById("lead-notes-area").value;
    try {
        const docRef = doc(db, "leads", currentActiveNotesLeadId);
        await updateDoc(docRef, { observacoes: textValue });
        window.closeNotesModal();
    } catch(err) {
        console.error("Erro ao salvar observação: ", err);
    }
}

// ==========================================================================
// RENDIMENTO E MÁQUINA DE INSIGHTS FAIXA PRETA (PÁGINA 2)
// ==========================================================================
window.populateSdrFilterOptions = function() {
    const select = document.getElementById("filter-sdr-select");
    if (!select) return;

    const currentValue = select.value;
    const sdrs = [...new Set(localLeadsCache.map(l => l.sdr).filter(name => name && name.trim() !== ""))];
    
    select.innerHTML = `<option value="todos">Todos os SDRs (Visão Geral)</option>`;
    sdrs.forEach(sdrName => {
        select.innerHTML += `<option value="${sdrName}">${sdrName}</option>`;
    });

    if (currentValue && sdrs.includes(currentValue)) {
        select.value = currentValue;
    }
};

window.calculateAdvancedMetrics = function() {
    const selectedSdr = document.getElementById("filter-sdr-select")?.value || "todos";
    const agora = new Date();
    
    const inicioSemana = new Date(agora);
    inicioSemana.setDate(agora.getDate() - agora.getDay());
    inicioSemana.setHours(0,0,0,0);

    const inicioQuinzena = new Date(agora);
    inicioQuinzena.setDate(agora.getDate() - 15);
    inicioQuinzena.setHours(0,0,0,0);

    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

    let faturamentoSemana = 0, totalLeadsSemana = 0, fechadosSemana = 0;
    let faturamentoQuinzena = 0, totalLeadsQuinzena = 0, fechadosQuinzena = 0;
    let faturamentoMes = 0, totalLeadsMes = 0, fechadosMes = 0;

    let totalPitches = 0, fechadosPops = 0;
    let totalDecisoresValidados = 0, totalLeadsComDiag = 0;
    let yaraTotal = 0, yaraFechados = 0;
    let crmTotal = 0, crmFechados = 0;

    // Novos acumuladores para o Raio-X do funil
    let funnelTotal = 0;
    let funnelNoShow = 0;
    let funnelQualificados = 0;
    let funnelReprovados = 0;

    const contagemObjecoes = {
        "Sem Caixa": 0,
        "Sem Decisor": 0,
        "Não tem o Perfil": 0,
        "Pensar / Sumiu": 0,
        "Outro": 0
    };

    localLeadsCache.forEach(lead => {
        if (!lead.dataReuniao) return;
        const dataReuniao = new Date(lead.dataReuniao);
        const valor = parseFloat(lead.valor || 0);
        const passouFiltroSdr = (selectedSdr === "todos" || lead.sdr === selectedSdr);

        if (dataReuniao >= inicioSemana) {
            totalLeadsSemana++;
            if (lead.desfecho === "Fechado" || lead.desfecho === "Downsell") {
                faturamentoSemana += valor;
                fechadosSemana++;
            }
        }
        if (dataReuniao >= inicioQuinzena) {
            totalLeadsQuinzena++;
            if (lead.desfecho === "Fechado" || lead.desfecho === "Downsell") {
                faturamentoQuinzena += valor;
                fechadosQuinzena++;
            }
        }
        if (dataReuniao >= inicioMes) {
            totalLeadsMes++;
            if (lead.desfecho === "Fechado" || lead.desfecho === "Downsell") {
                faturamentoMes += valor;
                fechadosMes++;
            }
        }

        if (passouFiltroSdr) {
            // Conta métricas estruturais do funil
            funnelTotal++;
            if (lead.statusDiag === "No-Show") {
                funnelNoShow++;
            } else if (lead.statusDiag === "Aprovado para Pitch") {
                funnelQualificados++;
            } else if (lead.statusDiag === "Reprovado") {
                funnelReprovados++;
            }

            if (lead.pitch === "Sim") {
                totalPitches++;
                if (lead.desfecho === "Fechado" || lead.desfecho === "Downsell") {
                    fechadosPops++;
                }
            }

            if (lead.decisor) {
                totalLeadsComDiag++;
                if (lead.decisor === "Sim") totalDecisoresValidados++;
            }

            if (lead.origem === "I.A Yara") {
                yaraTotal++;
                if (lead.desfecho === "Fechado" || lead.desfecho === "Downsell") yaraFechados++;
            } else if (lead.origem === "CRM") {
                crmTotal++;
                if (lead.desfecho === "Fechado" || lead.desfecho === "Downsell") crmFechados++;
            }

            if (lead.desfecho === "Perdido" && lead.motivoPerda && contagemObjecoes[lead.motivoPerda] !== undefined) {
                contagemObjecoes[lead.motivoPerda]++;
            }
        }
    });

    if (document.getElementById("metrics-week-money")) document.getElementById("metrics-week-money").innerText = faturamentoSemana.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const txSemana = totalLeadsSemana > 0 ? Math.round((fechadosSemana / totalLeadsSemana) * 100) : 0;
    if (document.getElementById("metrics-week-conv")) document.getElementById("metrics-week-conv").innerText = `Conversão: ${txSemana}%`;

    if (document.getElementById("metrics-fortnight-money")) document.getElementById("metrics-fortnight-money").innerText = faturamentoQuinzena.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const txQuinzena = totalLeadsQuinzena > 0 ? Math.round((fechadosQuinzena / totalLeadsQuinzena) * 100) : 0;
    if (document.getElementById("metrics-fortnight-conv")) document.getElementById("metrics-fortnight-conv").innerText = `Conversão: ${txQuinzena}%`;

    if (document.getElementById("metrics-month-money")) document.getElementById("metrics-month-money").innerText = faturamentoMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const txMes = totalLeadsMes > 0 ? Math.round((fechadosMes / totalLeadsMes) * 100) : 0;
    if (document.getElementById("metrics-month-conv")) document.getElementById("metrics-month-conv").innerText = `Conversão: ${txMes}%`;

    const txPitch = totalPitches > 0 ? Math.round((fechadosPops / totalPitches) * 100) : 0;
    if (document.getElementById("sdr-pitch-rate")) document.getElementById("sdr-pitch-rate").innerText = `${txPitch}%`;
    if (document.getElementById("sdr-pitch-details")) document.getElementById("sdr-pitch-details").innerText = `${fechadosPops} Fechados / ${totalPitches} Pitches`;

    const txDecisor = totalLeadsComDiag > 0 ? Math.round((totalDecisoresValidados / totalLeadsComDiag) * 100) : 0;
    if (document.getElementById("sdr-decisor-rate")) document.getElementById("sdr-decisor-rate").innerText = `${txDecisor}%`;
    if (document.getElementById("sdr-decisor-details")) document.getElementById("sdr-decisor-details").innerText = `${totalDecisoresValidados} Presentes / ${totalLeadsComDiag} Reuniões`;

    // Injeta os novos contadores do funil no HTML
    if (document.getElementById("funnel-total")) document.getElementById("funnel-total").innerText = funnelTotal;
    if (document.getElementById("funnel-noshow")) document.getElementById("funnel-noshow").innerText = funnelNoShow;
    if (document.getElementById("funnel-qualificados")) document.getElementById("funnel-qualificados").innerText = funnelQualificados;
    if (document.getElementById("funnel-reprovados")) document.getElementById("funnel-reprovados").innerText = funnelReprovados;

    const txYara = yaraTotal > 0 ? Math.round((yaraFechados / yaraTotal) * 100) : 0;
    const txCrm = crmTotal > 0 ? Math.round((crmFechados / crmTotal) * 100) : 0;
    if (document.getElementById("channel-yara-rate")) document.getElementById("channel-yara-rate").innerText = `${txYara}%`;
    if (document.getElementById("channel-crm-rate")) document.getElementById("channel-crm-rate").innerText = `${txCrm}%`;

    renderLossHistogram(contagemObjecoes);
};

function renderLossHistogram(objetoPerdas) {
    const container = document.getElementById("loss-reasons-container");
    if (!container) return;

    const valores = Object.values(objetoPerdas);
    const maxPerdas = Math.max(...valores, 1); 
    const totalPerdas = valores.reduce((a, b) => a + b, 0);

    if (totalPerdas === 0) {
        container.innerHTML = `<p class="text-muted" style="padding:10px 0; font-size:13px;">Nenhum lead perdido registrado para este cenário.</p>`;
        return;
    }

    container.innerHTML = "";
    const nomesAmigaveis = {
        "Sem Caixa": "Sem Caixa / Preço",
        "Sem Decisor": "Sem Decisor na Call",
        "Não tem o Perfil": "Não tem Perfil (Frio)",
        "Pensar / Sumiu": "Pediu pra pensar / Sumiu",
        "Outro": "Outros Motivos"
    };

    Object.keys(objetoPerdas).forEach(chave => {
        const quantidade = objetoPerdas[chave];
        const percentualBarra = (quantidade / maxPerdas) * 100;

        const row = document.createElement("div");
        row.className = "rk-row";
        row.innerHTML = `
            <div class="rk-label">${nomesAmigaveis[chave] || chave}</div>
            <div class="rk-bar-bg">
                <div class="rk-bar-fill" style="width: ${percentualBarra}%;"></div>
            </div>
            <div class="rk-count">${quantidade}</div>
        `;
        container.appendChild(row);
    });
}

// ==========================================================================
// MOTOR DE INTEGRAÇÃO EXCLUSIVO COM O GOOGLE CALENDAR (ANTI-DUPLICAÇÃO)
// ==========================================================================
function gapiLoad() { gapi.load('client', initializeGapiClient); }
async function initializeGapiClient() {
    await gapi.client.init({ discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"] });
    gapiInited = true;
}
function gisInit() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // Definido dinamicamente na execução
    });
    gisInited = true;
}

window.handleAuthClick = function() {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) throw (resp);
        await listUpcomingEvents();
    };

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        tokenClient.requestAccessToken({prompt: ''});
    }
};

async function listUpcomingEvents() {
    try {
        const agora = new Date();
        const daquiUmaSemana = new Date();
        daquiUmaSemana.setDate(agora.getDate() + 7);

        const response = await gapi.client.calendar.events.list({
            'calendarId': 'primary',
            'timeMin': agora.toISOString(),
            'timeMax': daquiUmaSemana.toISOString(),
            'showDeleted': false,
            'singleEvents': true,
            'orderBy': 'startTime',
        });

        const events = response.result.items;
        const container = document.getElementById('calendar-events-list');
        if (!container) return;
        
        container.innerHTML = '';

        if (!events || events.length === 0) {
            container.innerHTML = '<p class="text-muted" style="padding:20px; text-align:center;">Nenhum evento encontrado nos próximos 7 dias.</p>';
            document.getElementById('calendar-modal').style.display = 'flex';
            return;
        }

        // Isola os IDs dos eventos que já estão salvos no Firestore para travar duplicações
        const salvosCalendarIds = localLeadsCache.map(l => l.calendarEventId).filter(id => id);

        events.forEach((event) => {
            const start = event.start.dateTime || event.start.date;
            const dataObjeto = new Date(start);
            const dataTexto = dataObjeto.toLocaleDateString('pt-BR') + ' ' + dataObjeto.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
            
            const titulo = event.summary || 'Reunião Sem Título';
            
            // Sugere de forma inteligente se o nome contiver gatilhos da agência
            const ehAgenciaRei = titulo.toLowerCase().includes('rei') || titulo.toLowerCase().includes('diagnostico') || titulo.toLowerCase().includes('call');
            const classeLinha = ehAgenciaRei ? 'calendar-import-row suggested' : 'calendar-import-row';

            const jaImportado = salvosCalendarIds.includes(event.id);

            const div = document.createElement('div');
            div.className = classeLinha;
            div.innerHTML = `
                <div style="max-width:70%;">
                    <strong style="font-size:13px; color:var(--text-primary); display:block;">${titulo}</strong>
                    <span style="font-size:11px; color:var(--text-muted);"><i class="fa-solid fa-clock"></i> ${dataTexto}</span>
                </div>
                <div>
                    ${jaImportado 
                        ? `<span class="badge-count" style="background-color:rgba(255,255,255,0.05); color:var(--text-muted);">Importado</span>`
                        : `<button class="btn-sm-note" onclick="window.importEventToForm('${btoa(unescape(encodeURIComponent(JSON.stringify(event))))}')" style="color:var(--neon-accent); border-color:var(--neon-accent);"><i class="fa-solid fa-cloud-arrow-down"></i> Puxar</button>`
                    }
                </div>
            `;
            container.appendChild(div);
        });

        document.getElementById('calendar-modal').style.display = 'flex';

    } catch (err) {
        console.error('Erro ao ler agenda: ', err);
    }
}

window.importEventToForm = function(base64Event) {
    const event = JSON.parse(decodeURIComponent(escape(atob(base64Event))));
    document.getElementById('calendar-modal').style.display = 'none';
    
    // Abre o formulário limpando os dados antigos e pré-preenchendo com os do calendário
    window.openNewLeadModal();
    
    document.getElementById('form-nome').value = event.summary || '';
    
    const start = event.start.dateTime || event.start.date;
    if(start) {
        // Converte para o padrão aceito pelo input datetime-local (YYYY-MM-DDTHH:MM)
        const d = new Date(start);
        const pad = (n) => n.toString().padStart(2, '0');
        const formatoInput = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        document.getElementById('form-data-reuniao').value = formatoInput;
    }

    // Vincula o ID único do calendário dinamicamente antes de submeter ao Firebase
    const form = document.getElementById('lead-form');
    
    // Remove campo antigo se houver para evitar sobreposição
    const antigoIdInput = document.getElementById('form-calendar-id-holder');
    if(antigoIdInput) antigoIdInput.remove();

    const hiddenIdInput = document.createElement('input');
    hiddenIdInput.type = 'hidden';
    hiddenIdInput.id = 'form-calendar-id-holder';
    hiddenIdInput.value = event.id;
    form.appendChild(hiddenIdInput);

    // Ajusta o comportamento de salvar para incluir o id do calendário
    const originalSubmit = window.handleLeadFormSubmit;
    window.handleLeadFormSubmit = async function(e) {
        e.preventDefault();
        
        const id = document.getElementById("form-lead-id").value;
        const leadData = {
            nome: document.getElementById("form-nome").value,
            empresa: document.getElementById("form-empresa").value,
            faturamento: document.getElementById("form-faturamento").value,
            sdr: document.getElementById("form-sdr").value.trim() || "Direto",
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
            calendarEventId: event.id, // O segredo anti-duplicação salvo na nuvem
            observacoes: id ? (localLeadsCache.find(l => l.id === id)?.observacoes || "") : ""
        };

        try {
            if (id) {
                await updateDoc(doc(db, "leads", id), leadData);
            } else {
                await addDoc(leadsCollection, leadData);
            }
            window.closeLeadModal();
            // Restaura a função original limpa
            window.handleLeadFormSubmit = originalSubmit;
        } catch (err) {
            console.error(err);
        }
    };
};