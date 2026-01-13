// src/components/KPICard.jsx
import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

const KPICard = ({ title, value, subtext, icon: Icon, trend }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-[#023047]">{value}</h3>
      </div>
      <div className={`p-3 rounded-lg ${
        title.includes('Volume') ? 'bg-teal-50 text-[#00D4AA]' : 
        title.includes('Visitas') ? 'bg-blue-50 text-[#00B4D8]' : 
        'bg-gray-100 text-gray-600'
      }`}>
        <Icon size={24} />
      </div>
    </div>
    <div className="mt-4 flex items-center text-sm">
      {trend !== undefined && (
        <span className={`flex items-center font-medium ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend > 0 ? <ArrowUp size={16} className="mr-1" /> : <ArrowDown size={16} className="mr-1" />}
          {Math.abs(trend)}%
        </span>
      )}
      <span className="text-gray-400 ml-2">{subtext}</span>
    </div>
  </div>
);

export default KPICard;
