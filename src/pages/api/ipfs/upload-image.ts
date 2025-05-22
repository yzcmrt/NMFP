import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import axios from 'axios';

// formidable'ın body'yi parse etmesini engelle
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // Formidable ile gelen dosyayı işle
    const form = formidable({
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024 // 10MB limit
    });
    
    const formData = await new Promise<{ fields: formidable.Fields; files: formidable.Files }>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve({ fields, files });
      });
    });

    // Dosya bilgilerini al
    const fileArray = formData.files.file;
    if (!fileArray || !Array.isArray(fileArray) || fileArray.length === 0) {
      return res.status(400).json({ message: 'Dosya bulunamadı' });
    }
    const file = fileArray[0];
    
    console.log('Dosya alındı:', file.originalFilename, 'boyut:', file.size);

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

    // Dosyayı oku ve Blob oluştur
    const fileBuffer = fs.readFileSync(file.filepath);
    const blob = new Blob([fileBuffer], { type: file.mimetype || 'application/octet-stream' });
    
    console.log('Dosya okundu, IPFS\'e yükleniyor...');

    // Dosyayı Pinata'ya yükle
    const formDataPinata = new FormData();
    
    // Dosya adını temizle ve kullan
    let fileName = req.body.fileName || file.originalFilename || `car-image-${Date.now()}.jpg`;
    
    // Dosya isminde rastgele timestamp bilgisi kullanmaktan kaçın
    if (!req.body.fileName && file.originalFilename) {
      fileName = file.originalFilename.replace(/[-_\s]+\d+\./, '.').toLowerCase();
    }
    
    // Blobları FormData'ya ekle
    formDataPinata.append('file', blob, fileName);

    const pinataMetadata = JSON.stringify({
      name: fileName,
    });
    formDataPinata.append('pinataMetadata', pinataMetadata);

    const pinataOptions = JSON.stringify({
      cidVersion: 0,
    });
    formDataPinata.append('pinataOptions', pinataOptions);

    let response;
    console.log('Pinata API isteği gönderiliyor...');

    try {
      // JWT veya API key/secret kullanarak yükle
      if (pinataJWT) {
        response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formDataPinata, {
          maxBodyLength: Infinity,
          headers: {
            'Authorization': `Bearer ${pinataJWT}`,
          },
          timeout: 60000 // 60 saniye timeout
        });
      } else {
        response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formDataPinata, {
          maxBodyLength: Infinity,
          headers: {
            'pinata_api_key': pinataApiKey,
            'pinata_secret_api_key': pinataSecretApiKey,
          },
          timeout: 60000 // 60 saniye timeout
        });
      }
      
      console.log('Pinata API yanıtı:', response.status, response.statusText);
    } catch (axiosError) {
      console.error('Pinata API isteği başarısız:', axiosError);
      throw axiosError;
    }

    // İşlem sonrası temizlik - geçici dosyayı sil
    try {
      fs.unlinkSync(file.filepath);
    } catch (unlinkError) {
      console.warn('Geçici dosya silinirken hata:', unlinkError);
    }

    // Başarılı yanıt döndür
    return res.status(200).json({
      success: true,
      ipfsHash: response.data.IpfsHash,
      gatewayUrl: `https://${process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'ivory-calm-vicuna-368.mypinata.cloud'}/ipfs/${response.data.IpfsHash}`,
    });
  } catch (error: any) {
    console.error('IPFS yükleme hatası:', error);
    
    let statusCode = 500;
    let errorMessage = 'Dosya yüklenirken bir hata oluştu';
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