import { useEffect, useRef, useState } from "react";
import { parseProject, preset, type Project } from "../models/project";
export function useProject() {
  const [project, set] = useState<Project>(() => {
    try {
      return parseProject(localStorage.getItem("econgraph-project") || "");
    } catch {
      return preset();
    }
  });
  const past = useRef<Project[]>([]),
    future = useRef<Project[]>([]);
  const [storageError, setStorageError] = useState("");
  const change = (next: Project, history = true) => {
    if (history) {
      past.current = [...past.current.slice(-99), project];
      future.current = [];
    }
    set(next);
  };
  const checkpoint = () => {
    past.current = [...past.current.slice(-99), project];
    future.current = [];
  };
  const undo = () => {
    const v = past.current.pop();
    if (v) {
      future.current.push(project);
      set(v);
    }
  };
  const redo = () => {
    const v = future.current.pop();
    if (v) {
      past.current.push(project);
      set(v);
    }
  };
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem("econgraph-project", JSON.stringify(project));
        setStorageError("");
      } catch {
        setStorageError(
          "Browser storage is unavailable. Use Save project to keep your work.",
        );
      }
    }, 300);
    return () => clearTimeout(id);
  }, [project]);
  return {
    project,
    change,
    undo,
    redo,
    checkpoint,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    storageError,
  };
}
