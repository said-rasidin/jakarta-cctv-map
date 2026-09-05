import {
  commonWindow,
  type PlaybackSnapshot,
  type PlayerController,
} from "@/features/video/controller";

export class Synchronizer {
  private previous = new Map<string, PlaybackSnapshot>();
  private lastSeek = new Map<string, number>();
  private anchor: { time: number; mono: number; members: string } | null = null;
  reset(controllers: Map<string, PlayerController>) {
    controllers.forEach((c) => {
      c.setRate(1);
      c.setAligned(false);
    });
    this.previous.clear();
    this.lastSeek.clear();
    this.anchor = null;
  }
  tick(controllers: Map<string, PlayerController>, now: number) {
    const eligible: Array<{
      id: string;
      controller: PlayerController;
      sample: PlaybackSnapshot;
    }> = [];
    for (const [id, controller] of controllers) {
      const sample = controller.snapshot();
      const previous = this.previous.get(id);
      this.previous.set(id, sample);
      const elapsed = previous ? sample.sampledAt - previous.sampledAt : 0;
      const delta =
        previous?.time != null && sample.time != null
          ? sample.time - previous.time
          : 0;
      const recentSeek = now - (this.lastSeek.get(id) ?? -Infinity) < 3000;
      if (
        sample.playing &&
        sample.time != null &&
        Number.isFinite(sample.time) &&
        elapsed > 0 &&
        sample.ranges.length &&
        previous?.time != null &&
        delta > 0 &&
        (recentSeek || Math.abs(delta - elapsed) < 3000)
      )
        eligible.push({ id, controller, sample });
      else {
        controller.setRate(1);
        controller.setAligned(false);
      }
    }
    for (const id of this.previous.keys())
      if (!controllers.has(id)) this.previous.delete(id);
    const window = commonWindow(eligible.map(({ sample }) => sample.ranges));
    if (eligible.length < 2 || !window) {
      this.anchor = null;
      eligible.forEach(({ controller }) => {
        controller.setRate(1);
        controller.setAligned(false);
      });
      return {
        message:
          eligible.length < 2
            ? "Menunggu minimal 2 kamera dengan waktu terverifikasi"
            : "Tidak ada rentang waktu bersama",
        members: [] as string[],
      };
    }
    const members = eligible
      .map(({ id }) => id)
      .sort()
      .join(",");
    let target = this.anchor ? this.anchor.time + now - this.anchor.mono : NaN;
    if (
      !this.anchor ||
      this.anchor.members !== members ||
      target < window.start ||
      target >= window.end
    ) {
      target = window.end - Math.min(500, (window.end - window.start) / 2);
      this.anchor = { time: target, mono: now, members };
    }
    const times = eligible.map(
      ({ sample }) => sample.time! + now - sample.sampledAt,
    );
    eligible.forEach(({ id, controller }, i) => {
      controller.setAligned(true);
      const drift = times[i] - target;
      if (
        Math.abs(drift) > 2000 &&
        now - (this.lastSeek.get(id) ?? -Infinity) > 5000
      ) {
        if (controller.seekTime(target)) this.lastSeek.set(id, now);
        controller.setRate(1);
      } else
        controller.setRate(Math.abs(drift) < 250 ? 1 : drift > 0 ? 0.97 : 1.03);
    });
    const spread = (Math.max(...times) - Math.min(...times)) / 1000;
    return {
      message: `${spread <= 0.5 ? "Selaras menurut metadata" : "Menyelaraskan"} · ${eligible.length}/${controllers.size} kamera · selisih ${spread.toFixed(1)} dtk`,
      members: eligible.map(({ id }) => id),
    };
  }
}
