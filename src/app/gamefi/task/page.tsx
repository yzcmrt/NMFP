'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { formatCurrency } from '@/app/utils/formatters';

const tasks = [
  {
    id: 1,
    title: 'Günlük Sürüş',
    description: 'Araban ile 100 km yol kat et',
    reward: 150,
    progress: 65,
    total: 100,
    unit: 'km',
    icon: '/images/task-driving.svg',
    timeRemaining: '11 saat',
  },
  {
    id: 2,
    title: 'Yakıt Doldur',
    description: '10 araç için yakıt satın al',
    reward: 300,
    progress: 4,
    total: 10,
    unit: 'araç',
    icon: '/images/task-fuel.svg',
    timeRemaining: '23 saat',
  },
  {
    id: 3,
    title: 'Garaj Yönetimi',
    description: 'Garajını ziyaret et ve bakım yap',
    reward: 200,
    progress: 0,
    total: 1,
    unit: 'ziyaret',
    icon: '/images/task-garage.svg',
    timeRemaining: '23 saat',
  }
];

const completedTasks = [
  {
    id: 4,
    title: 'Referans Bonusu',
    description: '3 arkadaşını davet et',
    reward: 500,
    icon: '/images/task-referral.svg',
    completedAt: '12 Ağustos 2023',
  }
];

export default function TaskPage() {
  const [activeTab, setActiveTab] = useState('active');

  // Görev tamamlanma yüzdesini hesapla
  const calculateProgress = (progress: number, total: number): number => {
    return Math.min(Math.round((progress / total) * 100), 100);
  };

  return (
    <div className="pb-12">
      {/* Sayfa Başlığı */}
      <div className="mobile-app-header relative mb-6">
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-[#7b2ff7] via-[#2f7bf7] to-[#2ff7c1] opacity-80"></div>
        <h1 className="page-title w-full text-center text-2xl font-bold py-4 text-transparent bg-clip-text bg-gradient-to-r from-white via-[#7b2ff7] to-white drop-shadow-[0_0_2px_rgba(123,47,247,0.3)]">Görevler</h1>
      </div>
      
      <div className="space-y-5">
        <div className="flex justify-between bg-gradient-to-r from-[#1a1a2e] via-[#16213e] to-[#0f3460] rounded-xl p-1.5 shadow-lg border border-[#2a3855]">
          <button
            className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === 'active' ? 'bg-gradient-to-r from-[#7b2ff7] via-[#5f40f8] to-[#2f7bf7] text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-[#16213e]/80'}`}
            onClick={() => setActiveTab('active')}
          >
            <div className="flex items-center justify-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Aktif Görevler</span>
            </div>
          </button>
          <button
            className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === 'completed' ? 'bg-gradient-to-r from-[#7b2ff7] via-[#5f40f8] to-[#2f7bf7] text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-[#16213e]/80'}`}
            onClick={() => setActiveTab('completed')}
          >
            <div className="flex items-center justify-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Tamamlanan</span>
            </div>
          </button>
        </div>

        {activeTab === 'active' ? (
          <div className="space-y-4">
            {tasks.map(task => (
              <div key={task.id} className="bg-gradient-to-r from-[#0f3460] to-[#1a1a2e] rounded-xl overflow-hidden border border-[#2a3855] transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/20">
                <div className="p-4">
                  <div className="flex items-start">
                    <div className="h-12 w-12 bg-gradient-to-r from-[#2f7bf7]/30 to-[#7b2ff7]/30 rounded-lg flex items-center justify-center mr-4 shadow-md">
                      <Image 
                        src={task.icon || '/images/task-default.svg'}
                        alt={task.title}
                        width={28}
                        height={28}
                        className="object-contain"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <h3 className="font-semibold text-white">{task.title}</h3>
                        <span className="text-[#2ff7c1] font-semibold">
                          {formatCurrency(task.reward)} NMFP
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mb-3">{task.description}</p>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span>İlerleme: {task.progress}/{task.total} {task.unit}</span>
                          <span>{calculateProgress(task.progress, task.total)}%</span>
                        </div>
                        <div className="w-full bg-[#2a3855] rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-[#2f7bf7] via-[#5f40f8] to-[#7b2ff7] h-full rounded-full transition-all duration-500"
                            style={{ width: `${calculateProgress(task.progress, task.total)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-3 flex items-center justify-between border-t border-[#2a3855]">
                    <div className="flex items-center text-xs text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{task.timeRemaining} kaldı</span>
                    </div>
                    
                    <button className="bg-gradient-to-r from-[#7b2ff7] via-[#5f40f8] to-[#2f7bf7] text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/30">
                      Göreve Git
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {completedTasks.length > 0 ? (
              completedTasks.map(task => (
                <div key={task.id} className="bg-gradient-to-r from-[#1a1a2e] via-[#16213e] to-[#0f3460] rounded-xl overflow-hidden border border-[#2a3855] p-4">
                  <div className="flex items-start">
                    <div className="h-12 w-12 bg-[#2a3855] rounded-lg flex items-center justify-center mr-4">
                      <Image 
                        src={task.icon || '/images/task-default.svg'}
                        alt={task.title}
                        width={28}
                        height={28}
                        className="object-contain opacity-80"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <h3 className="font-medium text-gray-300">{task.title}</h3>
                        <span className="text-gray-400 font-semibold">
                          {formatCurrency(task.reward)} NMFP
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mb-2">{task.description}</p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-xs text-gray-500">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Tamamlandı: {task.completedAt}</span>
                        </div>
                        
                        <div className="flex items-center text-xs text-[#2ff7c1] px-2 py-1 rounded-full bg-[#2ff7c1]/10">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Ödül Alındı</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 bg-gradient-to-b from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#2a3855]">
                <div className="w-16 h-16 bg-gradient-to-r from-[#2a3855] to-[#1a1a2e] rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium mb-2 text-transparent bg-clip-text bg-gradient-to-r from-white via-[#7b2ff7] to-white">Henüz tamamlanmış göreviniz yok</h3>
                <p className="text-gray-400 text-sm">Aktif görevleri tamamlayarak ödül kazanabilirsiniz.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 