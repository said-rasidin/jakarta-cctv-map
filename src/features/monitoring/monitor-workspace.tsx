"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CameraSite, StreamHealth } from "@/domain/cameras/types";
import { normalizeText } from "@/domain/cameras/camera";
import type { PlayerController } from "@/features/video/controller";
import {
  MAX_SELECTION,
  addChannel,
  moveChannel,
  type Workspace,
} from "./workspace";
import { Synchronizer } from "./synchronizer";
import { MonitorTile, monitorButton } from "./monitor-tile";
import { geographicOrder } from "./preview";

export function MonitorWorkspace({
  streamHealth,
  sites,
  workspace,
  onChange,
  onClose,
  onSave,
  notice,
}: {
  streamHealth: Record<string, StreamHealth>;
  sites: CameraSite[];
  workspace: Workspace;
  onChange: (workspace: Workspace) => void;
  onClose: () => void;
  onSave: () => void;
  notice: string;
}) {
  const [running, setRunning] = useState(false);
  const [visible, setVisible] = useState(true);
  const [mobile, setMobile] = useState(true);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(true);
  const [road, setRoad] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [audioId, setAudioId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [orderNotice, setOrderNotice] = useState("");
  const [mode, setMode] = useState<"live" | "aligned">("live");
  const [sync, setSync] = useState({ message: "", members: [] as string[] });
  const controllers = useRef(new Map<string, PlayerController>());
  const coordinator = useRef(new Synchronizer());
  const pickerRef = useRef<HTMLInputElement>(null);
  const register = useCallback(
    (id: string, controller: PlayerController | null) => {
      if (controller) controllers.current.set(id, controller);
      else controllers.current.delete(id);
    },
    [],
  );
  const onAudio = useCallback((id: string) => setAudioId(id), []);
  const all = useMemo(
    () =>
      sites.flatMap((site) =>
        site.channels.map((channel) => ({ site, channel })),
      ),
    [sites],
  );
  const byId = useMemo(
    () => new Map(all.map((value) => [value.channel.id, value])),
    [all],
  );
  const roads = useMemo(
    () =>
      [
        ...new Set(
          all.map(
            ({ channel, site }) =>
              channel.roadName ?? site.roadName ?? site.name,
          ),
        ),
      ].sort(),
    [all],
  );
  const matches = all.filter(
    ({ site, channel }) =>
      (statusFilter === "all" ||
        (streamHealth[channel.id] ?? "unknown") === statusFilter) &&
      (!road || (channel.roadName ?? site.roadName ?? site.name) === road) &&
      (!query ||
        normalizeText(
          `${site.searchText} ${site.name} ${channel.label} ${channel.roadName}`,
        ).includes(normalizeText(query))),
  );
  const capacity = mobile ? 2 : workspace.layout;
  const pages = Math.max(1, Math.ceil(workspace.channelIds.length / capacity));
  const currentPage = Math.min(page, pages - 1);
  const activeIds = workspace.channelIds.slice(
    currentPage * capacity,
    (currentPage + 1) * capacity,
  );
  useEffect(() => {
    const media = matchMedia("(max-width: 767px)");
    const resize = () => setMobile(media.matches);
    const visibility = () => setVisible(!document.hidden);
    resize();
    visibility();
    media.addEventListener("change", resize);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      media.removeEventListener("change", resize);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    const pool = controllers.current;
    const engine = coordinator.current;
    engine.reset(pool);
    setSync({ message: "Menunggu metadata waktu…", members: [] });
    if (mode !== "aligned" || !running || !visible) return;
    const timer = window.setInterval(
      () => setSync(engine.tick(pool, performance.now())),
      1000,
    );
    return () => {
      window.clearInterval(timer);
      engine.reset(pool);
    };
  }, [mode, running, visible, currentPage, capacity]);
  const live = () => {
    coordinator.current.reset(controllers.current);
    setMode("live");
    controllers.current.forEach((c) => c.goLive());
  };
  const orderLabel = geographicOrder(
    workspace.channelIds.map((id) => byId.get(id)?.channel.coordinates.lat),
  );
  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || to >= workspace.channelIds.length)
      return;
    setOrderNotice(`Kamera ${from + 1} dipindah ke posisi ${to + 1}.`);
    onChange({
      ...workspace,
      channelIds: moveChannel(workspace.channelIds, from, to),
    });
  };
  const select = (id: string) => {
    if (replaceId) {
      onChange({
        ...workspace,
        channelIds: workspace.channelIds.map((old) =>
          old === replaceId ? id : old,
        ),
      });
      setReplaceId(null);
    } else onChange(addChannel(workspace, id));
  };
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70" />
        <Dialog.Content className="fixed inset-0 z-50 overflow-y-auto bg-slate-950 p-3 text-white outline-none md:p-5">
          <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <Dialog.Title className="text-xl font-semibold">
                Monitor lalu lintas
              </Dialog.Title>
              <Dialog.Description className="text-sm text-slate-400">
                Pilih kamera, atur urutan ruas, lalu mulai pemantauan.
              </Dialog.Description>
            </div>
            <Dialog.Close className={monitorButton}>
              Kembali ke peta
            </Dialog.Close>
          </header>
          <div className="mb-4 flex flex-wrap items-end gap-2">
            <label className="min-w-48 flex-1 text-xs text-slate-300">
              Nama susunan
              <input
                aria-label="Nama susunan"
                value={workspace.name}
                maxLength={100}
                onChange={(e) =>
                  onChange({ ...workspace, name: e.target.value })
                }
                className="mt-1 block min-h-11 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 text-sm text-white"
              />
            </label>
            <button className={monitorButton} onClick={onSave}>
              Simpan susunan
            </button>
            <button
              className="min-h-11 rounded-lg bg-jakarta-orange px-4 py-2 text-sm font-semibold text-slate-950 hover:brightness-110 disabled:opacity-40"
              disabled={!workspace.channelIds.length}
              onClick={() => {
                if (!running && mobile) setPickerOpen(false);
                setRunning((v) => !v);
              }}
            >
              {running ? "Jeda semua" : "Mulai monitor"}
            </button>
            <button
              className={monitorButton}
              disabled={!running}
              onClick={live}
            >
              Ke siaran terbaru
            </button>
            <label className="text-xs text-slate-300">
              Layout desktop
              <select
                aria-label="Layout desktop"
                className={`ml-2 bg-slate-900 ${monitorButton}`}
                value={workspace.layout}
                onChange={(e) => {
                  onChange({
                    ...workspace,
                    layout: Number(e.target.value) as 2 | 4 | 6,
                  });
                  setPage(0);
                }}
              >
                <option value={2}>2 kamera</option>
                <option value={4}>4 kamera</option>
                <option value={6}>6 kamera (eksperimental)</option>
              </select>
            </label>
          </div>
          <p role="status" className="mb-3 text-sm text-sky-200">
            {notice}
          </p>
          <button
            className={`${monitorButton} mb-3 lg:hidden`}
            aria-expanded={pickerOpen}
            aria-controls="monitor-picker"
            onClick={() => setPickerOpen((value) => !value)}
          >
            {pickerOpen ? "Tutup daftar kamera" : "Tambah / ganti kamera"}
          </button>
          <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside
              id="monitor-picker"
              className={`${pickerOpen ? "block" : "hidden"} rounded-xl border border-slate-700 bg-slate-900 p-3 lg:block`}
            >
              <h2 className="mb-2 font-semibold">
                {replaceId
                  ? "Pilih kamera pengganti"
                  : `Tambah kamera (${workspace.channelIds.length}/${MAX_SELECTION})`}
              </h2>
              {replaceId && (
                <button
                  className={monitorButton}
                  onClick={() => setReplaceId(null)}
                >
                  Batal mengganti
                </button>
              )}
              <input
                ref={pickerRef}
                aria-label="Cari kamera monitor"
                placeholder="Jalan, area, atau ID…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="my-2 min-h-11 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 text-sm"
              />
              <select
                aria-label="Filter ruas monitor"
                value={road}
                onChange={(e) => setRoad(e.target.value)}
                className="mb-2 min-h-11 w-full rounded-lg border border-slate-600 bg-slate-950 px-2 text-sm"
              >
                <option value="">Semua ruas / area</option>
                {roads.map((label) => (
                  <option key={label}>{label}</option>
                ))}
              </select>
              <div className="max-h-64 space-y-2 overflow-y-auto lg:max-h-[65vh]">
                <label className="mb-2 block text-xs text-slate-300">
                  Status koneksi
                  <select
                    aria-label="Status kamera monitor"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="ml-2 min-h-11 rounded-lg border border-slate-600 bg-slate-950 px-2"
                  >
                    <option value="all">Semua</option>
                    <option value="available">Tersedia</option>
                    <option value="unavailable">Tidak tersedia</option>
                    <option value="unknown">Belum diketahui</option>
                  </select>
                </label>
                {matches.map(({ site, channel }) => {
                  const selected = workspace.channelIds.includes(channel.id);
                  return (
                    <button
                      key={channel.id}
                      disabled={
                        selected ||
                        (!replaceId &&
                          workspace.channelIds.length >= MAX_SELECTION) ||
                        !channel.embedUrl
                      }
                      onClick={() => select(channel.id)}
                      className="block min-h-11 w-full rounded-lg border border-slate-700 p-2 text-left text-sm hover:border-sky-400 disabled:opacity-50"
                    >
                      <span className="block">
                        {site.name} · {channel.label}
                      </span>
                      <span
                        className={`block text-xs ${streamHealth[channel.id] === "available" ? "text-emerald-300" : streamHealth[channel.id] === "unavailable" ? "text-red-300" : "text-amber-200"}`}
                      >
                        {streamHealth[channel.id] === "available"
                          ? "Koneksi tersedia"
                          : streamHealth[channel.id] === "unavailable"
                            ? "Koneksi tidak tersedia · masih dapat dicoba"
                            : "Status belum diketahui"}
                      </span>
                      <span className="text-xs text-sky-300">
                        {selected
                          ? "Sudah ditambahkan"
                          : replaceId
                            ? "Pilih pengganti"
                            : "Tambah ke monitor"}
                      </span>
                    </button>
                  );
                })}
                {!matches.length && (
                  <p className="p-3 text-sm text-slate-400">
                    Tidak ada kamera yang cocok.
                  </p>
                )}
              </div>
            </aside>
            <section className="min-w-0" aria-label="Grid monitor">
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  className={monitorButton}
                  disabled={workspace.channelIds.length < 2}
                  onClick={() => {
                    setOrderNotice("Susunan diatur dari utara ke selatan.");
                    onChange({
                      ...workspace,
                      channelIds: [...workspace.channelIds].sort(
                        (a, b) =>
                          (byId.get(b)?.channel.coordinates.lat ?? -Infinity) -
                          (byId.get(a)?.channel.coordinates.lat ?? -Infinity),
                      ),
                    });
                  }}
                >
                  Atur utara → selatan
                </button>
                <button
                  className={monitorButton}
                  disabled={workspace.channelIds.length < 2}
                  onClick={() => {
                    setOrderNotice(
                      "Urutan dibalik. Nomor tile dan daftar urutan telah diperbarui.",
                    );
                    onChange({
                      ...workspace,
                      channelIds: [...workspace.channelIds].reverse(),
                    });
                  }}
                >
                  Balik urutan
                </button>
                <label className="text-sm">
                  Waktu
                  <select
                    aria-label="Mode waktu"
                    value={mode}
                    onChange={(e) =>
                      e.target.value === "live" ? live() : setMode("aligned")
                    }
                    className={`ml-2 bg-slate-900 ${monitorButton}`}
                  >
                    <option value="live">Terbaru</option>
                    <option value="aligned">Selaraskan waktu</option>
                  </select>
                </label>
              </div>
              <p role="status" className="mb-2 text-sm text-sky-200">
                Urutan saat ini: <strong>{orderLabel}</strong>. {orderNotice}
              </p>
              <ol
                aria-label="Urutan kamera saat ini"
                className="mb-3 flex flex-wrap gap-2"
              >
                {workspace.channelIds.map((id, index) => (
                  <li
                    key={id}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                  >
                    <span className="font-bold text-jakarta-orange">
                      {index + 1}.
                    </span>{" "}
                    {byId.get(id)?.site.name ?? "Kamera tidak tersedia"} ·{" "}
                    {byId.get(id)?.channel.label ?? id}
                  </li>
                ))}
              </ol>
              <p className="mb-2 text-xs text-slate-400">
                Seret pegangan ↕ ke tile tujuan untuk mengatur layout (mouse /
                sentuhan), atau fokuskan pegangan dan gunakan tombol panah.
                Urutan dibaca kiri ke kanan, lalu ke bawah. Arah geografis
                berdasarkan koordinat, bukan arah pandang kamera. AI hanya
                tersedia pada satu tile fokus.
              </p>
              <p
                role="status"
                className="mb-2 rounded-lg bg-slate-900 p-3 text-sm text-amber-200"
              >
                {!running
                  ? "Video belum dimulai / dijeda."
                  : !visible
                    ? "Tab tersembunyi; video dijeda."
                    : mode === "live"
                      ? "Waktu antar kamera belum diselaraskan."
                      : sync.message}
                {mode === "aligned" &&
                  " Penyelarasan menambah delay dan mengikuti metadata sumber, bukan validasi jam CCTV."}
              </p>
              <div className="mb-3 flex items-center gap-3 text-sm">
                <button
                  className={monitorButton}
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Sebelumnya
                </button>
                <span>
                  Halaman {currentPage + 1}/{pages} · maks. {capacity} video
                  aktif
                </span>
                <button
                  className={monitorButton}
                  disabled={currentPage >= pages - 1}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Berikutnya
                </button>
              </div>
              {!workspace.channelIds.length && (
                <p className="rounded-xl border border-dashed border-slate-600 p-8 text-center text-slate-400">
                  Tambahkan kamera dari daftar untuk menyusun monitor.
                </p>
              )}
              <div
                className={`grid gap-3 ${capacity === 6 ? "md:grid-cols-3" : "md:grid-cols-2"}`}
              >
                {workspace.channelIds.map((id, index) => (
                  <div
                    key={id}
                    className={`${activeIds.includes(id) ? "contents" : "hidden"}`}
                  >
                    <MonitorTile
                      id={id}
                      {...byId.get(id)}
                      index={index}
                      previewEnabled={visible && activeIds.includes(id)}
                      dropTarget={dragTarget === id}
                      onDragTarget={setDragTarget}
                      onReorderTo={(target) =>
                        reorder(index, workspace.channelIds.indexOf(target))
                      }
                      active={running && visible && activeIds.includes(id)}
                      focused={focused === id && activeIds.includes(id)}
                      aligned={mode === "aligned" && sync.members.includes(id)}
                      register={register}
                      onFocus={() => setFocused(focused === id ? null : id)}
                      onMove={(delta) => reorder(index, index + delta)}
                      onDrop={(source) =>
                        reorder(workspace.channelIds.indexOf(source), index)
                      }
                      onRemove={() =>
                        onChange({
                          ...workspace,
                          channelIds: workspace.channelIds.filter(
                            (value) => value !== id,
                          ),
                        })
                      }
                      onReplace={() => {
                        setPickerOpen(true);
                        setReplaceId(id);
                        setQuery("");
                        setRoad("");
                        requestAnimationFrame(() => {
                          pickerRef.current?.focus();
                          pickerRef.current?.scrollIntoView({
                            block: "center",
                            behavior: "smooth",
                          });
                        });
                      }}
                      audioId={audioId}
                      onAudio={onAudio}
                    />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
