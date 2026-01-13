// src/services/supabaseService.js
import { createClient } from '@supabase/supabase-js';
import { Calculations } from '../utils/calculations';

// Configuração para alternar entre Mock e Real
const USE_MOCK = true; // Mude para false para usar o Supabase

// Mock Data Generator (Apenas para desenvolvimento)
const generateMockData = () => {
  return Array.from({ length: 50 }).map((_, i) => {
    const produtivos = ['JOAO SILVA', 'MARIA OLIVEIRA', 'PEDRO SANTOS', 'ANA COSTA', 'CARLOS SOUZA'];
    const produtivo = produtivos[Math.floor(Math.random() * produtivos.length)];
    const data = new Date();
    data.setDate(data.getDate() - Math.floor(Math.random() * 7));
    
    const hourStart = 8 + Math.floor(Math.random() * 8);
    const hourEnd = hourStart + 1 + Math.random() * 3;
    
    return {
      id: i,
      NROEMPRESA: 1,
      CODPRODUTIVO: 100 + produtivos.indexOf(produtivo),
      PRODUTIVO: produtivo,
      QTDVOLUME: (Math.floor(Math.random() * 200) + 50).toString(),
      QTD_VISITAS: Math.floor(Math.random() * 100) + 20,
      DTAINICIO: data.toISOString().split('T')[0],
      "Hora Inicio": `${hourStart.toString().padStart(2, '0')}:00:00`,
      "HORAFIM": `${Math.floor(hourEnd).toString().padStart(2, '0')}:${Math.floor((hourEnd % 1) * 60).toString().padStart(2, '0')}:00`,
      LINHA_SEPARACAO: Math.random() > 0.5 ? 'SECOS' : 'FRIOS',
      EQUIPE: 'NOTURNO'
    };
  });
};

// Instância do Cliente (Singleton)
let supabase = null;
if (!USE_MOCK) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
}

export const SupabaseService = {
  fetchSeparacao: async (filters) => {
    try {
      if (USE_MOCK) {
        // Simulação de Latência de Rede
        await new Promise(resolve => setTimeout(resolve, 600));
        
        let rawData = generateMockData();
        let processedData = Calculations.processData(rawData);
        
        // Aplicação de Filtros no Mock
        if (filters.filial) processedData = processedData.filter(d => d.NROEMPRESA.toString() === filters.filial);
        if (filters.produtivo) processedData = processedData.filter(d => d.PRODUTIVO.includes(filters.produtivo.toUpperCase()));
        if (filters.startDate) processedData = processedData.filter(d => d.DTAINICIO >= filters.startDate);
        if (filters.endDate) processedData = processedData.filter(d => d.DTAINICIO <= filters.endDate);
        
        return { data: processedData, error: null };
      } else {
        if (!supabase) return { data: [], error: "Supabase credentials missing" };

        let query = supabase.from('separacao').select('*');
        
        // Aplicação de Filtros no Supabase
        if (filters.filial) query = query.eq('NROEMPRESA', filters.filial);
        if (filters.startDate) query = query.gte('DTAINICIO', filters.startDate);
        if (filters.endDate) query = query.lte('DTAINICIO', filters.endDate);
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        // Processamento pós-fetch (Cálculos de HH)
        const processedData = Calculations.processData(data);
        
        // Filtro de texto (Produtivo) feito em memória ou pode ser ajustado para 'ilike' no banco
        const finalData = filters.produtivo 
          ? processedData.filter(d => d.PRODUTIVO.includes(filters.produtivo.toUpperCase()))
          : processedData;

        return { data: finalData, error: null };
      }
    } catch (error) {
      console.error("Erro no serviço de dados:", error);
      return { data: [], error };
    }
  }
};
