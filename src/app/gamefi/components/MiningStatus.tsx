'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TimeIcon, PlayIcon, CoinIcon } from './Icons';
import { 
  formatTimeLeft, 
  calculateProgress, 
  setupTimer, 
  createMiningToastMessage 
} from '@/app/utils/miningUtils';

// Örnek veri - normalde API'den gelecek
const MOCK_MINING_SESSION = {
  id: '1',
  car: {
    id: '1',
    name: 'Lambo Aventador',
    image: '/cars/lambo.png',
    fuel: 80,
    condition: 90
  },
  garage: {
    id: '1',
    name: 'Premium Garage',
    level: 2
  },
  start_time: new Date(new Date().getTime() - 4 * 60 * 60 * 1000).toISOString(), // 4 saat önce
  end_time: new Date(new Date().getTime() + 4 * 60 * 60 * 1000).toISOString(), // 4 saat sonra
  expected_reward: 250,
  status: 'active'
};

const MiningStatus: React.FC = () => {
  const [miningSession, setMiningSession] = useState(MOCK_MINING_SESSION);
  const [timeLeft, setTimeLeft] = useState('');
  const [progress, setProgress] = useState(0);
  const [isCollecting, setIsCollecting] = useState(false);
  const [timerRef, setTimerRef] = useState<NodeJS.Timeout | null>(null);
  const [status, setStatus] = useState('idle');
  const [activeSession, setActiveSession] = useState<typeof MOCK_MINING_SESSION | null>(null);
  
  // Mining tamamlandı mı kontrolü
  const isCompleted = miningSession ? new Date() >= new Date(miningSession.end_time) : false;

  // Kalan süreyi hesaplama
  useEffect(() => {
    if (!miningSession) return;
    
    const calculateTimeLeft = () => {
      const now = new Date();
      const endTime = new Date(miningSession.end_time);
      
      // Mining tamamlanmış mı kontrol et
      if (now >= endTime) {
        setTimeLeft('Tamamlandı!');
        setProgress(100);
        return;
      }
      
      // Kalan süreyi hesapla
      const start = new Date(miningSession.start_time).getTime();
      const end = endTime.getTime();
      const total = end - start;
      const elapsed = now.getTime() - start;
      const percentage = (elapsed / total) * 100;
      
      setProgress(Math.min(100, percentage));
      
      // Kalan süreyi formatla (saat:dakika:saniye)
      const remaining = end - now.getTime();
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
      
      setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };
    
    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    
    return () => clearInterval(interval);
  }, [miningSession]);
  
  // Ödül toplama
  const handleCollect = async () => {
    if (!isCompleted || isCollecting) return;
    
    setIsCollecting(true);
    
    // Normalde API çağrısı yapılacak
    setTimeout(() => {
      console.log('Collecting rewards...');
      setMiningSession({...MOCK_MINING_SESSION, status: 'completed'});
      setIsCollecting(false);
      
      // Bildirimi göster
      alert(`${miningSession.expected_reward} puan toplandı!`);
    }, 1500);
  };
  
  // Mining başlatma
  const startMining = useCallback(() => {
    // Gerçek uygulamada bu veriler API'dan gelecek
    const startTime = new Date();
    const endTime = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 saat
    
    const mockMiningSession = {
      id: 'mining-session-1',
      car: {
        id: '2',
        name: 'Standart Maden Aracı',
        image: '/cars/mining-tool.png',
        fuel: 100,
        condition: 100
      },
      garage: {
        id: '1',
        name: 'Premium Garage',
        level: 2
      },
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      expected_reward: 25,
      status: 'active'
    };

    setActiveSession(mockMiningSession);
    setStatus('mining');
    setProgress(0);

    // Zamanlayıcıyı kur
    const timer = setupTimer(
      endTime,
      (formattedTimeLeft, calculatedProgress) => {
        setTimeLeft(formattedTimeLeft);
        setProgress(calculatedProgress);
      },
      () => {
        setStatus('completed');
        // Gerçek uygulamada burada bildirim gönderilebilir
        console.log(createMiningToastMessage('complete'));
      },
      startTime
    );

    // Zamanlayıcı temizleme fonksiyonunu sakla
    setTimerRef(timer);

    // Gerçek uygulamada burada API çağrısı yapılacak
    console.log(createMiningToastMessage('start'));
  }, []);

  // Önceki zamanlayıcıyı temizle
  useEffect(() => {
    return () => {
      if (timerRef) {
        clearInterval(timerRef);
      }
    };
  }, [timerRef]);

  // Mining tamamlandığında ödül toplama
  const collectReward = useCallback(() => {
    if (status === 'completed' && activeSession) {
      // Gerçek uygulamada burada API çağrısı yapılacak
      console.log(createMiningToastMessage('collect', activeSession.expected_reward));
      
      // Durumu sıfırla
      setStatus('idle');
      setActiveSession(null);
      setProgress(0);
      setTimeLeft('00:00:00');
    }
  }, [status, activeSession]);
  
  if (!miningSession) {
    return (
      <div className="game-card p-4 mb-4">
        <h2 className="text-lg font-semibold mb-4">Mining</h2>
        <div className="text-center py-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center border-2 border-dashed border-gray-500">
            <PlayIcon />
          </div>
          <p className="text-gray-400 mb-4">Şu anda aktif bir mining işlemi yok.</p>
          <button 
            onClick={startMining}
            className="bg-gradient-to-r from-accent-primary to-accent-secondary text-white py-2 px-6 rounded-full font-medium"
          >
            Mining Başlat
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="game-card p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Aktif Mining</h2>
        <div className="flex items-center text-sm">
          <CoinIcon />
          <span className="ml-1 font-mono">{miningSession.expected_reward}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-400">Araç</p>
          <p className="font-medium">{miningSession.car.name}</p>
          <div className="mt-1 flex items-center text-xs text-gray-400">
            <div className="w-1.5 h-1.5 bg-orange-400 rounded-full mr-1"></div>
            <span className="mr-2">%{miningSession.car.fuel}</span>
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-1"></div>
            <span>%{miningSession.car.condition}</span>
          </div>
        </div>
        
        <div>
          <p className="text-xs text-gray-400">Garaj</p>
          <p className="font-medium">{miningSession.garage.name}</p>
          <p className="text-xs text-gray-400">Seviye {miningSession.garage.level}</p>
        </div>
      </div>
      
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <div className="flex items-center">
            <TimeIcon />
            <span className="ml-1">İlerleme</span>
          </div>
          <span className={`${isCompleted ? 'text-accent-primary' : ''}`}>
            {isCompleted ? 'Tamamlandı!' : timeLeft}
          </span>
        </div>
        
        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-accent-primary to-accent-secondary"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{new Date(miningSession.start_time).toLocaleTimeString()}</span>
          <span>{new Date(miningSession.end_time).toLocaleTimeString()}</span>
        </div>
      </div>
      
      <button
        onClick={collectReward}
        disabled={!isCompleted || isCollecting}
        className={`w-full py-2 rounded-lg font-medium transition-colors ${
          isCompleted 
            ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-white' 
            : 'bg-gray-800 text-gray-400'
        }`}
      >
        {isCollecting ? 
          <>
            <span className="inline-block animate-spin mr-2">⏳</span>
            İşleniyor...
          </> : 
          isCompleted ? 'Ödülü Topla' : 'Mining Devam Ediyor'
        }
      </button>
    </div>
  );
}

export default MiningStatus; 