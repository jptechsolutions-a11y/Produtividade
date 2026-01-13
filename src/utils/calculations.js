// src/utils/calculations.js

export const Calculations = {
  // Converte "HH:mm:ss" para horas decimais (ex: "01:30:00" -> 1.5)
  timeToDecimal: (timeStr) => {
    if (!timeStr) return 0;
    const [h, m, s] = timeStr.split(':').map(Number);
    return h + m / 60 + s / 3600;
  },

  // Calcula diferença de tempo considerando virada de dia (ex: 22h às 02h)
  calculateHoursWorked: (startStr, endStr) => {
    if (!startStr || !endStr) return 0;
    let start = Calculations.timeToDecimal(startStr);
    let end = Calculations.timeToDecimal(endStr);
    
    // Se terminou antes de começar (virada de dia), adiciona 24h ao fim
    if (end < start) {
      end += 24;
    }
    
    return Number((end - start).toFixed(2));
  },

  // Processa o array bruto do banco e adiciona métricas calculadas
  processData: (rawData) => {
    if (!rawData) return [];

    return rawData.map(item => {
      const horasTrabalhadas = Calculations.calculateHoursWorked(item["Hora Inicio"], item.HORAFIM);
      
      // Parse seguro para números
      const qtdVolume = parseFloat(item.QTDVOLUME) || 0;
      const qtdVisitas = parseFloat(item.QTD_VISITAS) || 0;

      // Evitar divisão por zero
      const volumeHora = horasTrabalhadas > 0 ? qtdVolume / horasTrabalhadas : 0;
      const visitasHora = horasTrabalhadas > 0 ? qtdVisitas / horasTrabalhadas : 0;

      return {
        ...item,
        horasTrabalhadas, // Campo calculado
        qtdVolume,        // Campo normalizado
        qtdVisitas,       // Campo normalizado
        volumeHora: Number(volumeHora.toFixed(2)),   // KPI
        visitasHora: Number(visitasHora.toFixed(2))  // KPI
      };
    });
  }
};
