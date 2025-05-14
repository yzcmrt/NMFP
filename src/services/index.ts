/**
 * Eski NFT servis re-export dosyası, yeni servise yönlendirme sağlar.
 * DEPRECATION: Bu dosya yakında kaldırılacaktır. Lütfen doğrudan @/nft/services'i import edin.
 */

import { NFTService } from '../nft/services';

// Singleton instance
export const nftService = new NFTService();

// IPFS servisini de yeni servisten re-export edelim
export * from './ipfsService';

// Not: Eski servis yakında kaldırılacak, lütfen yeni NFT servisini kullanın
// Import örneği: import { NFTService } from '@/nft/services'; 