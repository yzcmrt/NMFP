"use client";
import { useEffect, useState } from "react";
import {
  TonConnectButton,
  useTonConnectUI,
  useTonWallet,
} from "@tonconnect/ui-react";
export default function NftSetup() {
  const [ui] = useTonConnectUI(),
    wallet = useTonWallet();
  const [data, setData] = useState<any>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function refresh() {
    try {
      const r = await fetch("/api/nft/setup", { cache: "no-store" }),
        d = await r.json();
      if (!r.ok) throw Error(d.message);
      setData(d);
    } catch {
      setMessage("Kurulum bilgisi yüklenemedi.");
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function send() {
    if (!data?.transaction) return;
    setBusy(true);
    try {
      await ui.sendTransaction(data.transaction);
      setMessage(
        "İşlem cüzdana gönderildi. Zincir onayından sonra durumu yenile.",
      );
    } catch {
      setMessage("İşlem tamamlanmadı. Cüzdanı ve işlem sonucunu kontrol et.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-bold">Koleksiyon sahibi kurulumu</h1>
      <p>
        Bu ekran yalnızca koleksiyon yöneticisi içindir. Oyuncular bu işlemleri
        yapmaz.
      </p>
      {data && (
        <>
          <p className="break-all text-sm">Koleksiyon: {data.collection}</p>
          <p className="break-all text-sm">Mevcut sahip: {data.owner}</p>
          {!data.signerAddress ? (
            <p>
              Yeni otomatik mint cüzdanı sunucuda yapılandırılmalı. Kurtarma
              kelimelerini bu sayfaya veya sohbete yazma.
            </p>
          ) : (
            <>
              <p className="break-all text-sm">
                Otomatik mint cüzdanı (V4): {data.signerAddress}
              </p>
              <p>
                Bu adreste en az 0,15 TON işlem bütçesi bulunmalı. Her mint için
                cüzdandan 0,1 TON ayrılır; ağın kullanmadığı tutarın bir kısmı
                kontratlarda kalabilir.
              </p>
              <TonConnectButton />
              {data.step === "done" ? (
                <p>
                  Metadata ve sahip bağlantısı hazır. Otomatik işleyici
                  etkinleştirildikten sonra satış açılır.
                </p>
              ) : (
                <>
                  <p>
                    {data.step === "metadata"
                      ? "İlk adım: koleksiyonun NFT metadata dizinini nmfp.vercel.app adresine bağla. Koleksiyonun adı, görselleri ve royalty ayarları korunur."
                      : "İkinci adım: koleksiyon sahipliğini yukarıdaki otomatik mint cüzdanına devret. Bu cüzdan bundan sonra koleksiyonu yönetebilir."}
                  </p>
                  <p>
                    Her kurulum işlemi için 0,1 TON gönderilir ve ağ ücreti
                    uygulanır. Adresleri cüzdanın onay ekranında kontrol et.
                  </p>
                  <button
                    className="cyber-button disabled:opacity-40"
                    disabled={
                      busy ||
                      wallet?.account.address !== data.owner ||
                      wallet?.account.chain !== "-239"
                    }
                    onClick={() => void send()}
                  >
                    {data.step === "metadata"
                      ? "Metadata bağlantısını cüzdanda onayla"
                      : "Sahiplik devrini cüzdanda onayla"}
                  </button>
                </>
              )}
            </>
          )}
        </>
      )}
      <button className="cyber-button" onClick={() => void refresh()}>
        Zincir durumunu yenile
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
