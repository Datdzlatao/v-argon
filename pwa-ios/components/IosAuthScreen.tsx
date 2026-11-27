'use client';

import React, { useState } from 'react';
import { VArgonLogo } from './VArgonLogo';
import { supabase } from '../lib/supabase';
import { Sparkles, Lock, Mail, ArrowRight } from 'lucide-react';

interface IosAuthScreenProps {
  onDemo: () => void;
  onAuthSuccess: (session: any) => void;
}

export default function IosAuthScreen({ onDemo, onAuthSuccess }: IosAuthScreenProps) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    if (!email.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }
    setLoading(true);
    try {
      if (authMode === 'login') {
        const { data, error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) setError(err.message);
        else if (data.session) onAuthSuccess(data.session);
      } else {
        const { error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (err) setError(err.message);
        else {
          setInfoMsg('Đăng ký thành công! Vui lòng kiểm tra email hoặc đăng nhập.');
          setAuthMode('login');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Không thể kết nối máy chủ xác thực.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col justify-center px-5 py-10 max-w-md mx-auto">
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/5 space-y-5">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-[#15803D] flex items-center justify-center shadow-md">
            <VArgonLogo className="w-8 h-8" variant="white" />
          </div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">
            V-ARGON SmartFarm
          </h1>
          <p className="text-[13px] text-slate-500">
            Quản lý trang trại thông minh • Đồng bộ Web, PWA &amp; Android
          </p>
        </div>

        <div className="bg-black/[0.05] p-1 rounded-xl grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setError('');
            }}
            className={`py-2 rounded-lg text-[13px] font-bold transition ${
              authMode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Đăng Nhập
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('register');
              setError('');
            }}
            className={`py-2 rounded-lg text-[13px] font-bold transition ${
              authMode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Đăng Ký
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email quản lý trang trại"
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#F2F2F7] text-[14px] outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mật khẩu"
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#F2F2F7] text-[14px] outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {error && (
            <p className="text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
          {infoMsg && (
            <p className="text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
              {infoMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#15803D] text-white font-bold text-[14px] flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] disabled:opacity-50"
          >
            <span>{loading ? 'Đang xử lý...' : authMode === 'login' ? 'Đăng Nhập' : 'Tạo Tài Khoản'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-200" />
          <span className="shrink mx-3 text-[11px] font-semibold uppercase text-slate-400">Hoặc</span>
          <div className="flex-grow border-t border-slate-200" />
        </div>

        <button
          type="button"
          onClick={onDemo}
          className="w-full py-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[14px] flex items-center justify-center gap-2 active:scale-[0.99]"
        >
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span>Trải Nghiệm Nhanh (Chế Độ Demo)</span>
        </button>
      </div>
    </div>
  );
}
