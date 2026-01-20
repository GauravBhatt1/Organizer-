import React, { createContext, useContext, useState, useCallback } from 'react';
import { html } from 'htm/react';
import { ToastContainer } from '../components/Toast.js';

const ToastContext = createContext(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type) => {
    const id = new Date().toISOString() + Math.random();
    setToasts((prevToasts) => [...prevToasts, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);
  
  return html`
    <${ToastContext.Provider} value=${{ addToast }}>
      ${children}
      <${ToastContainer} toasts=${toasts} onDismiss=${removeToast} />
    </${ToastContext.Provider}>
  `;
};