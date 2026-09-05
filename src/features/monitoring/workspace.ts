export const WORKSPACE_KEY = "cctv-monitor-workspace-v1";
export const MAX_SELECTION = 12;
export type Workspace = {
  version: 1;
  name: string;
  channelIds: string[];
  layout: 2 | 4 | 6;
};
export const emptyWorkspace: Workspace = {
  version: 1,
  name: "Monitor lalu lintas",
  channelIds: [],
  layout: 4,
};
export function readWorkspace(text: string | null): Workspace | null {
  try {
    const value = JSON.parse(text ?? "null");
    if (
      value?.version !== 1 ||
      typeof value.name !== "string" ||
      !Array.isArray(value.channelIds) ||
      ![2, 4, 6].includes(value.layout)
    )
      return null;
    if (
      !value.channelIds.every(
        (id: unknown) => typeof id === "string" && id.length < 150,
      )
    )
      return null;
    return {
      version: 1,
      name: value.name.slice(0, 100),
      channelIds: [...new Set<string>(value.channelIds)].slice(
        0,
        MAX_SELECTION,
      ),
      layout: value.layout,
    };
  } catch {
    return null;
  }
}
export function addChannel(workspace: Workspace, id: string): Workspace {
  if (
    workspace.channelIds.includes(id) ||
    workspace.channelIds.length >= MAX_SELECTION
  )
    return workspace;
  return { ...workspace, channelIds: [...workspace.channelIds, id] };
}
export function moveChannel(ids: string[], from: number, to: number): string[] {
  if (from < 0 || to < 0 || from >= ids.length || to >= ids.length) return ids;
  const next = [...ids];
  const [id] = next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}
