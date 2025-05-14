'use client';

import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { formatCurrency } from '@/app/utils/formatters';

// İstatistikler için örnek veriler
const earningData = [
  { name: 'Pzt', value: 480 },
  { name: 'Sal', value: 520 },
  { name: 'Çar', value: 550 },
  { name: 'Per', value: 580 },
  { name: 'Cum', value: 490 },
  { name: 'Cts', value: 600 },
  { name: 'Paz', value: 620 },
];

const carPerformanceData = [
  { 
    name: 'Tesla Model X', 
    earning: 580, 
    efficiency: 85, 
    totalEarned: 12460,
    color: '#8884d8' 
  },
  { 
    name: 'Tesla Model 3', 
    earning: 320, 
    efficiency: 92, 
    totalEarned: 8240,
    color: '#82ca9d' 
  },
  { 
    name: 'Mercedes EQS', 
    earning: 150, 
    efficiency: 78, 
    totalEarned: 4120,
    color: '#ffc658' 
  },
];

const activityData = [
  { name: 'Araba', value: 42 },
  { name: 'Görev', value: 28 },
  { name: 'Market', value: 18 },
  { name: 'Diğer', value: 12 },
];

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042'];

export default function StatsPage() {
  const [timeRange, setTimeRange] = useState('weekly');
  
  const totalEarnings = earningData.reduce((total, entry) => total + entry.value, 0);
  const averageEarning = totalEarnings / earningData.length;
  
  type TooltipProps = {
    active?: boolean;
    payload?: Array<{
      value: number;
      [key: string]: any;
    }>;
    label?: string;
  };
  
  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 p-2 border border-gray-700 rounded-md text-xs">
          <p className="mb-1">{`${label}`}</p>
          <p className="text-accent-secondary font-medium">{`${formatCurrency(payload[0].value)} NMFP`}</p>
        </div>
      );
    }
    return null;
  };
  
  const CarPerformanceTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 p-2 border border-gray-700 rounded-md text-xs">
          <p className="mb-1 font-medium">{label}</p>
          <p className="text-accent-secondary">{`Kazanç: ${formatCurrency(payload[0].value)} NMFP/gün`}</p>
          <p className="text-blue-400">{`Verimlilik: %${payload[1].value}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="pb-12">
      {/* Sayfa Başlığı */}
      <div className="mobile-app-header relative mb-6">
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-[#7b2ff7] via-[#2f7bf7] to-[#2ff7c1] opacity-80"></div>
        <h1 className="page-title w-full text-center text-2xl font-bold py-4 text-transparent bg-clip-text bg-gradient-to-r from-white via-[#7b2ff7] to-white drop-shadow-[0_0_2px_rgba(123,47,247,0.3)]">İstatistikler</h1>
      </div>
      
      <div className="space-y-5">
        {/* Time range selector */}
        <div className="flex justify-between bg-gradient-to-r from-[#0f3460] to-[#1a1a2e] rounded-lg p-1">
          <button
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all duration-300 ${timeRange === 'daily' ? 'bg-gradient-to-r from-[#7b2ff7]/80 via-[#5f40f8]/80 to-[#2f7bf7]/80 text-white' : 'text-gray-400 hover:text-white hover:bg-[#2a3855]/50'}`}
            onClick={() => setTimeRange('daily')}
          >
            Günlük
          </button>
          <button
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all duration-300 ${timeRange === 'weekly' ? 'bg-gradient-to-r from-[#7b2ff7]/80 via-[#5f40f8]/80 to-[#2f7bf7]/80 text-white' : 'text-gray-400 hover:text-white hover:bg-[#2a3855]/50'}`}
            onClick={() => setTimeRange('weekly')}
          >
            Haftalık
          </button>
          <button
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all duration-300 ${timeRange === 'monthly' ? 'bg-gradient-to-r from-[#7b2ff7]/80 via-[#5f40f8]/80 to-[#2f7bf7]/80 text-white' : 'text-gray-400 hover:text-white hover:bg-[#2a3855]/50'}`}
            onClick={() => setTimeRange('monthly')}
          >
            Aylık
          </button>
        </div>
        
        {/* Genel İstatistikler */}
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-r from-[#0f3460] to-[#1a1a2e] p-4 rounded-xl border border-[#2a3855] shadow-md">
              <div className="text-xs text-gray-400 mb-1">Toplam Kazanç</div>
              <div className="text-xl font-bold text-[#2ff7c1]">{formatCurrency(totalEarnings)} NMFP</div>
            </div>
            <div className="bg-gradient-to-r from-[#0f3460] to-[#1a1a2e] p-4 rounded-xl border border-[#2a3855] shadow-md">
              <div className="text-xs text-gray-400 mb-1">Günlük Ortalama</div>
              <div className="text-xl font-bold text-[#2ff7c1]">{formatCurrency(averageEarning)} NMFP</div>
            </div>
          </div>
          
          {/* Kazanç Grafiği */}
          <div className="bg-gradient-to-r from-[#0f3460] to-[#1a1a2e] p-4 rounded-xl border border-[#2a3855] shadow-md">
            <h3 className="text-sm font-medium mb-4 text-white">Haftalık Kazanç Grafiği</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={earningData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorEarning" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7b2ff7" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#7b2ff7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 10, fill: '#9ca3af' }} 
                    axisLine={{ stroke: '#2a3855' }}
                    tickLine={false}
                  />
                  <YAxis 
                    hide={true}
                  />
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    vertical={false} 
                    stroke="#2a3855"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#7b2ff7" 
                    fillOpacity={1} 
                    fill="url(#colorEarning)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Son Kazançlar */}
          <div className="bg-gradient-to-r from-[#0f3460] to-[#1a1a2e] p-4 rounded-xl border border-[#2a3855] shadow-md">
            <h3 className="text-sm font-medium mb-3 text-white">Son Kazançlar</h3>
            <div className="space-y-3">
              {earningData.slice(0, 5).map((item, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-[#2a3855]">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gradient-to-r from-[#2f7bf7]/30 to-[#7b2ff7]/30 rounded-full flex items-center justify-center mr-3 shadow-md">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#2ff7c1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{item.name}</div>
                      <div className="text-xs text-gray-400">Araba Kazancı</div>
                    </div>
                  </div>
                  <div className="text-[#2ff7c1] font-medium">
                    {formatCurrency(item.value)} NMFP
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Araç Performansı */}
          <div className="bg-gradient-to-r from-[#0f3460] to-[#1a1a2e] p-4 rounded-xl border border-[#2a3855] shadow-md">
            <h3 className="text-sm font-medium mb-4 text-white">Araç Performansı</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={carPerformanceData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a3855" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 10, fill: '#9ca3af' }} 
                    axisLine={{ stroke: '#2a3855' }}
                    tickLine={false}
                  />
                  <YAxis 
                    hide={true}
                  />
                  <Tooltip content={<CarPerformanceTooltip />} />
                  <Bar dataKey="earning" fill="#7b2ff7" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="efficiency" fill="#2f7bf7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Aktivite Dağılımı */}
          <div className="bg-gradient-to-r from-[#0f3460] to-[#1a1a2e] p-4 rounded-xl border border-[#2a3855] shadow-md">
            <h3 className="text-sm font-medium mb-4 text-white">Aktivite Dağılımı</h3>
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={activityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {activityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [`${value}%`, 'Aktivite']}
                    itemStyle={{ color: '#fff' }}
                    contentStyle={{ backgroundColor: '#1a1a2e', borderColor: '#2a3855' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Aktivite Legend */}
          <div className="bg-gradient-to-r from-[#0f3460] to-[#1a1a2e] p-4 rounded-xl border border-[#2a3855] shadow-md">
            <h3 className="text-sm font-medium mb-4 text-white">Aktivite Türleri</h3>
            <div className="grid grid-cols-2 gap-3">
              {activityData.map((item, index) => (
                <div key={index} className="flex items-center">
                  <div 
                    className="w-4 h-4 rounded-full mr-2" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  ></div>
                  <div className="flex-1">
                    <div className="text-sm text-white">{item.name}</div>
                    <div className="text-xs text-gray-400">{item.value}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 