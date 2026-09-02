import dataset from "#data/cameras.json";
import type { CameraDataset } from "@/lib/types";
import CameraMap from "@/components/camera-map";

export default function Home() {
  return <CameraMap dataset={dataset as CameraDataset} />;
}
