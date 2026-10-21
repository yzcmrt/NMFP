"use client";
import Link from "next/link";
import { useTelegram } from "@/components/TelegramInitProvider";
import CarOperations from "@/components/CarOperations";
import { useGameClock } from "@/hooks/useGameClock";
export default function MiningArea() {
  const { game } = useTelegram();
  const now = useGameClock();
  if (!game) return <p role="status">Garaj yükleniyor…</p>;
  const cars = game.cars.filter((c) => c.status !== "sold");
  return (
    <section className="space-y-4">
      <p className="text-sm text-gray-400">
        Turlar 8 saat sürer. Tamamlanan ödüller otomatik işlenir; süre
        dolduğunda buradan da toplayabilirsin. Her tur 25 yakıt ve 10 kondisyon
        kullanır.
      </p>
      {cars.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {cars.map((car) => (
            <CarOperations key={car.id} car={car} now={now} />
          ))}
        </div>
      ) : (
        <p>
          Henüz aracın yok.{" "}
          <Link className="underline" href="/gamefi/car">
            Araç mağazasına git ↗
          </Link>
        </p>
      )}
    </section>
  );
}
