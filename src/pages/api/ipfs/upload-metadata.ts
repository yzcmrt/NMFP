import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import Pinata from '@pinata/sdk';

const pinata = new Pinata(process.env.PINATA_API_KEY || process.env.NEXT_PUBLIC_PINATA_API_KEY, process.env.PINATA_API_SECRET || process.env.NEXT_PUBLIC_PINATA_SECRET_KEY);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const metadata = JSON.parse(req.body.metadata || req.body);
    
    // Standart bir dosya adı kullan, timestamp kullanmaktan kaçın
    const fileName = req.body.fileName || `metadata_${metadata.name.toLowerCase().replace(/\s+/g, '_')}`;
    
    // Pinata için options ve metadata hazırla
    const options = {
      pinataMetadata: {
        name: fileName,
      },
      pinataOptions: {
        cidVersion: 0,
      },
    };
    
    // Pinata'ya metadatayı yükle
    const result = await pinata.pinJSONToIPFS(metadata, options);

    // Başarılı yanıt döndür
    return res.status(200).json({
      success: true,
      ipfsHash: result.IpfsHash,
      gatewayUrl: `https://${process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'ivory-calm-vicuna-368.mypinata.cloud'}/ipfs/${result.IpfsHash}`,
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