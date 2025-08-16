'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { formatCurrency } from '@/app/utils/formatters';
import { toast } from 'react-hot-toast';
import { Task, UserTask } from '@/types';
import { useTelegram } from '@/components/TelegramInitProvider';
import { supabase } from '@/lib/supabaseClient';

export default function TaskPage() {
  const { telegramUser, user: contextUser } = useTelegram();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userTasks, setUserTasks] = useState<UserTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');
  const [verifyingTasks, setVerifyingTasks] = useState<Record<number, boolean>>({});
  
  // Görevleri ve kullanıcı görevlerini getir
  const fetchTasks = useCallback(async () => {
    if (!contextUser?.id) return;
    
    setIsLoading(true);
    try {
      // Aktif görevleri getir
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('is_active', true)
        .order('id');
        
      if (tasksError) throw tasksError;
      
      // Kullanıcının görev ilerlemelerini getir
      const { data: userTasksData, error: userTasksError } = await supabase
        .from('user_tasks')
        .select('*')
        .eq('user_id', contextUser.id);
        
      if (userTasksError) throw userTasksError;
      
      console.log('Çekilen görevler:', tasksData);
      console.log('Kullanıcı görevleri:', userTasksData);
      
      setTasks(tasksData || []);
      setUserTasks(userTasksData || []);
    } catch (error: any) {
      console.error('Görevler yüklenirken hata:', error);
      toast.error('Görevler yüklenemedi');
    } finally {
      setIsLoading(false);
    }
  }, [contextUser]);
  
  // Sayfa yüklendiğinde görevleri getir
  useEffect(() => {
    if (contextUser?.id) {
      fetchTasks();
    }
  }, [contextUser, fetchTasks]);
  
  // Supabase Realtime ile task değişikliklerini dinle
  useEffect(() => {
    if (!contextUser?.id) return;
    
    // Tasks tablosundaki değişiklikleri dinle
    const tasksChannel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'tasks' }, 
        (payload) => {
          console.log('Task değişikliği:', payload);
          fetchTasks(); // Tüm görevleri yeniden yükle
        }
      )
      .subscribe();
    
    // UserTasks tablosundaki değişiklikleri dinle
    const userTasksChannel = supabase
      .channel('user-tasks-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'user_tasks',
          filter: `user_id=eq.${contextUser.id}` 
        }, 
        (payload) => {
          console.log('UserTask değişikliği:', payload);
          fetchTasks(); // Tüm kullanıcı görevlerini yeniden yükle
        }
      )
      .subscribe();
    
    // Cleanup
    return () => {
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(userTasksChannel);
    };
  }, [contextUser, fetchTasks]);
  
  // Görev doğrulama fonksiyonu - API endpoint üzerinden doğrulama
  const verifyTask = async (taskId: number) => {
    if (!contextUser?.id || !telegramUser?.id) {
      toast.error('Kullanıcı bilgisi eksik');
      return;
    }
    
    // Doğrulama durumunu güncelle - yükleniyor
    setVerifyingTasks(prev => ({ ...prev, [taskId]: true }));
    const toastId = toast.loading('Görev doğrulanıyor...');
    
    try {
      // İlgili görev nesnesini bul
      const task = tasks.find(t => t.id === taskId);
      if (!task) {
        throw new Error('Görev bulunamadı');
      }
      
      console.log('Doğrulanacak görev:', task);
      
      // API'ye doğrulama isteği gönder
      const response = await fetch('/api/telegram/verify-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          userId: contextUser.id,
          telegramId: telegramUser.id.toString(),
          taskType: task.verification_type || 'manual',
          taskData: task.verification_data || {}
        })
      });
      
      const result = await response.json();
      console.log('Doğrulama sonucu:', result);
      
      if (result.success) {
        const rewardMsg = result.result?.reward 
          ? `${formatCurrency(result.result.reward)} NMFP kazandınız!` 
          : '';
        
        toast.success(`${result.message || 'Görev tamamlandı!'} ${rewardMsg}`, { id: toastId });
        fetchTasks(); // Görevleri güncelle
      } else {
        toast.error(result.message || 'Görev doğrulanamadı', { id: toastId });
      }
    } catch (error: any) {
      console.error('Görev doğrulama hatası:', error);
      toast.error('Görev doğrulanamadı: ' + error.message, { id: toastId });
    } finally {
      // Doğrulama durumunu güncelle - tamamlandı
      setVerifyingTasks(prev => ({ ...prev, [taskId]: false }));
    }
  };

  // Görev tamamlanma yüzdesini hesapla
  const calculateProgress = (progress: number, total: number): number => {
    return Math.min(Math.round((progress / total) * 100), 100);
  };
  
  // Görev ikonunu belirle
  const getTaskIcon = (task: Task): string => {
    if (!task.verification_type) return '/images/task-default.svg';
    
    switch (task.verification_type) {
      case 'channel_join':
        return '/images/task-referral.svg';
      case 'bot_command':
        return '/images/task-garage.svg';
      case 'link_click':
        return '/images/task-driving.svg';
      case 'car_purchase_nmfp':
        return '/images/task-garage.svg';
      case 'car_purchase_ton':
        return '/images/task-garage.svg';
      case 'car_mint_nft':
        return '/images/task-garage.svg';
      case 'car_repair':
        return '/images/task-repair.svg';
      case 'car_refill':
        return '/images/task-fuel.svg';
      case 'mining_complete':
        return '/images/task-mining.svg';
      case 'collect_bonus':
        return '/images/task-bonus.svg';
      default:
        return '/images/task-default.svg';
    }
  };

  // Aktif görevleri renderla
  const renderActiveTasks = () => {
    // Tamamlanmamış görevleri filtrele
    const activeTasks = tasks.filter(task => {
      const userTask = userTasks.find(ut => ut.task_id === task.id);
      return !userTask?.is_completed;
    });
    
    if (activeTasks.length === 0) {
      return (
        <div className="text-center py-12 bg-gradient-to-b from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#2a3855]">
          <div className="w-16 h-16 bg-gradient-to-r from-[#2a3855] to-[#1a1a2e] rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-medium mb-2 text-transparent bg-clip-text bg-gradient-to-r from-white via-[#7b2ff7] to-white">Aktif görev bulunmamaktadır</h3>
          <p className="text-gray-400 text-sm">Yakında yeni görevler eklenecektir.</p>
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        {activeTasks.map(task => {
          const userTask = userTasks.find(ut => ut.task_id === task.id);
          const progress = userTask?.progress || 0;
          const progressPercent = calculateProgress(progress, task.total);
          const isVerifying = verifyingTasks[task.id] || false;
          
          return (
            <div key={task.id} className="bg-gradient-to-r from-[#0f3460] to-[#1a1a2e] rounded-xl overflow-hidden border border-[#2a3855] transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/20">
              <div className="p-4">
                <div className="flex items-start">
                  <div className="h-12 w-12 bg-gradient-to-r from-[#2f7bf7]/30 to-[#7b2ff7]/30 rounded-lg flex items-center justify-center mr-4 shadow-md">
                    <Image 
                      src={getTaskIcon(task)}
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
                        <span>İlerleme: {progress}/{task.total}</span>
                        <span>{progressPercent}%</span>
                      </div>
                      <div className="w-full bg-[#2a3855] rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-[#2f7bf7] via-[#5f40f8] to-[#7b2ff7] h-full rounded-full transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
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
                    <span>Sınırsız süre</span>
                  </div>
                  
                  <div className="flex">
                    {/* Doğrulama öğeleri */}
                    {task.verification_type === 'channel_join' && (
                      <a 
                        href={`https://t.me/${task.verification_data?.channel_username}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-gradient-to-r from-[#7b2ff7] via-[#5f40f8] to-[#2f7bf7] text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/30"
                      >
                        Kanala Katıl
                      </a>
                    )}
                    
                    {task.verification_type === 'bot_command' && (
                      <a 
                        href={`https://t.me/${task.verification_data?.bot_username}?start=task_${task.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-gradient-to-r from-[#7b2ff7] via-[#5f40f8] to-[#2f7bf7] text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/30"
                      >
                        Bota Git
                      </a>
                    )}
                    
                    {task.verification_type === 'link_click' && (
                      <a 
                        href={task.verification_data?.url}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-gradient-to-r from-[#7b2ff7] via-[#5f40f8] to-[#2f7bf7] text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/30"
                      >
                        Sayfayı Ziyaret Et
                      </a>
                    )}
                    
                    {task.verification_type === 'car_purchase_nmfp' && (
                      <a 
                        href="/gamefi/car"
                        className="bg-gradient-to-r from-[#7b2ff7] via-[#5f40f8] to-[#2f7bf7] text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/30"
                      >
                        Araba Marketi
                      </a>
                    )}
                    
                    {task.verification_type === 'car_purchase_ton' && (
                      <a 
                        href="/gamefi/car"
                        className="bg-gradient-to-r from-[#7b2ff7] via-[#5f40f8] to-[#2f7bf7] text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/30"
                      >
                        Araba Marketi
                      </a>
                    )}
                    
                    {task.verification_type === 'car_mint_nft' && (
                      <a 
                        href="/gamefi/car"
                        className="bg-gradient-to-r from-[#7b2ff7] via-[#5f40f8] to-[#2f7bf7] text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/30"
                      >
                        NFT Mintle
                      </a>
                    )}
                    
                    {task.verification_type === 'car_repair' && (
                      <a 
                        href="/gamefi/garage"
                        className="bg-gradient-to-r from-[#7b2ff7] via-[#5f40f8] to-[#2f7bf7] text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/30"
                      >
                        Garaj'a Git
                      </a>
                    )}
                    
                    {task.verification_type === 'car_refill' && (
                      <a 
                        href="/gamefi/garage"
                        className="bg-gradient-to-r from-[#7b2ff7] via-[#5f40f8] to-[#2f7bf7] text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/30"
                      >
                        Yakıt Doldur
                      </a>
                    )}
                    
                    {task.verification_type === 'mining_complete' && (
                      <a 
                        href="/gamefi/garage"
                        className="bg-gradient-to-r from-[#7b2ff7] via-[#5f40f8] to-[#2f7bf7] text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/30"
                      >
                        Mining Başlat
                      </a>
                    )}
                    
                    {task.verification_type === 'collect_bonus' && (
                      <a 
                        href="/gamefi/garage"
                        className="bg-gradient-to-r from-[#7b2ff7] via-[#5f40f8] to-[#2f7bf7] text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/30"
                      >
                        Bonus Topla
                      </a>
                    )}
                    
                    {/* Doğrulama butonu */}
                    <button 
                      onClick={() => verifyTask(task.id)}
                      disabled={isVerifying}
                      className={`ml-2 ${isVerifying ? 'bg-[#1a2030] text-gray-500' : 'bg-[#2a3855] text-white hover:bg-[#3a4865]'} px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-lg flex items-center`}
                    >
                      {isVerifying ? (
                        <>
                          <span className="mr-2 w-4 h-4 border-2 border-t-transparent border-gray-500 rounded-full animate-spin"></span>
                          Doğrulanıyor
                        </>
                      ) : (
                        'Doğrula'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Tamamlanmış görevleri renderla
  const renderCompletedTasks = () => {
    // Tamamlanmış görevleri filtrele
    const completedTasks = tasks.filter(task => {
      const userTask = userTasks.find(ut => ut.task_id === task.id);
      return userTask?.is_completed;
    });
    
    if (completedTasks.length === 0) {
      return (
        <div className="text-center py-12 bg-gradient-to-b from-[#1a1a2e] to-[#16213e] rounded-xl p-6 border border-[#2a3855]">
          <div className="w-16 h-16 bg-gradient-to-r from-[#2a3855] to-[#1a1a2e] rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-medium mb-2 text-transparent bg-clip-text bg-gradient-to-r from-white via-[#7b2ff7] to-white">Henüz tamamlanmış göreviniz yok</h3>
          <p className="text-gray-400 text-sm">Aktif görevleri tamamlayarak ödül kazanabilirsiniz.</p>
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        {completedTasks.map(task => {
          const userTask = userTasks.find(ut => ut.task_id === task.id);
          const completedDate = userTask?.completed_at ? new Date(userTask.completed_at) : null;
          const completedDateStr = completedDate ? 
            completedDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : 
            'Bilinmiyor';
            
          return (
            <div key={task.id} className="bg-gradient-to-r from-[#1a1a2e] via-[#16213e] to-[#0f3460] rounded-xl overflow-hidden border border-[#2a3855] p-4">
              <div className="flex items-start">
                <div className="h-12 w-12 bg-[#2a3855] rounded-lg flex items-center justify-center mr-4">
                  <Image 
                    src={getTaskIcon(task)}
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
                      <span>Tamamlandı: {completedDateStr}</span>
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
          );
        })}
      </div>
    );
  };

  // Yükleme durumunda
  if (isLoading) {
    return (
      <div className="pb-12">
        <div className="mobile-app-header relative mb-6">
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-[#7b2ff7] via-[#2f7bf7] to-[#2ff7c1] opacity-80"></div>
          <h1 className="page-title w-full text-center text-2xl font-bold py-4 text-transparent bg-clip-text bg-gradient-to-r from-white via-[#7b2ff7] to-white drop-shadow-[0_0_2px_rgba(123,47,247,0.3)]">Görevler</h1>
        </div>
        
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#7b2ff7]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-12">
      {/* Sayfa Başlığı */}
      <div className="mobile-app-header relative mb-6">
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-[#7b2ff7] via-[#2f7bf7] to-[#2ff7c1] opacity-80"></div>
        <h1 className="page-title w-full text-center text-2xl font-bold py-4 text-transparent bg-clip-text bg-gradient-to-r from-white via-[#7b2ff7] to-white drop-shadow-[0_0_2px_rgba(123,47,247,0.3)]">Görevler</h1>
      </div>
      
      {/* Kullanıcı Puan Bilgisi */}
      <div className="bg-gradient-to-r from-[#1a1a2e] via-[#16213e] to-[#0f3460] rounded-xl p-4 mb-5 shadow-lg border border-[#2a3855]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-r from-[#2ff7c1]/20 to-[#7b2ff7]/20 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#2ff7c1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-400">Mevcut Bakiye</p>
              <p className="text-lg font-bold text-[#2ff7c1]">{formatCurrency(contextUser?.balance || 0)} NMFP</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-r from-[#7b2ff7]/20 to-[#2f7bf7]/20 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#7b2ff7]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-400">Seviye</p>
              <p className="text-lg font-bold text-white">Lv. {contextUser?.level || 1}</p>
            </div>
          </div>
        </div>
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

        {activeTab === 'active' ? renderActiveTasks() : renderCompletedTasks()}
      </div>
    </div>
  );
} 