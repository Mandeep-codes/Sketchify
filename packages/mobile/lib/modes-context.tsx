import React, { createContext, useContext, useState } from "react";
import { MODES, Mode, DEFAULT_MODE } from "./modes";

interface ModesContextValue {
  selectedMode: Mode;
  setSelectedMode: (mode: Mode) => void;
}

const ModesContext = createContext<ModesContextValue>({
  selectedMode: DEFAULT_MODE,
  setSelectedMode: () => {},
});

export function ModesProvider({ children }: { children: React.ReactNode }) {
  const [selectedMode, setSelectedMode] = useState<Mode>(DEFAULT_MODE);
  return (
    <ModesContext.Provider value={{ selectedMode, setSelectedMode }}>
      {children}
    </ModesContext.Provider>
  );
}

export function useModes() {
  return useContext(ModesContext);
}
