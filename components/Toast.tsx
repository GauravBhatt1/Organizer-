import React, { useEffect } from 'react';
import { CheckCircleIcon, ExclamationIcon, InfoIcon } from '../lib/icons.tsx';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastData {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastComponentProps extends ToastData {
  onDismiss: (id: string) => void;
}

const toastConfig = {
  success: {
    icon: <CheckCircleIcon className="w-6 h-6 text-green-400" />,
    bgClass: 'bg-green-500',
  },
  error: {
    icon: <ExclamationIcon className="w-6 h-6 text-red-400" />,
    bgClass: 'bg-red-500',
  },
  info: {
    icon: <InfoIcon className="w-6 h-6 text-blue-400" />,
    bgClass: 'bg-blue-500',
  },
};

const Toast: React.FC<ToastComponentProps> = ({ id, message, type, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(id);
    }, 5000);

    return () => {
      clearTimeout(timer);
    };
  }, [id, onDismiss]);

  const config = toastConfig[type];

  return (
    <div className="bg-gray-700 shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden w-full">
      <div className="p-4 flex items-start">
        <div className="flex-shrink-0">{config.icon}</div>
        <div className="ml-3 w-0 flex-1 pt-0.5">
          <p className="text-sm font-medium text-white">{message}</p>
        </div>
      </div>
    </div>
  );
};

export const ToastContainer: React.FC<{ toasts: ToastData[], onDismiss: (id: string) => void }> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm space-y-4">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};