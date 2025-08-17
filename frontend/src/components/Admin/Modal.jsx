// src/components/Modal.jsx

import React, { useEffect } from 'react';

export default function Modal({ isOpen, onClose, children }) {
  // This effect allows the user to close the modal by pressing the 'Escape' key
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  // If the modal isn't open, don't render anything
  if (!isOpen) {
    return null;
  }

  return (
    // Main container to position the modal in the center of the screen
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* This is the backdrop with the blur and transparency */}
      <div
        className="absolute inset-0 bg-gray-900 bg-opacity-75 backdrop-blur-sm"
        onClick={onClose} // Allow closing the modal by clicking the background
        aria-hidden="true"
      ></div>

      {/* This is the modal content panel that sits on top of the backdrop */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl">
        {/* The children prop is where your <CreateProduct> form will go */}
        {children}
      </div>
    </div>
  );
}