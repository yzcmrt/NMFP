export function gameErrorMessage(message: string): string {
  if (message.startsWith("NMFP:")) return message.slice(5);
  const known: [RegExp, string][] = [
    [/zaten mining/i, "Bu araç zaten mining yapıyor."],
    [
      /garaj kapasitesi/i,
      "Garaj kapasitesi dolu. Bir turun bitmesini bekleyin veya yeni garaj edinin.",
    ],
    [
      /yeterli yakıt|yeterli yakit/i,
      "Mining başlatmak için en az %25 yakıt gerekiyor.",
    ],
    [
      /kondisyonu yetersiz/i,
      "Mining başlatmak için en az %10 kondisyon gerekiyor.",
    ],
    [/yeterli bakiye|insufficient balance/i, "Yeterli NMFP bakiyesi yok."],
    [
      /zaten.*sahip|already own|duplicate key/i,
      "Bu öğe zaten hesabında. Garajını yenileyin.",
    ],
    [/uygun değil/i, "Araç şu anda mining için uygun değil."],
  ];
  return (
    known.find(([pattern]) => pattern.test(message))?.[1] ||
    "İşlem tamamlanamadı. Verileri yenileyip tekrar deneyin."
  );
}
