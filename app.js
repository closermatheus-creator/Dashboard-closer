import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
//  COLE AS SUAS CHAVES DO FIREBASE AQUI EM BAIXO:
// ==========================================
const firebaseConfig = {
  apiKey: "SEU_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
let listaGlobalCalls = [];

let chartSdrInstance = null;
let chartPerdasInstance = null;
let modoEscuroAtivo = true;

// Inicializar eventos quando a página carregar
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('callForm').addEventListener('submit', salvarCall);
    document.getElementById('nota_pitch_01').addEventListener('input', validarRegrasNota);
    document.getElementById('resultado').addEventListener('change', ajustarCamposFinais);
    renderizarDashboard();
});

window.alternarModo = function() {
    modoEscuroAtivo = !modoEscuroAtivo;
    const btn = document.getElementById('btnModo');
    const body = document.getElementById('bodyApp');
    const nav = document.getElementById('navApp');
    const cardForm = document.getElementById('cardForm');
    const cardTabela = document.getElementById('cardTabela');
    const topoTabela = document.getElementById('topoTabela');
    const headerTabela = document.getElementById('headerTabela');
    const tituloApp = document.getElementById('tituloApp');
    const inputs = document.querySelectorAll('.input-field');
    const boxDecisor = document.getElementById('boxDecisor');
    const cardsMetricas = document.querySelectorAll('.card-metric');

    if (!modoEscuroAtivo) {
        btn.innerText = "🌙 Modo Escuro";
        btn.className = "bg-gray-800 text-white text-sm py-1.5 px-3 rounded-lg transition cursor-pointer";
        body.className = "bg-gray-100 text-gray-800 font-sans min-h-screen transition-colors duration-300";
        nav.className = "bg-white border-b border-gray-200 p-4 sticky top-0 z-50 transition-colors duration-300 shadow-sm";
        cardForm.className = "bg-white p-6 rounded-xl border border-gray-200 shadow-lg lg:col-span-1 h-fit transition-colors duration-300";
        cardTabela.className = "bg-white rounded-xl border border-gray-200 shadow overflow-hidden transition-colors duration-300";
        topoTabela.className = "p-4 bg-gray-50 border-b border-gray-200 transition-colors duration-300";
        headerTabela.className = "bg-gray-100 text-gray-600 border-b border-gray-200 uppercase tracking-wider font-bold text-[10px]";
        tituloApp.className = "text-lg font-bold tracking-wider text-gray-900";
        boxDecisor.className = "flex items-center space-x-3 bg-gray-50 p-3 rounded border border-gray-200";
        
        inputs.forEach(i => {
            i.className = "w-full bg-gray-50 input-field border border-gray-200 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-600 transition";
        });
        cardsMetricas.forEach(c => {
            c.className = "card-metric bg-white p-4 rounded-xl border border-gray-200 shadow flex flex-col justify-between transition-colors duration-300";
        });
    } else {
        btn.innerText = "☀️ Modo Claro";
        btn.className = "bg-[#0f111a] text-[#dbdee9] text-sm py-1.5 px-3 rounded-lg border border-[#23283d] transition cursor-pointer";
        body.className = "bg-[#0f111a] text-[#dbdee9] font-sans min-h-screen transition-colors duration-300";
        nav.className = "bg-[#161925] border-b border-[#23283d] p-4 sticky top-0 z-50 transition-colors duration-300";
        cardForm.className = "bg-[#161925] p-6 rounded-xl border border-[#23283d] shadow-2xl lg:col-span-1 h-fit transition-colors duration-300";
        cardTabela.className = "bg-[#161925] rounded-xl border border-[#23283d] shadow overflow-hidden transition-colors duration-300";
        topoTabela.className = "p-4 bg-[#1b1f2e] border-b border-[#23283d] transition-colors duration-300";
        headerTabela.className = "bg-[#0f111a] text-gray-400 border-b border-[#23283d] uppercase tracking-wider font-bold text-[10px]";
        tituloApp.className = "text-lg font-bold tracking-wider text-[#ffffff]";
        boxDecisor.className = "flex items-center space-x-3 bg-[#0f111a] p-3 rounded border border-[#23283d]";

        inputs.forEach(i => {
            i.className = "w-full bg-[#0f111a] input-field border border-[#23283d] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00f0ff] transition";
        });
        cardsMetricas.forEach(c => {
            c.className = "card-metric bg-[#161925] p-4 rounded-xl border border-[#23283d] shadow flex flex-col justify-between transition-colors duration-300";
        });
    }
    renderizarDashboard();
}

window.validarRegrasNota = function() {
    const nota = parseInt(document.getElementById('nota_pitch_01').value) || 0;
    const camposAvancados = document.getElementById('camposAvancados');
    const campoPerda = document.getElementById('campoPerda');
    const resultado = document.getElementById('resultado');

    if (nota < 7) {
        camposAvancados.classList.add('hidden');
        campoPerda.classList.remove('hidden');
        resultado.value = "Perdido";
        document.getElementById('valor_contrato').value = 0;
        document.getElementById('fase_maxima').value = "Pitch 01";
    } else {
        camposAvancados.classList.remove('hidden');
        campoPerda.classList.add('hidden');
        ajustarCamposFinais();
    }
}

window.ajustarCamposFinais = function() {
    const resultado = document.getElementById('resultado').value;
    const campoValor = document.getElementById('campoValor');
    const campoPerda = document.getElementById('campoPerda');

    if (resultado === "Perdido") {
        campoValor.classList.add('hidden');
        document.getElementById('valor_contrato').value = 0;
        campoPerda.classList.remove('hidden');
    } else {
        campoValor.classList.remove('hidden');
        campoPerda.classList.add('hidden');
    }
}

window.salvarCall = async function(e) {
    e.preventDefault();
    const nota = parseInt(document.getElementById('nota_pitch_01').value) || 0;
    const dados = {
        data_call: new Date().toLocaleDateString('pt-BR'),
        timestamp: new Date().getTime(),
        nome_lead: document.getElementById('nome_lead').value,
        nome_empresa: document.getElementById('nome_empresa').value,
        faturamento: parseFloat(document.getElementById('faturamento').value) || 0,
        origem_sdr: document.getElementById('origem_sdr').value,
        decisor_presente: document.getElementById('decisor_presente').checked,
        status_diagnostico: document.getElementById('status_diagnostico').value,
        nota_pitch_01: nota,
        fase_maxima: nota < 7 ? "Pitch 01" : document.getElementById('fase_maxima').value,
        resultado: nota < 7 ? "Perdido" : document.getElementById('resultado').value,
        valor_contrato: nota < 7 ? 0 : parseFloat(document.getElementById('valor_contrato').value) || 0,
        motivo_perda: (nota < 7 || document.getElementById('resultado').value === "Perdido") ? document.getElementById('motivo_perda').value : "",
        observacoes: document.getElementById('observacoes').value
            };

    try {
        await addDoc(collection(db, "calls"), dados);
        alert("🚀 Call salva com sucesso no ecossistema!");
        document.getElementById('callForm').reset();
        document.getElementById('campoPerda').classList.add('hidden');
        document.getElementById('camposAvancados').classList.remove('hidden');
        renderizarDashboard();
    } catch (error) {
        console.error("Erro ao salvar:", error);
    }
}

async function renderizarDashboard() {
    const q = query(collection(db, "calls"), orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    
    listaGlobalCalls = [];
    let totalFaturamento = 0;
    let totalLeadsBruto = 0;
    let totalAprovadosDiagnostico = 0;
    let totalFechados = 0;

    let sdrStats = { "I.A Yara": { total: 0, fechado: 0 }, "CRM": { total: 0, fechado: 0 } };
    let perdaStats = {};

    const tbody = document.getElementById('tabelaCalls');
    tbody.innerHTML = "";

    snapshot.forEach((doc) => {
        const item = doc.data();
        listaGlobalCalls.push(item);

        totalLeadsBruto++;
        if (item.status_diagnostico === "Aprovado") totalAprovadosDiagnostico++;
        if (item.resultado === "Fechado" || item.resultado === "Downsell") {
            totalFechados++;
            totalFaturamento += item.valor_contrato;
        }

        if (sdrStats[item.origem_sdr]) {
            sdrStats[item.origem_sdr].total++;
            if (item.resultado === "Fechado" || item.resultado === "Downsell") {
                sdrStats[item.origem_sdr].fechado++;
            }
        }

        if (item.resultado === "Perdido" && item.motivo_perda) {
            perdaStats[item.motivo_perda] = (perdaStats[item.motivo_perda] || 0) + 1;
        }

        const tr = document.createElement('tr');
        tr.className = modoEscuroAtivo 
            ? "hover:bg-[#1b1f2e] transition border-b border-[#23283d] text-gray-300" 
            : "hover:bg-gray-50 transition border-b border-gray-200 text-gray-700";
        
        let badgeResultado = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950/50 text-red-400 border border-red-500/20">Perdido</span>`;
        if (item.resultado === "Fechado") badgeResultado = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/50 text-emerald-400 border border-emerald-500/20">Fechado</span>`;
        if (item.resultado === "Downsell") badgeResultado = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950/50 text-blue-400 border border-blue-500/20">Downsell</span>`;

        tr.innerHTML = `
            <td class="p-3 text-gray-500">${item.data_call}</td>
            <td class="p-3 font-medium ${modoEscuroAtivo ? 'text-white':'text-gray-900'}">${item.nome_lead} <span class="text-gray-400 text-[11px] block">${item.nome_empresa}</span></td>
            <td class="p-3">${item.origem_sdr}</td>
            <td class="p-3">${item.status_diagnostico === "Aprovado" ? '🔹 Aprovado' : '🔸 Reprovado'}</td>
            <td class="p-3 font-bold text-[#00f0ff]">${item.nota_pitch_01}/10</td>
            <td class="p-3">${badgeResultado}</td>
            <td class="p-3 font-bold">R$ ${item.valor_contrato.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('cardFaturamento').innerText = `R$ ${totalFaturamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    const taxaConversaoPreta = totalAprovadosDiagnostico > 0 ? Math.round((totalFechados / totalAprovadosDiagnostico) * 100) : 0;
    document.getElementById('cardConversao').innerText = `${taxaConversaoPreta}%`;
    const taxaAproveitamentoSdr = totalLeadsBruto > 0 ? Math.round((totalAprovadosDiagnostico / totalLeadsBruto) * 100) : 0;
    document.getElementById('cardSdr').innerText = `${taxaAproveitamentoSdr}%`;

    const corTextoLabel = modoEscuroAtivo ? '#dbdee9' : '#374151';

    if (chartSdrInstance) chartSdrInstance.destroy();
    if (chartPerdasInstance) chartPerdasInstance.destroy();

    const ctxSdr = document.getElementById('graficoSdr').getContext('2d');
    chartSdrInstance = new Chart(ctxSdr, {
        type: 'bar',
        data: {
            labels: ['I.A Yara', 'CRM'],
                    datasets: [
                { label: 'Total Recebido', data: [sdrStats["I.A Yara"].total, sdrStats["CRM"].total], backgroundColor: '#1d4ed8' },
                { label: 'Fechados', data: [sdrStats["I.A Yara"].fechado, sdrStats["CRM"].fechado], backgroundColor: '#00f0ff' }
                    ]
                },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { ticks: { color: corTextoLabel } }, y: { ticks: { color: corTextoLabel } } }, plugins: { legend: { labels: { color: corTextoLabel } } } }
            });

    const ctxPerdas = document.getElementById('graficoPerdas').getContext('2d');
    chartPerdasInstance = new Chart(ctxPerdas, {
        type: 'doughnut',
        data: {
            labels: Object.keys(perdaStats),
            datasets: [{
                data: Object.values(perdaStats),
                backgroundColor: ['#00f0ff', '#1e40af', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'],
                borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: corTextoLabel, boxWidth: 10, font: { size: 9 } } } } }
    });
}

window.exportarExcel = function() {
    if (listaGlobalCalls.length === 0) return;
    let csv = "\uFEFFData;Lead;Empresa;Faturamento;SDR;Decisor;Diagnostico;Nota Pitch;Fase Maxima;Resultado;Valor;Motivo Perda;Observacoes\n";
    listaGlobalCalls.forEach(c => {
        csv += `${c.data_call};${c.nome_lead};${c.nome_empresa};${c.faturamento};${c.origem_sdr};${c.decisor_presente ? 'Sim':'Não'};${c.status_diagnostico};${c.nota_pitch_01};${c.fase_maxima};${c.resultado};${c.valor_contrato};${c.motivo_perda || ''};${c.observacoes || ''}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Planilha_Closer_${new Date().toLocaleDateString('pt-BR')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}