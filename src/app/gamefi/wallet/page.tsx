'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { formatCurrency } from '@/app/utils/formatters';
import React from 'react';
import { 
  Transaction, 
  TransactionType,
  User
} from '@/types';
import { 
  transactionService, 
} from '@/services/api';
import { TonConnectButton, useTonAddress, useTonWallet, useTonConnectUI } from '@tonconnect/ui-react';
import { toast } from 'react-hot-toast';
import { useTelegram } from '@/components/TelegramInitProvider';

export default function WalletPage() {
  const [activeTab, setActiveTab] = useState('balance');
  const [showQR, setShowQR] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState<boolean>(true);
  const [transactionError, setTransactionError] = useState<string | null>(null);

  const { user: contextUser, isLoading: isUserLoading, error: userError } = useTelegram();

  const wallet = useTonWallet();
  const userFriendlyAddress = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();

  useEffect(() => {
    const setupTonProof = async () => {
      try {
        tonConnectUI.setConnectRequestParameters({ state: 'loading' });
        
        const fetchTonProofPayload = async () => {
          return "needmoneyforporsche.wtf/=" + Math.floor(Date.now() / 1000).toString();
        };
        
        const tonProofPayload = await fetchTonProofPayload();
        
        if (!tonProofPayload) {
          tonConnectUI.setConnectRequestParameters(null);
        } else {
          tonConnectUI.setConnectRequestParameters({
            state: "ready",
            value: { tonProof: tonProofPayload }
          });
        }
      } catch (error) {
        console.error('TON Proof ayarlama hatası:', error);
        tonConnectUI.setConnectRequestParameters(null);
      }
    };
    
    if (!wallet) {
      setupTonProof();
    }
  }, [tonConnectUI, wallet]);
  
  useEffect(() => {
    const fetchTransactions = async () => {
      if (!contextUser || !contextUser.id) {
        console.warn('[WalletPage] Kullanıcı bilgisi henüz yok, işlem çekme atlanıyor.');
        setIsLoadingTransactions(false);
        return;
      }

      try {
        setIsLoadingTransactions(true);
        setTransactionError(null);

        console.log(`[WalletPage] Kullanıcı ${contextUser.id} için işlemler çekiliyor...`);
        const transactionsData = await transactionService.getUserTransactions(contextUser.id, 20);

        console.log(`[WalletPage] ${transactionsData.length} işlem bulundu.`);
        setTransactions(transactionsData);
      } catch (err: any) {
        console.error('[WalletPage] İşlem yükleme hatası:', err);
        setTransactionError(err.message || 'İşlemler yüklenirken bir hata oluştu.');
      } finally {
        setIsLoadingTransactions(false);
      }
    };

    if (!isUserLoading && contextUser) {
      fetchTransactions();
    } else if (!isUserLoading && !contextUser) {
      setIsLoadingTransactions(false);
    }
  }, [contextUser, isUserLoading]);
  
  useEffect(() => {
    const validateAndConnectWallet = async () => {
      if (wallet) {
        console.log('TON Cüzdanı bağlandı:', wallet);
        console.log('Cüzdan adresi:', userFriendlyAddress);
      }
    };
    
    validateAndConnectWallet();
  }, [wallet, userFriendlyAddress, contextUser]);
  
  const shortAddress = wallet ? 
    `${userFriendlyAddress.substring(0, 6)}...${userFriendlyAddress.substring(userFriendlyAddress.length - 4)}` : 
    contextUser?.wallet_address ? 
    `${contextUser.wallet_address.substring(0, 6)}...${contextUser.wallet_address.substring(contextUser.wallet_address.length - 4)}` : 
    '';
  
  const copyToClipboard = () => {
    const addressToCopy = wallet ? userFriendlyAddress : contextUser?.wallet_address;
    if (!addressToCopy) return;
    navigator.clipboard.writeText(addressToCopy)
      .then(() => {
        toast.success('Cüzdan adresi kopyalandı');
      })
      .catch(err => {
        console.error('Kopyalama hatası:', err);
        toast.error('Adres kopyalanırken bir hata oluştu');
      });
  };
  
  const sendTransaction = async () => {
    if (!wallet) {
      toast.error('Lütfen önce cüzdanınızı bağlayın!');
      return;
    }
    
    try {
      setIsLoadingTransactions(true);
      
      const amountPrompt = prompt('Göndermek istediğiniz TON miktarını girin:', '0.1');
      if (!amountPrompt) {
        setIsLoadingTransactions(false);
        return;
      }
      
      const amountToSend = parseFloat(amountPrompt);
      if (isNaN(amountToSend) || amountToSend <= 0) {
        toast.error('Lütfen geçerli bir miktar girin');
        setIsLoadingTransactions(false);
        return;
      }
      
      const gameWalletAddress = process.env.NEXT_PUBLIC_GAME_WALLET_ADDRESS || 
                               "UQAC6bB2_GD_CMnBRBTO8HNomIdsH7mID1nk4Pc_NTiVquD3";
      
      const amountInNano = Math.floor(amountToSend * 1_000_000_000).toString();
      
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 60 * 10,
        messages: [
          {
            address: gameWalletAddress,
            amount: amountInNano,
            payload: "NMFP GameFi Transfer"
          }
        ]
      };
      
      console.log('Gönderilecek işlem:', transaction);
      toast.loading('İşlem gönderiliyor...');
      
      const result = await tonConnectUI.sendTransaction(transaction);
      console.log('İşlem sonucu:', result);
      
      if (result) {
        toast.success(`${amountToSend} TON başarıyla gönderildi!`);
        
        setTimeout(() => {
        }, 5000);
      } else {
        toast.error('İşlem sırasında bir sorun oluştu.');
      }
    } catch (error) {
      console.error('İşlem hatası:', error);
      let errorMessage = 'İşlem sırasında bir hata oluştu';
      
      if (error instanceof Error) {
        if (error.message.includes('rejected')) {
          errorMessage = 'İşlem kullanıcı tarafından reddedildi';
        } else if (error.message.includes('balance')) {
          errorMessage = 'Yetersiz bakiye';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'İşlem zaman aşımına uğradı';
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoadingTransactions(false);
    }
  };
  
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
  const getTransactionIcon = (type: TransactionType | string): React.ReactNode => {
    const typeEnum = Object.values(TransactionType).find(enumVal => enumVal === type);

    switch (typeEnum) {
      case TransactionType.DEPOSIT:
        return (
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
            </svg>
          </div>
        );
      case TransactionType.WITHDRAW:
        return (
          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v3.586L7.707 7.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 7.586V5z" clipRule="evenodd" />
            </svg>
          </div>
        );
      case TransactionType.REWARD:
      case TransactionType.TASK_REWARD:
      case TransactionType.TASK_REWARD_CLAIMED:
      case TransactionType.MINING_REWARD:
        return (
          <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
            </svg>
          </div>
        );
      case TransactionType.PURCHASE_CAR:
      case TransactionType.PURCHASE_GARAGE:
        return (
          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
            </svg>
          </div>
        );
      case TransactionType.REPAIR_CAR:
        return (
          <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      case TransactionType.REFILL_CAR:
        return (
          <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      case TransactionType.EXPENSE:
        return (
          <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-gray-500/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
            </svg>
          </div>
        );
    }
  };
  
  const getTransactionLabel = (transaction: Transaction): string => {
    const type = transaction.type as TransactionType | string;
    const typeEnum = Object.values(TransactionType).find(enumVal => enumVal === type);

    switch (typeEnum) {
      case TransactionType.DEPOSIT:
        return 'Para Yatırma';
      case TransactionType.WITHDRAW:
        return 'Para Çekme';
      case TransactionType.REWARD:
      case TransactionType.TASK_REWARD:
      case TransactionType.TASK_REWARD_CLAIMED:
      case TransactionType.MINING_REWARD:
        return `Ödül ${transaction.source ? `(${transaction.source})` : ''}`;
      case TransactionType.PURCHASE_CAR:
      case TransactionType.PURCHASE_GARAGE:
        return `Satın Alma ${transaction.item ? `(${transaction.item})` : ''}`;
      case TransactionType.REPAIR_CAR:
        return `Araç Tamiri ${transaction.item ? `(${transaction.item})` : ''}`;
      case TransactionType.REFILL_CAR:
        return `Yakıt Dolumu ${transaction.item ? `(${transaction.item})` : ''}`;
      case TransactionType.EXPENSE:
        return `Masraf ${transaction.source ? `(${transaction.source})` : ''}`;
      default:
        return typeof type === 'string' ? type : 'Bilinmeyen İşlem';
    }
  };
  
  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#7b2ff7]"></div>
        <p className="ml-4 text-gray-400">Kullanıcı bilgileri yükleniyor...</p>
      </div>
    );
  }

  if (userError) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
        <p className="text-red-400">Kullanıcı bilgileri yüklenemedi: {userError}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 bg-[#7b2ff7] text-white px-4 py-2 rounded-lg"
        >
          Yeniden Dene
        </button>
      </div>
    );
  }

  if (!contextUser) {
     return (
       <div className="bg-yellow-500/10 border border-yellow-500 rounded-xl p-4 text-center">
         <p className="text-yellow-500">Kullanıcı bilgileri bulunamadı. Lütfen Telegram uygulamasından tekrar deneyin veya destek ile iletişime geçin.</p>
       </div>
     );
  }

  return (
    <div>
      <div className="mobile-app-header relative mb-6">
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-[#7b2ff7] via-[#2f7bf7] to-[#2ff7c1] opacity-80"></div>
        <h1 className="page-title w-full text-center text-2xl font-bold py-4 text-transparent bg-clip-text bg-gradient-to-r from-white via-[#7b2ff7] to-white drop-shadow-[0_0_2px_rgba(123,47,247,0.3)]">Cüzdan</h1>
      </div>
      
      <div className="flex justify-end mb-6">
        <TonConnectButton />
      </div>
      
      {wallet && (
        <div className="bg-green-500/10 border border-green-500 rounded-xl p-4 text-center mb-6">
          <p className="text-green-500">TON cüzdanı başarıyla bağlandı!</p>
          <p className="text-sm text-gray-400 mt-1 truncate overflow-hidden max-w-full">{userFriendlyAddress}</p>
        </div>
      )}
      
      <div className="rounded-xl bg-gradient-to-r from-[#0f3460] to-[#1a1a2e] p-5 mb-5 relative overflow-hidden border border-[#2a3855] shadow-lg">
        <div className="flex justify-between items-start z-10 relative">
          <div>
            <p className="text-xs text-gray-400 mb-1">Toplam Bakiye</p>
            <h2 className="text-2xl font-bold text-[#2ff7c1]">{formatCurrency(contextUser?.balance || 0)} NMFP</h2>
            
            <div className="mt-4 flex items-center">
              <span className="text-xs text-gray-400 mr-2">{shortAddress}</span>
              <button 
                onClick={copyToClipboard}
                className="p-1 bg-[#2a3855]/50 rounded-md hover:bg-[#2a3855] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
                  <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z" />
                </svg>
              </button>
            </div>
          </div>
          
          <div>
            <Image 
              src="/images/qr-code-placeholder.png" 
              alt="QR Code" 
              width={80} 
              height={80}
              className="rounded-md bg-white p-1 cursor-pointer transition-transform duration-300 hover:scale-105"
              onClick={() => setShowQR(true)}
            />
          </div>
        </div>
        
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#7b2ff7] opacity-5 rounded-bl-full"></div>
        <div className="absolute bottom-0 left-0 w-16 h-16 bg-[#2ff7c1] opacity-5 rounded-tr-full"></div>
      </div>
      
      <div className="grid grid-cols-3 gap-3 mb-6">
        <button 
          className="bg-gradient-to-r from-[#0f3460] to-[#1a1a2e] p-3 rounded-xl flex flex-col items-center justify-center border border-[#2a3855] transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/20"
        >
          <div className="w-10 h-10 rounded-full bg-[#7b2ff7]/20 flex items-center justify-center mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#7b2ff7]" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="text-xs text-white">Yatır</span>
        </button>
        
        <button 
          className="bg-gradient-to-r from-[#0f3460] to-[#1a1a2e] p-3 rounded-xl flex flex-col items-center justify-center border border-[#2a3855] transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/20"
        >
          <div className="w-10 h-10 rounded-full bg-[#2ff7c1]/20 flex items-center justify-center mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#2ff7c1]" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v3.586L7.707 7.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 7.586V5z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="text-xs text-white">Çek</span>
        </button>
        
        <button 
          onClick={sendTransaction}
          className="bg-gradient-to-r from-[#0f3460] to-[#1a1a2e] p-3 rounded-xl flex flex-col items-center justify-center border border-[#2a3855] transition-all duration-300 hover:shadow-lg hover:shadow-[#7b2ff7]/20"
        >
          <div className="w-10 h-10 rounded-full bg-[#2f7bf7]/20 flex items-center justify-center mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#2f7bf7]" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="text-xs text-white">İşlem</span>
        </button>
      </div>
      
      <div className="flex justify-between bg-gradient-to-r from-[#1a1a2e] via-[#16213e] to-[#0f3460] rounded-xl p-1.5 shadow-lg border border-[#2a3855] mb-5">
        <button
          className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === 'balance' ? 'bg-gradient-to-r from-[#7b2ff7] via-[#5f40f8] to-[#2f7bf7] text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-[#16213e]/80'}`}
          onClick={() => setActiveTab('balance')}
        >
          İşlemler
        </button>
      </div>
      
      <div className="space-y-3">
        {isLoadingTransactions ? (
          <div className="flex items-center justify-center min-h-[100px]">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#7b2ff7]"></div>
            <p className="ml-3 text-gray-400">İşlemler yükleniyor...</p>
          </div>
        ) : transactionError ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
            <p className="text-red-400">İşlemler yüklenemedi: {transactionError}</p>
          </div>
        ) : transactions.length > 0 ? (
          transactions.map((transaction) => (
            <div 
              key={transaction.id} 
              className="bg-gradient-to-r from-[#0f3460] to-[#1a1a2e] rounded-xl p-4 border border-[#2a3855] transition-all duration-300 hover:shadow-sm hover:shadow-[#7b2ff7]/20"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getTransactionIcon(transaction.type)}
                  <div>
                    <p className="font-medium text-white">{getTransactionLabel(transaction)}</p>
                    <p className="text-xs text-gray-400">{formatDate(transaction.date)}</p>
                  </div>
                </div>
                <div>
                  <p className={`font-medium ${transaction.amount > 0 ? 'text-[#2ff7c1]' : 'text-red-400'}`}>
                    {transaction.amount > 0 ? '+' : ''}{formatCurrency(transaction.amount)} NMFP
                  </p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-400">
            <p>Henüz işlem bulunamadı.</p>
          </div>
        )}
      </div>
    </div>
  );
} 