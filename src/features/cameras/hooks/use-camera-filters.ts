"use client";

import { useMemo, useState } from "react";
import type { CameraSite, StreamHealth } from "@/domain/cameras/types";
import { cameraGroup, cameraStatus, distanceInKm, filterSites, locationLabel, type CameraStatus } from "@/domain/cameras/camera";
import type { UserLocation } from "@/features/cameras/hooks/use-geolocation";

export type StatusFilter = "all" | Exclude<CameraStatus, "checking">;

export function useCameraFilters(sites: CameraSite[], streamHealth: Record<string, StreamHealth>, userLocation: UserLocation | null) {
  const [query, setQuery] = useState("");
  const [agencies, setAgencies] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [locationFilter, setLocationFilter] = useState("all");

  const availableAgencies = useMemo(() => [...new Set(sites.map((site) => site.agency))].sort(), [sites]);
  const availableLocations = useMemo(() => [...new Set(sites.map(locationLabel))].sort((a, b) => a.localeCompare(b, "id")), [sites]);
  const statusCounts = useMemo(() => sites.reduce((counts, site) => {
    counts[cameraStatus(site, streamHealth)]++;
    return counts;
  }, { active: 0, inactive: 0, checking: 0 }), [sites, streamHealth]);
  const filtered = useMemo(() => filterSites(sites, query, agencies).filter((site) =>
    (locationFilter === "all" || locationLabel(site) === locationFilter)
    && (statusFilter === "all" || cameraStatus(site, streamHealth) === statusFilter)
  ), [sites, query, agencies, locationFilter, statusFilter, streamHealth]);
  const ordered = useMemo(() => userLocation
    ? [...filtered].sort((a, b) => distanceInKm(userLocation, a.coordinates) - distanceInKm(userLocation, b.coordinates))
    : filtered, [filtered, userLocation]);
  const groups = useMemo(() => {
    const grouped = new Map<string, { key: string; label: string; sites: CameraSite[] }>();
    for (const site of ordered) {
      const group = cameraGroup(site);
      const current = grouped.get(group.key) ?? { ...group, sites: [] };
      current.sites.push(site);
      grouped.set(group.key, current);
    }
    return [...grouped.values()];
  }, [ordered]);

  const toggleAgency = (agency: string) => setAgencies((current) => {
    const next = new Set(current);
    next.has(agency) ? next.delete(agency) : next.add(agency);
    return next;
  });
  const resetFilters = () => {
    setQuery("");
    setAgencies(new Set());
    setStatusFilter("all");
    setLocationFilter("all");
  };

  return {
    query, setQuery, agencies, availableAgencies, availableLocations, statusCounts,
    statusFilter, setStatusFilter, locationFilter, setLocationFilter,
    ordered, groups, toggleAgency, resetFilters,
  };
}
