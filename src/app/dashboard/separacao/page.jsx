// src/app/dashboard/separacao/page.jsx
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, Package, Users, BarChart3, Calendar, 
  Download, Settings, Search, ChevronDown, ArrowUp, ArrowDown, Database 
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts';

// Importação dos Módulos Separados
import { SupabaseService } from '../../../services/supabaseService';
import KPICard from '../../../components/KPICard';

export default function SeparacaoPage() {
  const [loading, setLoading] = useState(false);
  const [rawData, setRawData] = useState([]);
  
  // -- ESTADO DE FILTROS --
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    filial: '1',
    produtivo: ''
  });

  // -- ESTADO DA TABELA --
  const [tableConfig, setTableConfig] = useState({
    visibleColumns: ['PRODUTIVO', 'DTAINICIO', 'QTDVOLUME', 'QTD_VISITAS', 'horasTrabalhadas', 'volumeHora', 'visitasHora'],
    sortColumn: 'volumeHora',
    sortDirection: 'desc'
  });
  const [showColumnModal, setShowColumnModal] = useState(false);

  // Colunas disponíveis
  const availableColumns = [
    { key: 'NROEMPRESA', label: 'Filial' },
    { key: 'PRODUTIVO', label: 'Produtivo' },
    { key: 'DTAINICIO', label: 'Data' },
    { key: 'LINHA_SEPARACAO', label: 'Linha' },
    { key: 'QTDVOLUME', label: 'Volume' },
    { key: 'QTD_VISITAS', label: 'Visitas' },
    { key: 'horasTrabalhadas', label: 'Horas Trab.' },
    { key: 'volumeHora', label: 'Vol/Hora' },
    { key: 'visitasHora', label: 'Visitas/Hora' },
  ];

  // -- FETCH DATA --
  useEffect(() => {
    fetchData();
  }, [filters.startDate, filters.endDate, filters.filial]);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await SupabaseService.fetchSeparacao(filters);
    if (error) console.error("Erro ao buscar dados:", error);
    else setRawData(data);
    setLoading(false);
  };

  // -- USE MEMO PARA CÁLCULOS AGREGADOS (DASHBOARD) --
  const stats = useMemo(() => {
    const totalVolume = rawData.reduce((acc, curr) => acc + curr.qtdVolume, 0);
    const totalVisitas = rawData.reduce((acc, curr) => acc + curr.qtdVisitas, 0);
    const totalHoras = rawData.reduce((acc, curr) => acc + curr.horasTrabalhadas, 0);
    
    const mediaVolumeHora = totalHoras > 0 ? (totalVolume / totalHoras) : 0;
    const mediaVisitasHora = totalHoras > 0 ? (totalVisitas / totalHoras) : 0;

    // Ranking Top 5
    const porProdutivo = rawData.reduce((acc, curr) => {
      if (!acc[curr.PRODUTIVO]) {
        acc[curr.PRODUTIVO] = { nome: curr.PRODUTIVO, volume: 0, horas: 0, visitas: 0 };
      }
      acc[curr.PRODUTIVO].volume += curr.qtdVolume;
      acc[curr.PRODUTIVO].visitas += curr.qtdVisitas;
      acc[curr.PRODUTIVO].horas += curr.horasTrabalhadas;
      return acc;
    }, {});

    const ranking = Object.values(porProdutivo)
      .map(p => ({ ...p, mediaHora: p.horas > 0 ? p.volume / p.horas : 0 }))
      .sort((a, b) => b.mediaHora - a.mediaHora)
      .slice(0, 5);

    // Dados Diários (Gráfico Linha)
    const porDia = rawData.reduce((acc, curr) => {
      if (!acc[curr.DTAINICIO]) acc[curr.DTAINICIO] = { data: curr.DTAINICIO, volume: 0, meta: mediaVolumeHora };
      acc[curr.DTAINICIO].volume += curr.qtdVolume;
      return acc;
    }, {});
    
    const dailyData = Object.values(porDia).sort((a,b) => new Date(a.data) - new Date(b.data));

    return { totalVolume, totalVisitas, mediaVolumeHora, mediaVisitasHora, ranking, dailyData };
  }, [rawData]);

  // -- UTILS DE UI (SORT & EXPORT) --
  const handleSort = (columnKey) => {
    setTableConfig(prev => ({
      ...prev,
      sortColumn: columnKey,
      sortDirection: prev.sortColumn === columnKey && prev.sortDirection === 'desc' ? 'asc' : 'desc'
    }));
  };

  const exportCSV = () => {
    const headers = tableConfig.visibleColumns.map(col => availableColumns.find(c => c.key === col)?.label).join(',');
    const rows = rawData.map(row => tableConfig.visibleColumns.map(col => row[col]).join(',')).join('\n');
    const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `produtividade_${new Date().toISOString()}.csv`;
    link.click();
  };

  // -- RENDERIZAÇÃO --
  return (
    <div className="flex-1 overflow-auto p-8 bg-[#f4f7fa] h-full">
      
      {/* HEADER DA PÁGINA */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-[#023047]">Painel de Separação</h2>
          <p className="text-sm text-gray-500">Acompanhamento operacional diário</p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-500 bg-white px-4 py-2 rounded-lg shadow-sm">
           <Database size={16} className="text-[#00D4AA]" />
           <span>Base Atualizada</span>
        </div>
      </div>

      {/* FILTROS */}
      <div className="bg-white p-4 rounded-xl shadow-sm mb-8 flex flex-wrap gap-4 items-end border border-gray-100">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Data Início</label>
          <input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} className="input-std" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Data Fim</label>
          <input type="date" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} className="input-std" />
        </div>
        <div>
           <label className="block text-xs font-semibold text-gray-500 mb-1">Filial</label>
           <select value={filters.filial} onChange={e => setFilters({...filters, filial: e.target.value})} className="input-std w-32">
             <option value="1">MT - 01</option>
             <option value="2">SP - 02</option>
           </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Produtivo</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input type="text" placeholder="Buscar..." value={filters.produtivo} onChange={e => setFilters({...filters, produtivo: e.target.value})} className="pl-10 input-std w-full" />
          </div>
        </div>
        <button onClick={fetchData} className="btn-primary">
          {loading ? '...' : 'Filtrar'}
        </button>
      </div>

      {/* CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KPICard title="Volume Total" value={stats.totalVolume.toLocaleString()} subtext="caixas" icon={Package} trend={12} />
        <KPICard title="Média Vol/Hora" value={stats.mediaVolumeHora.toFixed(1)} subtext="cx/hora" icon={BarChart3} trend={-5} />
        <KPICard title="Total Visitas" value={stats.totalVisitas.toLocaleString()} subtext="endereços" icon={Users} trend={8} />
        <KPICard title="Média Vis/Hora" value={stats.mediaVisitasHora.toFixed(1)} subtext="vis/hora" icon={Calendar} trend={2} />
      </div>

      {/* GRÁFICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96">
          <h3 className="text-lg font-bold text-[#023047] mb-4">Evolução Diária</h3>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={stats.dailyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="data" tickFormatter={(v) => new Date(v).toLocaleDateString()} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="volume" stroke="#00D4AA" strokeWidth={3} dot={{r: 4}} />
              <ReferenceLine y={stats.mediaVolumeHora * 24} stroke="#F77F00" strokeDasharray="3 3" label="Meta" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96">
          <h3 className="text-lg font-bold text-[#023047] mb-4">Top 5 Produtivos</h3>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={stats.ranking} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="nome" type="category" width={100} tick={{fontSize: 10}} />
              <Tooltip />
              <Bar dataKey="mediaHora" fill="#00B4D8" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* TABELA DINÂMICA */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-[#023047]">Detalhamento</h3>
          <div className="flex gap-2">
            <button onClick={() => setShowColumnModal(!showColumnModal)} className="btn-secondary flex items-center gap-2">
              <Settings size={16} /> Colunas
            </button>
            <button onClick={exportCSV} className="btn-secondary text-blue-600 border-blue-100 bg-blue-50 flex items-center gap-2">
              <Download size={16} /> Exportar
            </button>
          </div>
        </div>

        {/* Modal de Colunas (Inline) */}
        {showColumnModal && (
          <div className="p-4 bg-gray-50 mb-4 grid grid-cols-3 gap-2 rounded-lg border border-gray-200">
            {availableColumns.map(col => (
              <label key={col.key} className="flex items-center space-x-2 text-sm cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={tableConfig.visibleColumns.includes(col.key)}
                  onChange={() => {
                    setTableConfig(prev => ({
                      ...prev,
                      visibleColumns: prev.visibleColumns.includes(col.key) 
                        ? prev.visibleColumns.filter(c => c !== col.key) 
                        : [...prev.visibleColumns, col.key]
                    }));
                  }}
                  className="rounded text-[#00D4AA]"
                />
                <span>{col.label}</span>
              </label>
            ))}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm">
                {tableConfig.visibleColumns.map(colKey => (
                  <th key={colKey} onClick={() => handleSort(colKey)} className="p-4 cursor-pointer hover:bg-gray-100">
                    <div className="flex items-center gap-1">
                      {availableColumns.find(c => c.key === colKey)?.label}
                      {tableConfig.sortColumn === colKey && (tableConfig.sortDirection === 'desc' ? <ChevronDown size={14}/> : <ArrowUp size={14}/>)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {rawData.sort((a,b) => {
                 // Lógica simples de sort para demo
                 if(a[tableConfig.sortColumn] < b[tableConfig.sortColumn]) return tableConfig.sortDirection === 'asc' ? -1 : 1;
                 if(a[tableConfig.sortColumn] > b[tableConfig.sortColumn]) return tableConfig.sortDirection === 'asc' ? 1 : -1;
                 return 0;
              }).slice(0, 10).map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  {tableConfig.visibleColumns.map(col => (
                    <td key={col} className="p-4 text-gray-700">
                      {(col === 'volumeHora' || col === 'visitasHora') ? (
                        <span className={`font-bold ${row[col] >= stats.mediaVolumeHora ? 'text-green-600' : 'text-red-500'}`}>{row[col]}</span>
                      ) : row[col]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Styles Injetados (Tailwind Classes abstraídas) */}
      <style jsx global>{`
        .input-std { @apply px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00D4AA] outline-none; }
        .btn-primary { @apply px-6 py-2 bg-gradient-to-r from-[#00D4AA] to-[#00B4D8] text-white rounded-lg text-sm font-bold shadow-md hover:opacity-90; }
        .btn-secondary { @apply px-4 py-2 text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200; }
      `}</style>
    </div>
  );
}
