"use client";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { useTelegram } from "@/components/TelegramInitProvider";
import { formatCurrency } from "@/app/utils/formatters";
import type { Task } from "@/types";
export default function TaskPage() {
  const { game, busy, runOperation } = useTelegram();
  const [completed, setCompleted] = useState(false);
  if (!game) return <p role="status">Görevler yükleniyor…</p>;
  async function verify(id: number) {
    try {
      await runOperation(async () => {
        const r = await fetch("/api/telegram/verify-task", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: id }),
        });
        const body = await r.json();
        if (!r.ok || !body.success)
          throw new Error(body.message || "Görev doğrulanamadı.");
        const reward = body.result?.reward;
        toast.success(
          `${body.message}${reward ? ` +${formatCurrency(reward)} NMFP` : ""}`,
        );
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Görev doğrulanamadı.");
    }
  }
  async function visit(task: Task) {
    try {
      await runOperation(async () => {
        const r = await fetch("/api/tasks/visit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: task.id }),
        });
        const body = await r.json();
        if (!r.ok) throw new Error(body.message || "Bağlantı açılamadı.");
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.openLink) tg.openLink(body.url);
        else window.open(body.url, "_blank", "noopener,noreferrer");
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bağlantı açılamadı.");
    }
  }
  const tasks = game.tasks.filter(
    (t) =>
      Boolean(
        game.userTasks.find((ut) => ut.task_id === t.id)?.is_completed,
      ) === completed,
  );
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Görevler</h1>
      <p className="text-sm muted">
        Oyun içi görev ödülleri tamamlandığında otomatik eklenir. İlerlemeni
        buradan da kontrol edebilirsin.
      </p>
      <div className="flex gap-3" role="tablist" aria-label="Görevler">
        <button
          role="tab"
          aria-selected={!completed}
          className="cyber-button"
          onClick={() => setCompleted(false)}
        >
          Aktif
        </button>
        <button
          role="tab"
          aria-selected={completed}
          className="cyber-button"
          onClick={() => setCompleted(true)}
        >
          Tamamlanan
        </button>
      </div>
      {tasks.length ? (
        tasks.map((t) => {
          const ut = game.userTasks.find((x) => x.task_id === t.id),
            progress = Math.min(t.total, ut?.progress || 0),
            percent = Math.min(100, (progress / Math.max(1, t.total)) * 100);
          return (
            <article key={t.id} className="cyber-panel p-5 space-y-3">
              <div className="flex justify-between gap-3">
                <h2 className="font-semibold">{t.title}</h2>
                <span className="text-green-300 whitespace-nowrap">
                  {formatCurrency(t.reward)} NMFP
                </span>
              </div>
              <p className="text-sm muted">{t.description}</p>
              <div className="text-xs muted">
                {progress}/{t.total}
              </div>
              <div
                role="progressbar"
                aria-label={t.title}
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-1 rounded bg-white/10"
              >
                <div
                  className="bg-cyan-300 h-full rounded"
                  style={{ width: `${percent}%` }}
                />
              </div>
              {completed ? (
                <p className="text-sm text-green-300">
                  Tamamlandı · Ödül işlendi
                </p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {t.verification_type === "link_click" && (
                    <button
                      disabled={busy}
                      className="cyber-button disabled:opacity-40"
                      onClick={() => void visit(t)}
                    >
                      Sayfayı aç ↗
                    </button>
                  )}
                  {t.verification_type === "channel_join" &&
                    t.verification_data?.channel_username && (
                      <a
                        className="cyber-button"
                        href={`https://t.me/${String(t.verification_data.channel_username).replace("@", "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Kanala git ↗
                      </a>
                    )}
                  <button
                    disabled={busy}
                    className="cyber-button disabled:opacity-40"
                    onClick={() => void verify(t.id)}
                  >
                    {busy ? "Kontrol ediliyor…" : "İlerlemeyi kontrol et"}
                  </button>
                </div>
              )}
            </article>
          );
        })
      ) : (
        <p className="muted">
          {completed ? "Henüz tamamlanan görevin yok." : "Aktif görev kalmadı."}
        </p>
      )}
    </div>
  );
}
