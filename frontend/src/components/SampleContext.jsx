import React, { createContext, useState, useEffect } from 'react';

export const SampleContext = createContext();

export const SampleProvider = ({ children }) => {
  const [selectedSample, setSelectedSample] = useState(() => {
    const savedSample = localStorage.getItem('selectedSample');
    console.log('Initial selectedSample from localStorage:', savedSample);
    return parseInt(savedSample) || 1;
  });

  useEffect(() => {
    console.log('Selected sample updated to:', selectedSample);
    localStorage.setItem('selectedSample', selectedSample);
  }, [selectedSample]);

  return (
    <SampleContext.Provider value={{ selectedSample, setSelectedSample }}>
      {children}
    </SampleContext.Provider>
  );
};