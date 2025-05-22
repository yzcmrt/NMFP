import { NextApiRequest, NextApiResponse } from 'next';
import Pinata from 'pinata-sdk';

// Pinata SDK'yı başlat
const pinata = new Pinata(
  process.env.PINATA_API_KEY || process.env.NEXT_PUBLIC_PINATA_API_KEY || '', 
  process.env.PINATA_API_SECRET || process.env.NEXT_PUBLIC_PINATA_SECRET_KEY || ''
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Bu endpoint sadece POST isteklerini kabul eder
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // Pinata dosyalarını listele
    const pinList = await pinata.pinList({
      status: 'pinned',
      pageLimit: 100, // Maksimum dosya sayısı - gerekirse artırılabilir
    });

    if (!pinList.rows) {
      return res.status(500).json({ 
        message: 'Pinata API yanıt hatasıコ - rows alanı yok' 
      });
    }

    // Tüm dosyaları dizi olarak al
    const allFiles = pinList.rows;
    
    // Metadata dosyalarını filtreleme
    const metadataFiles = allFiles.filter(file => {
      const name = file.metadata?.name || '';
      return name.toLowerCase().includes('metadata') || 
             name.toLowerCase().endsWith('.json') ||
             name.toLowerCase().includes('-metadata-');
    });

    // Clean model isimleri kümesi oluşturma (car_911_carrera gibi)
    const modelNameSet = new Set<string>();
    
    // Yüksek kaliteli dosyalar listesi - bunlar korunacak
    const highQualityFiles: { name: string, hash: string }[] = [];
    
    // Silinecek dosyalar listesi
    const toDeleteList: string[] = [];
    
    // 1. Adım: Metadata'lar arasından en iyileri seçme
    metadataFiles.forEach(file => {
      const name = file.metadata?.name || '';
      
      // Standart bir isim oluştur (timestamp, Porsche/NMFP prefix, metadata suffix'i kaldır)
      const cleanName = name
        .replace(/^(Porsche|NMFP)\s+/g, '')
        .replace(/-metadata(-\d+)?\.json$|(-metadata-\d+)$/g, '')
        .replace(/metadata_/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_');
      
      // Model ismini içeren temiz ismi kaydet
      if (cleanName) {
        modelNameSet.add(cleanName);
      }
      
      // Her model için yalnızca en yeni/en iyi dosyayı tutacağız
      // Timestamp içeren dosyalar yerine temiz adlandırmalı dosyaları tercih et
      if (!name.includes('-metadata-')) {
        // Zamansal damga içermeyen isimler daha temiz - bunları koru
        highQualityFiles.push({
          name: cleanName,
          hash: file.ipfs_pin_hash
        });
      }
    });
    
    // 2. Adım: Her bir model için en iyi metadata dosyası dışındakileri işaretleme
    metadataFiles.forEach(file => {
      const name = file.metadata?.name || '';
      const cleanName = name
        .replace(/^(Porsche|NMFP)\s+/g, '')
        .replace(/-metadata(-\d+)?\.json$|(-metadata-\d+)$/g, '')
        .replace(/metadata_/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_');
        
      // Herhangi bir yüksek kaliteli dosyaya uymuyor ve temiz ismi yok 
      // veya timestamp içeriyorsa sil
      if (
        !highQualityFiles.some(hqf => hqf.hash === file.ipfs_pin_hash) && 
        (name.includes('-metadata-') || !cleanName)
      ) {
        toDeleteList.push(file.ipfs_pin_hash);
      }
    });
    
    // 3. Adım: Silinecek dosyaları Pinata'dan kaldır
    const deletionResults = [];
    for (const hash of toDeleteList) {
      try {
        await pinata.unpin(hash);
        deletionResults.push({
          hash,
          status: 'success'
        });
      } catch (error) {
        deletionResults.push({
          hash,
          status: 'error',
          error: error instanceof Error ? error.message : 'Bilinmeyen hata'
        });
      }
    }
    
    // Sonuçları döndür
    return res.status(200).json({
      success: true,
      highQualityFiles,
      modelNames: Array.from(modelNameSet),
      deleted: deletionResults,
      deletedCount: deletionResults.length,
      message: `${deletionResults.length} gereksiz metadata dosyası temizlendi.`
    });
    
  } catch (error: any) {
    console.error('Pinata temizleme hatası:', error);
    return res.status(500).json({ 
      message: 'Pinata temizleme işlemi başarısız oldu',
      error: error.message || 'Bilinmeyen hata'
    });
  }
} 