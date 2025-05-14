// TON cüzdan için global tip tanımlaması
interface Window {
  ton?: {
    sendTransaction: (options: {
      to: string;
      value: number;
      payload?: string;
    }) => Promise<any>;
    // TON cüzdanı için diğer metodlar buraya eklenebilir
  };
}

// TON Connect için tip tanımları
declare module '@tonconnect/ui-react' {
  export interface SendTransactionRequest {
    validUntil: number;
    messages: Array<{
      address: string;
      amount: string | number;
      payload?: string;
    }>;
  }

  export interface TonConnectUI {
    connected: boolean;
    sendTransaction: (options: SendTransactionRequest) => Promise<any>;
  }

  export function useTonConnectUI(): [TonConnectUI];
  export function TonConnectButton(): JSX.Element;
}

// crypto-browserify modülü bildirimi
declare module 'crypto-browserify';

// Veritabanı için Telegram kullanıcı bilgileri
interface TelegramDatabaseUser {
  telegram_id: number;           // Telegram kullanıcı ID (zorunlu)
  username: string;              // Kullanıcı adı (zorunlu)
  first_name: string;            // İlk adı (zorunlu)
  last_name?: string;            // Soyadı (opsiyonel)
  language_code?: string;        // Dil kodu (opsiyonel)
  is_premium?: boolean;          // Premium durumu (opsiyonel)
  photo_url?: string;            // Profil fotoğrafı URL (opsiyonel)
  allows_write_to_pm?: boolean;  // PM izni (opsiyonel)
  added_to_attachment_menu?: boolean; // Eklenti menüsü durumu (opsiyonel)
}

export {}; 