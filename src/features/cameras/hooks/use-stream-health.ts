"use client";

import { useEffect, useState } from "react";
import type { CameraSite, StreamHealth } from "@/domain/cameras/types";

export function useStreamHealth(sites: CameraSite[]) {
  const [streamHealth, setStreamHealth] = useState<Record<string, StreamHealth>>({});

  useEffect(() => {
    const channelIds = sites.flatMap((site) => site.channels.filter((channel) => channel.embedUrl).map((channel) => channel.id));
    if (!channelIds.length) return;
    const controller = new AbortController();
    fetch(`/api/stream-health?channelIds=${encodeURIComponent(channelIds.join(","))}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((body: { statuses?: Record<string, StreamHealth> }) => setStreamHealth(body.statuses ?? {}))
      .catch(() => undefined);
    return () => controller.abort();
  }, [sites]);

  return streamHealth;
}
