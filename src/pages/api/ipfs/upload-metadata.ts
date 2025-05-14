import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // Request body'den metadata'yı al
    const { metadata } = req.body;

    if (!metadata) {
      return res.status(400).json({ message: 'Metadata eksik' });
    }

    // Pinata kimlik bilgileri - hem NEXT_PUBLIC_ hem de normal değişkenleri kontrol et
    const pinataApiKey = process.env.PINATA_API_KEY || process.env.NEXT_PUBLIC_PINATA_API_KEY;
    const pinataSecretApiKey = process.env.PINATA_API_SECRET || process.env.NEXT_PUBLIC_PINATA_SECRET_KEY;
    const pinataJWT = process.env.PINATA_JWT || process.env.NEXT_PUBLIC_PINATA_JWT;

    if (!pinataJWT && (!pinataApiKey || !pinataSecretApiKey)) {
      console.error('Pinata kimlik bilgileri bulunamadı:', { 
        hasApiKey: !!pinataApiKey, 
        hasApiSecret: !!pinataSecretApiKey, 
        hasJWT: !!pinataJWT 
      });
      return res.status(500).json({ message: 'Pinata kimlik bilgileri eksik' });
    }

    // Data için Pinata formatı oluştur
    const data = {
      pinataOptions: {
        cidVersion: 0
      },
      pinataMetadata: {
        name: `${metadata.name || 'nmfp-nft'}-metadata-${Date.now()}`,
      },
      pinataContent: metadata
    };

    let response;
    console.log('Pinata API isteği gönderiliyor...');

    // JWT veya API key/secret kullanarak yükle
    if (pinataJWT) {
      response = await axios.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', data, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${pinataJWT}`,
        },
        maxBodyLength: Infinity,
        timeout: 30000 // 30 saniye timeout
      });
    } else {
      response = await axios.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', data, {
        headers: {
          'Content-Type': 'application/json',
          'pinata_api_key': pinataApiKey,
          'pinata_secret_api_key': pinataSecretApiKey,
        },
        maxBodyLength: Infinity,
        timeout: 30000 // 30 saniye timeout
      });
    }

    console.log('Pinata API yanıtı:', response.status, response.statusText);

    // Başarılı yanıt döndür
    return res.status(200).json({
      success: true,
      ipfsHash: response.data.IpfsHash,
      gatewayUrl: `https://${process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'ivory-calm-vicuna-368.mypinata.cloud'}/ipfs/${response.data.IpfsHash}`,
    });
  } catch (error: any) {
    console.error('IPFS metadata yükleme hatası:', error);
    
    let statusCode = 500;
    let errorMessage = 'Metadata yüklenirken bir hata oluştu';
    let errorDetails = {};
    
    if (axios.isAxiosError(error)) {
      console.error('Axios yanıt verileri:', error.response?.data);
      console.error('Axios yanıt durumu:', error.response?.status);
      statusCode = error.response?.status || 500;
      errorMessage = error.response?.data?.message || errorMessage;
      errorDetails = {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers
      };
    }
    
    return res.status(statusCode).json({ 
      message: errorMessage, 
      error: error.message,
      details: errorDetails 
    });
  }
} 