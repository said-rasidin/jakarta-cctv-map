"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import {
  addChannel,
  emptyWorkspace,
  readWorkspace,
  WORKSPACE_KEY,
} from "./workspace";

export function useWorkspace() {
  const [workspace, setWorkspace] = useState(emptyWorkspace);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    try {
      const saved = readWorkspace(localStorage.getItem(WORKSPACE_KEY));
      if (saved) {
        setWorkspace(saved);
        setNotice(
          "Susunan tersimpan dipulihkan. Tekan Mulai monitor untuk memutar.",
        );
      }
    } catch {
      setNotice(
        "Penyimpanan lokal tidak tersedia; susunan tetap dapat digunakan selama sesi ini.",
      );
    }
  }, []);
  const save = () => {
    try {
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
      setNotice("Susunan disimpan di perangkat ini.");
    } catch {
      setNotice("Susunan gagal disimpan. Penyimpanan browser tidak tersedia.");
    }
  };
  return {
    workspace,
    setWorkspace,
    notice,
    save,
    add: (id: string) => setWorkspace((value) => addChannel(value, id)),
  };
}
