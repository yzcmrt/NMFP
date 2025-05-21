'use client';

import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { formatCurrency } from '@/app/utils/formatters';
import { useTelegram } from '@/components/TelegramInitProvider';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';

// Tip tanımlamaları
interface UserWeeklyStat {
  id: number;
  user_id: string;
  week_start_date: string;
  week_end_date: string;
  total_mining_sessions: number;
  total_mining_time: string;
  total_earnings: number;
  checkin_days: number;
  best_car_id: number | null;
  best_car_earnings: number;
  created_at: string;
  // İlişkili veri
  best_car?: {
    id: number;
    name: string;
    car_model?: {
      name: string;
      rarity: string;
    }
  };
}

interface CarPerformance {
  name: string;
  earning: number;
  efficiency: number;
  totalEarned: number;
  color: string;
}

interface ActivityData {
  name: string;
  value: number;
}

interface MiningSessionStats {
  day: string;
  value: number;
}

// İstatistik servisi
const statsService = {
  getUserWeeklyStats: async (userId: string): Promise<UserWeeklyStat | null> => {
    try {
      const { data, error } = await supabase
        .from('user_weekly_stats')
        .select(`
          *,
          best_car:user_cars(
            id, name,
            car_model:car_models(name, rarity)
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Kayıt bulunamadı
        console.error('getUserWeeklyStats hatası:', error);
        throw error;
      }
      
      return data as UserWeeklyStat;
    } catch (error) {
      console.error('İstatistikler getirilirken hata oluştu:', error);
      return null;
    }
  },
  
  getMiningSessionsByDay: async (userId: string, timeRange: string): Promise<MiningSessionStats[]> => {
    try {
      let daysToQuery = 7; // varsayılan haftalık
      
      if (timeRange === 'daily') {
        daysToQuery = 1;
      } else if (timeRange === 'monthly') {
        daysToQuery = 30;
      }
      
      const { data, error } = await supabase.rpc('get_daily_mining_stats', {
        p_user_id: userId,
        p_days: daysToQuery
      });

      if (error) {
        console.error('Günlük mining istatistikleri hatası:', error);
        throw error;
      }
      
      // Günlük isimlerin Türkçe karşılıkları
      const dayNames: {[key: string]: string} = {
        'Mon': 'Pzt', 
        'Tue': 'Sal', 
        'Wed': 'Çar', 
        'Thu': 'Per', 
        'Fri': 'Cum', 
        'Sat': 'Cts', 
        'Sun': 'Paz'
      };
      
      // Veriyi dönüştür
      if (Array.isArray(data)) {
        return data.map(item => ({
          day: dayNames[item.day_name] || item.day_name,
          value: item.total_reward || 0
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Mining istatistikleri getirilirken hata oluştu:', error);
      return [];
    }
  },
  
  getCarPerformanceStats: async (userId: string): Promise<CarPerformance[]> => {
    try {
      const { data, error } = await supabase.rpc('get_car_performance_stats', {
        p_user_id: userId
      });
      
      if (error) {
        console.error('Araç performans istatistikleri hatası:', error);
        throw error;
      }
      
      const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F'];
      
      // Veriyi dönüştür
      if (Array.isArray(data)) {
        return data.map((item, index) => ({
          name: item.car_name || `Araç ${item.car_id}`,
          earning: Math.round(item.avg_daily_earning || 0),
          efficiency: Math.round(item.efficiency_percent || 0),
          totalEarned: item.total_earned || 0,
          color: colors[index % colors.length]
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Araç performans istatistikleri getirilirken hata oluştu:', error);
      return [];
    }
  },
  
  getActivityDistribution: async (userId: string): Promise<ActivityData[]> => {
    try {
      const { data, error } = await supabase.rpc('get_activity_distribution', {
        p_user_id: userId
      });
      
      if (error) {
        console.error('Aktivite dağılımı hatası:', error);
        throw error;
      }
      
      // Veriyi dönüştür
      if (Array.isArray(data)) {
        return data.map(item => ({
          name: item.activity_type,
          value: item.percentage
        }));
      }
      
      // Veri yoksa varsayılan değerler
      return [
        { name: 'Mining', value: 70 },
        { name: 'Görev', value: 15 },
        { name: 'Market', value: 10 },
        { name: 'Diğer', value: 5 },
      ];
    } catch (error) {
      console.error('Aktivite dağılımı getirilirken hata oluştu:', error);
      // Hata durumunda varsayılan veri
      return [
        { name: 'Mining', value: 70 },
        { name: 'Görev', value: 15 },
        { name: 'Market', value: 10 },
        { name: 'Diğer', value: 5 },
      ];
    }
  }
};

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042'];

export default function StatsPage() {
  const { user: contextUser, isLoading: providerLoading } = useTelegram();
  const [timeRange, setTimeRange] = useState('weekly');
  const [dataLoading, setDataLoading] = useState(true);
  
  // İstatistik verileri için state'ler
  const [earningData, setEarningData] = useState<MiningSessionStats[]>([]);
  const [carPerformanceData, setCarPerformanceData] = useState<CarPerformance[]>([]);
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<UserWeeklyStat | null>(null);
  
  const loadStatsData = async (userId: string) => {
    setDataLoading(true);
    try {
      // Paralel olarak tüm veri isteklerini başlat
      const [dailyStats, carStats, activityStats, userWeeklyStats] = await Promise.all([
        statsService.getMiningSessionsByDay(userId, timeRange),
        statsService.getCarPerformanceStats(userId),
        statsService.getActivityDistribution(userId),
        statsService.getUserWeeklyStats(userId)
      ]);
      
      // Sonuçları state'lere ata
      setEarningData(dailyStats);
      setCarPerformanceData(carStats);
      setActivityData(activityStats);
      setWeeklyStats(userWeeklyStats);
      
    } catch (error) {
      console.error('İstatistik verileri yüklenirken hata:', error);
      toast.error('İstatistik verileri yüklenemedi');
    } finally {
      setDataLoading(false);
    }
  };
  
  // User değiştiğinde ve timeRange değiştiğinde verileri yeniden yükle
  useEffect(() => {
    if (contextUser?.id) {
      loadStatsData(contextUser.id);
    }
  }, [contextUser, timeRange]);
  
  // Hesaplanan değerler
  const totalEarnings = earningData.reduce((total, entry) => total + entry.value, 0);
  const averageEarning = earningData.length > 0 ? totalEarnings / earningData.length : 0;
  
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

  // Yükleniyor göstergesi
  if (providerLoading || dataLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="w-12 h-12 border-4 border-t-4 border-gray-200 rounded-full animate-spin mb-4 border-t-[#7b2ff7]"></div>
        <p className="text-white">İstatistikler yükleniyor...</p>
      </div>
    );
  }

  // Kullanıcı giriş yapmamışsa mesaj göster
  if (!contextUser) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-white mb-4">İstatistikleri görmek için giriş yapmalısınız.</p>
      </div>
    );
  }
  
  // Veri yoksa mesaj göster
  if (earningData.length === 0 && carPerformanceData.length === 0) {
    return (
      <div className="pb-12">
        <div className="mobile-app-header relative mb-6">
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-[#7b2ff7] via-[#2f7bf7] to-[#2ff7c1] opacity-80"></div>
          <h1 className="page-title w-full text-center text-2xl font-bold py-4 text-transparent bg-clip-text bg-gradient-to-r from-white via-[#7b2ff7] to-white drop-shadow-[0_0_2px_rgba(123,47,247,0.3)]">İstatistikler</h1>
        </div>
        
        <div className="bg-gradient-to-r from-[#0f3460] to-[#1a1a2e] p-6 rounded-xl border border-[#2a3855] shadow-md text-center">
          <p className="text-white mb-4">Henüz yeterli istatistik verisi bulunmuyor.</p>
          <p className="text-gray-400">Mining yaparak ve diğer aktiviteleri tamamlayarak istatistiklerinizin oluşmasını sağlayabilirsiniz.</p>
        </div>
      </div>
    );
  }

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
            <h3 className="text-sm font-medium mb-4 text-white">
              {timeRange === 'daily' ? 'Günlük' : timeRange === 'weekly' ? 'Haftalık' : 'Aylık'} Kazanç Grafiği
            </h3>
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
                    dataKey="day" 
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
                      <div className="text-sm font-medium text-white">{item.day}</div>
                      <div className="text-xs text-gray-400">Mining Kazancı</div>
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
          {carPerformanceData.length > 0 && (
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
          )}
          
          {/* Aktivite Dağılımı */}
          {activityData.length > 0 && (
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
              
              {/* Aktivite Legend */}
              <div className="grid grid-cols-2 gap-3 mt-4">
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
          )}
        </div>
      </div>
    </div>
  );
} 