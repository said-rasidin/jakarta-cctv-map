import { describe, expect, it } from "vitest";
import {
  addChannel,
  emptyWorkspace,
  moveChannel,
  readWorkspace,
} from "./workspace";
describe("monitor selections", () => {
  it("selects channels independently and rejects duplicates", () => {
    const first = addChannel(emptyWorkspace, "site-cctv-01");
    expect(addChannel(first, "site-cctv-01")).toBe(first);
    expect(addChannel(first, "site-cctv-02").channelIds).toHaveLength(2);
  });
  it("preserves unknown IDs for explicit replacement and rejects invalid saves", () => {
    const saved = {
      ...emptyWorkspace,
      channelIds: ["removed", "camera", "camera"],
    };
    expect(readWorkspace(JSON.stringify(saved))?.channelIds).toEqual([
      "removed",
      "camera",
    ]);
    expect(readWorkspace("broken")).toBeNull();
    expect(
      readWorkspace(JSON.stringify({ ...saved, channelIds: [5] })),
    ).toBeNull();
  });
  it("reorders without changing selection identity", () => {
    expect(moveChannel(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveChannel(["a", "b"], 0, -1)).toEqual(["a", "b"]);
  });
});
