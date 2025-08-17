import React, { createContext, useContext, useState } from "react";

// Create Context
const BuildDataContext = createContext();

// Provide Context
export function BuildDataProvider({ children }) {
  const [buildData, setBuildData] = useState([]);

  return (
    <BuildDataContext.Provider value={{ buildData, setBuildData }}>
      {children}
    </BuildDataContext.Provider>
  );
}

// Use Context
export function useBuildData() {
  return useContext(BuildDataContext);
}
