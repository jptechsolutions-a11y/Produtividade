// --- CONFIGURAÇÃO ---
// Esta é a parte mais importante para funcionar na Vercel:
// O código tenta ler as variáveis de ambiente (process.env.NEXT_PUBLIC...).
// Se não encontrar (ex: rodando local sem servidor), ele entra em modo MOCK (demonstração).
const SUPABASE_URL = typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_SUPABASE_URL 
    ? process.env.NEXT_PUBLIC_SUPABASE_URL 
    : ""; 

const SUPABASE_KEY = typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY 
    ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY 
    : ""; 

// --- STATE MANAGEMENT ---
const AppState = {
    data: [], // Dados brutos
    filteredData: [], // Dados filtrados
    metrics: [], // Métricas calculadas por produtivo
    filters: {
        filial: 'all',
        data: new Date().toISOString().split('T')[0], // Hoje
        linha: 'all'
    },
    mode: 'volume', // 'volume' ou 'visitas'
    user: 'admin', // Usuário padrão (bypass do login)
    columns: {
        'PRODUTIVO': { label: 'Produtivo', visible: true },
        'EQUIPE': { label: 'Equipe', visible: false },
        'QTDVOLUME': { label: 'Volumes', visible: true },
        'QTD_VISITAS': { label: 'Visitas', visible: true },
        'HORAS_TRABALHADAS': { label: 'Horas Trab.', visible: true },
        'PRODUTIVIDADE_HORA': { label: 'Vol/Hora', visible: true },
        'VISITAS_HORA': { label: 'Visitas/Hora', visible: true },
        'META': { label: 'Meta', visible: true },
        'STATUS': { label: 'Status', visible: true }
    }
};

let supabase = null;

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    
    // Login foi removido, então iniciamos o carregamento direto
    loadData();
    
    // Listeners dos Filtros
    document.getElementById('filterFilial').addEventListener('change', (e) => applyFilter('filial', e.target.value));
    document.getElementById('filterDate').addEventListener('change', (e) => applyFilter('data', e.target.value));
    document.getElementById('filterLinha').addEventListener('change', (e) => applyFilter('linha', e.target.value));
    
    // Define o filtro de data para hoje
    document.getElementById('filterDate').value = AppState.filters.data;
});

function initSupabase() {
    if (SUPABASE_URL && SUPABASE_KEY) {
        try {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log("JP PRODUTIVIDADE: Conexão Supabase iniciada via Vercel Env Vars.");
        } catch (e) {
            console.error("Erro ao iniciar Supabase:", e);
        }
    } else {
        console.warn("JP PRODUTIVIDADE: Chaves não encontradas. Rodando em modo MOCK (Dados Fictícios).");
    }
}

function logout() {
    // Apenas recarrega a página para resetar (simples reload)
    location.reload();
}

// --- DATA FETCHING (CORE) ---
async function loadData() {
    showLoading(true);

    try {
        let rawData = [];

        if (supabase) {
            // Conexão Real com Supabase
            // Buscamos tudo da tabela 'sepprodutividade'
            const { data, error } = await supabase
                .from('sepprodutividade')
                .select('*');
                
            if (error) throw error;
            rawData = data;
        } else {
            // Gerador de Dados Fakes (Caso não tenha chaves configuradas)
            rawData = generateMockData();
        }

        AppState.data = rawData;
        
        // Popula os selects de filtro com base nos dados recebidos
        populateFiltersUI(rawData);
        
        // Aplica filtros iniciais e calcula métricas
        processData();

    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        alert("Erro ao carregar dados. Verifique o console.");
    } finally {
        showLoading(false);
    }
}

// --- CÁLCULOS NO FRONTEND (SUBSTITUIÇÃO DA VIEW) ---
function processData() {
    // 1. Filtragem Bruta
    const filtered = AppState.data.filter(row => {
        // Normalização de data (Assumindo string 'YYYY-MM-DD' ou ISO)
        const rowDate = row.DTAINICIO ? row.DTAINICIO.substring(0, 10) : '';
        const dateMatch = rowDate === AppState.filters.data;
        const filialMatch = AppState.filters.filial === 'all' || String(row.NROEMPRESA) === AppState.filters.filial;
        const linhaMatch = AppState.filters.linha === 'all' || row.LINHA_SEPARACAO === AppState.filters.linha;

        return dateMatch && filialMatch && linhaMatch;
    });

    AppState.filteredData = filtered;

    // 2. Agrupamento e Cálculos (A mágica acontece aqui)
    const metricsMap = new Map();

    filtered.forEach(row => {
        const key = row.CODPRODUTIVO; // Agrupar por ID do produtivo
        
        if (!metricsMap.has(key)) {
            metricsMap.set(key, {
                CODPRODUTIVO: row.CODPRODUTIVO,
                PRODUTIVO: row.PRODUTIVO || 'Desconhecido',
                NROEMPRESA: row.NROEMPRESA,
                LINHA_SEPARACAO: row.LINHA_SEPARACAO,
                EQUIPE: row.EQUIPE,
                QTDVOLUME: 0,
                QTD_VISITAS: 0,
                // Controle de tempo (simplificado para o exemplo)
                // Na vida real, você somaria intervalos (DTAFIM - DTAINICIO) de cada tarefa
                startTime: row.HORAINICIO, // Simplificação: pega o menor inicio
                endTime: row.HORAFIM,     // e maior fim
                tasks: [] // Para calculo preciso de tempo se necessário
            });
        }

        const entry = metricsMap.get(key);
        entry.QTDVOLUME += (parseInt(row.QTDVOLUME) || 0);
        entry.QTD_VISITAS += (parseInt(row.QTD_VISITAS) || 0);
        
        // Lógica de tempo: Atualiza para pegar o range total do dia
        if (row.HORAINICIO < entry.startTime) entry.startTime = row.HORAINICIO;
        if (row.HORAFIM > entry.endTime) entry.endTime = row.HORAFIM;
    });

    // 3. Finalizar métricas (Horas, Médias)
    const metricsArray = Array.from(metricsMap.values()).map(m => {
        // Cálculo de horas trabalhadas (hh:mm -> decimal)
        const hours = calculateHoursDiff(m.startTime, m.endTime);
        
        // Evita divisão por zero ou horas muito pequenas
        const safeHours = hours > 0 ? hours : 1; 

        const prodHora = Math.round(m.QTDVOLUME / safeHours);
        const visitasHora = Math.round(m.QTD_VISITAS / safeHours);

        // META DA FILIAL (Exemplo fixo, pode vir do banco depois)
        const metaVolume = 120; 
        
        return {
            ...m,
            HORAS_TRABALHADAS: hours.toFixed(2),
            PRODUTIVIDADE_HORA: prodHora,
            VISITAS_HORA: visitasHora,
            META: metaVolume,
            PERC_META: Math.round((prodHora / metaVolume) * 100),
            STATUS: prodHora >= metaVolume ? 'ACIMA' : 'ABAIXO'
        };
    });

    // Ordenar pelo modo atual (Volume ou Visitas)
    metricsArray.sort((a, b) => b.PRODUTIVIDADE_HORA - a.PRODUTIVIDADE_HORA);

    AppState.metrics = metricsArray;

    updateDashboard();
}

function calculateHoursDiff(start, end) {
    if (!start || !end) return 0;
    // Formato esperado HH:MM:SS
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff < 0) diff += 24 * 60; // Tratamento virada de dia simples
    
    return diff / 60;
}

// --- UI UPDATES ---
function updateDashboard() {
    updateKPIs();
    renderChart();
    renderTable();
    renderTop5();
}

function updateKPIs() {
    const totalVol = AppState.metrics.reduce((acc, curr) => acc + curr.QTDVOLUME, 0);
    const totalVisitas = AppState.metrics.reduce((acc, curr) => acc + curr.QTD_VISITAS, 0);
    
    // Média da Produtividade por Hora da Equipe
    const avgProd = AppState.metrics.length ? 
        Math.round(AppState.metrics.reduce((acc, c) => acc + c.PRODUTIVIDADE_HORA, 0) / AppState.metrics.length) : 0;
    
    const countAcima = AppState.metrics.filter(m => m.STATUS === 'ACIMA').length;
    
    // Atualiza DOM
    if (AppState.mode === 'volume') {
        document.getElementById('kpiTotal').innerText = totalVol.toLocaleString();
        document.getElementById('labelProdHora').innerText = "Média Volumes/Hora";
        document.getElementById('kpiProdHora').innerText = avgProd;
        document.getElementById('kpiMeta').innerText = "120"; // Exemplo
        
        const percGlobal = Math.round((avgProd / 120) * 100);
        document.getElementById('kpiPercMeta').innerText = `${percGlobal}%`;
        document.getElementById('kpiProgressBar').style.width = `${Math.min(percGlobal, 100)}%`;
        
        // Cor da barra
        const bar = document.getElementById('kpiProgressBar');
        if(percGlobal >= 100) { bar.className = "h-2 rounded-full bg-green-500"; }
        else if(percGlobal >= 80) { bar.className = "h-2 rounded-full bg-yellow-500"; }
        else { bar.className = "h-2 rounded-full bg-red-500"; }

    } else {
        // Modo Visitas
        document.getElementById('kpiTotal').innerText = totalVisitas.toLocaleString();
        document.getElementById('labelProdHora').innerText = "Média Visitas/Hora";
        // ... lógica similar para visitas
    }

    document.getElementById('kpiAcimaMedia').innerText = countAcima;
    document.getElementById('kpiAbaixoMedia').innerText = AppState.metrics.length - countAcima;
}

// --- CHARTS (Chart.js) ---
let mainChartInstance = null;

function renderChart() {
    const ctx = document.getElementById('mainChart').getContext('2d');
    
    // Preparar dados
    const chartData = AppState.metrics.slice(0, 20); // Top 20 para não poluir
    
    const labels = chartData.map(m => m.PRODUTIVO.split(' ')[0]); // Apenas primeiro nome
    const dataValues = chartData.map(m => AppState.mode === 'volume' ? m.PRODUTIVIDADE_HORA : m.VISITAS_HORA);
    const metaValues = chartData.map(m => m.META);

    if (mainChartInstance) mainChartInstance.destroy();

    mainChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: AppState.mode === 'volume' ? 'Vol/Hora' : 'Visitas/Hora',
                    data: dataValues,
                    backgroundColor: dataValues.map(v => v >= 120 ? '#00D4AA' : '#F77F00'),
                    borderRadius: 4
                },
                {
                    label: 'Meta',
                    data: metaValues,
                    type: 'line',
                    borderColor: '#023047',
                    borderDash: [5, 5],
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false } }
            },
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function renderTop5() {
    const container = document.getElementById('top5List');
    const top5 = AppState.metrics.slice(0, 5);
    
    container.innerHTML = top5.map((m, index) => `
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg border-l-4 ${m.STATUS === 'ACIMA' ? 'border-green-500' : 'border-yellow-500'}">
            <div class="flex items-center">
                <span class="font-bold text-gray-400 mr-3">#${index + 1}</span>
                <div>
                    <p class="font-bold text-sm text-gray-800">${m.PRODUTIVO}</p>
                    <p class="text-xs text-gray-500">${m.EQUIPE || 'Geral'}</p>
                </div>
            </div>
            <div class="text-right">
                <span class="block font-bold text-lg text-primary">${m.PRODUTIVIDADE_HORA}</span>
                <span class="text-xs text-gray-400">vol/h</span>
            </div>
        </div>
    `).join('');
}

// --- TABELA DINÂMICA ---
function renderTable() {
    const thead = document.getElementById('tableHeader');
    const tbody = document.getElementById('tableBody');
    
    // Render Headers
    thead.innerHTML = '';
    Object.keys(AppState.columns).forEach(key => {
        if (AppState.columns[key].visible) {
            thead.innerHTML += `<th class="px-6 py-3 cursor-pointer hover:bg-gray-100" onclick="sortTable('${key}')">${AppState.columns[key].label}</th>`;
        }
    });

    // Render Body
    tbody.innerHTML = AppState.metrics.map(row => {
        let html = '<tr class="bg-white border-b hover:bg-gray-50">';
        Object.keys(AppState.columns).forEach(key => {
            if (AppState.columns[key].visible) {
                let value = row[key];
                
                // Formatações Específicas
                if (key === 'STATUS') {
                    const badgeClass = value === 'ACIMA' ? 'badge-up' : 'badge-down';
                    value = `<span class="badge ${badgeClass}">${value}</span>`;
                }

                html += `<td class="px-6 py-4">${value}</td>`;
            }
        });
        html += '</tr>';
        return html;
    }).join('');
}

function toggleColumns() {
    const container = document.getElementById('columnConfig');
    container.classList.toggle('hidden');
    
    // Render checkboxes
    container.innerHTML = Object.keys(AppState.columns).map(key => `
        <label class="flex items-center space-x-2">
            <input type="checkbox" ${AppState.columns[key].visible ? 'checked' : ''} 
                onchange="updateColumnVisibility('${key}', this.checked)">
            <span>${AppState.columns[key].label}</span>
        </label>
    `).join('');
}

function updateColumnVisibility(key, visible) {
    AppState.columns[key].visible = visible;
    renderTable();
}

// --- UTILS ---
function applyFilter(type, value) {
    AppState.filters[type] = value;
    processData();
}

function setMetricMode(mode) {
    AppState.mode = mode;
    // Atualiza visual dos botões
    if(mode === 'volume') {
        document.getElementById('btnModeVolume').className = "flex-1 text-xs py-1 rounded bg-white shadow font-bold text-primary";
        document.getElementById('btnModeVisitas').className = "flex-1 text-xs py-1 rounded text-gray-600";
    } else {
        document.getElementById('btnModeVolume').className = "flex-1 text-xs py-1 rounded text-gray-600";
        document.getElementById('btnModeVisitas').className = "flex-1 text-xs py-1 rounded bg-white shadow font-bold text-primary";
    }
    processData();
}

function showLoading(show) {
    const el = document.getElementById('loadingOverlay');
    if(show) el.classList.remove('hidden');
    else el.classList.add('hidden');
}

function switchView(viewName) {
    // Simples toggle para demo
    if(viewName === 'analise') {
        alert("Navegando para visualização detalhada da tabela...");
    }
}

// --- MOCK DATA GENERATOR ---
function generateMockData() {
    const count = 150; // Registros
    const filiais = [101, 102, 464];
    const linhas = ['MERCEARIA', 'PERECIVEIS', 'FLV', 'ALTO GIRO'];
    const produtivos = [
        'JOAO SILVA', 'MARIA SANTOS', 'PEDRO OLIVEIRA', 'ANA SOUZA', 
        'CARLOS LIMA', 'FERNANDA COSTA', 'LUCAS PEREIRA', 'JULIA RODRIGUES'
    ];
    
    const data = [];
    const today = new Date().toISOString().split('T')[0];

    for (let i = 0; i < count; i++) {
        const produtivo = produtivos[Math.floor(Math.random() * produtivos.length)];
        // Simular turnos
        const startHour = 8 + Math.floor(Math.random() * 8); 
        
        data.push({
            id: crypto.randomUUID(),
            NROEMPRESA: filiais[Math.floor(Math.random() * filiais.length)],
            CODPRODUTIVO: produtivos.indexOf(produtivo) + 1000,
            PRODUTIVO: produtivo,
            LINHA_SEPARACAO: linhas[Math.floor(Math.random() * linhas.length)],
            EQUIPE: 'TURNO A',
            QTDVOLUME: Math.floor(Math.random() * 200) + 50,
            QTD_VISITAS: Math.floor(Math.random() * 50) + 10,
            DTAINICIO: today,
            DTAFIM: today,
            HORAINICIO: `${startHour}:00:00`,
            HORAFIM: `${startHour + 1}:30:00`, // Tarefas de ~1.5h
        });
    }
    return data;
}

function populateFiltersUI(data) {
    const filiais = [...new Set(data.map(d => d.NROEMPRESA))];
    const selFilial = document.getElementById('filterFilial');
    const firstOpt = selFilial.options[0];
    selFilial.innerHTML = '';
    selFilial.appendChild(firstOpt);
    filiais.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f;
        opt.text = `Filial ${f}`;
        selFilial.appendChild(opt);
    });

    const linhas = [...new Set(data.map(d => d.LINHA_SEPARACAO))];
    const selLinha = document.getElementById('filterLinha');
    const firstOptL = selLinha.options[0];
    selLinha.innerHTML = '';
    selLinha.appendChild(firstOptL);
    linhas.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l;
        opt.text = l;
        selLinha.appendChild(opt);
    });
}
