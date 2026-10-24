'use client';

import React, { useState, useEffect } from 'react';
import { Menu, Sun, Moon, RefreshCw, ShieldCheck, Wifi } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { useToast } from './ToastProvider';

interface HeaderProps {
  onToggleSidebar: () => void;
  title?: string;
}

export function Header({ onToggleSidebar, title }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const [detectedIp, setDetectedIp] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  const fetchPublicIp = async () => {
    setIsDetecting(true);
    try {
      const res = await fetch('/api/ip/detect');
      if (res.ok) {
        const data = await res.json();
        setDetectedIp(data.ipv4 || data.ipv6 || 'Unknown');
      }
    } catch {
      // Ignored in header
    } finally {
      setIsDetecting(false);
    }
  };

  useEffect(() => {
    fetchPublicIp();
  }, []);

  const handleManualRefresh = async () => {
    await fetchPublicIp();
    toast.info('Public IP detection refreshed.');
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-8 border-b border-slate-800 bg-slate-900/80 dark:bg-[#060913]/80 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden transition-colors"
          aria-label="Open Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        {title && (
          <h1 className="text-lg font-bold text-white tracking-tight hidden sm:block">
            {title}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Detected IP Capsule */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300">
          <Wifi className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-mono text-slate-200">
            {isDetecting ? 'Detecting IP...' : detectedIp ? detectedIp : 'No IP Detected'}
          </span>
          <button
            onClick={handleManualRefresh}
            disabled={isDetecting}
            title="Refresh Public IP"
            className="p-1 rounded text-slate-400 hover:text-cyan-400 hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isDetecting ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          className="p-2 rounded-xl border border-slate-800 bg-slate-800/40 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-400" />
          )}
        </button>

        {/* Security / Health Badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>HTTPS Secure</span>
        </div>
      </div>
    </header>
  );
}
