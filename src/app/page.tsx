import dataset from "#data/generated/cameras.json";
import { parseCameraDataset } from "@/domain/cameras/schema";
import CameraExplorer from "@/features/cameras/components/camera-explorer";

export default function Home() {
  return <CameraExplorer dataset={parseCameraDataset(dataset)} />;
}
