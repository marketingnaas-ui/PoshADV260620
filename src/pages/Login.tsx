
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { GlobalUI } from '../components/GlobalUI';
import logoImg from '../assets/images/regenerated_image_1782327208256.png';

export default function LoginPage() {
  const { setCurrentUser, toast } = useApp();
  const [userId, setUserId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLineLogin = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/auth/line/url');
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to get auth URL');
      }
      const { url } = await res.json();
      
      // Open popup
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        url,
        'line_login',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popup) {
        toast('Popup blocked. Please allow popups for this site.', 'error');
        setLoading(false);
        return;
      }

      // Listener for postMessage
      const handleMessage = (event: MessageEvent) => {
        // Validate origin
        if (!event.origin.endsWith('.run.app') && !event.origin.includes('localhost')) return;
        
        if (event.data?.type === 'LINE_AUTH_SUCCESS') {
          if (event.data.token) {
            localStorage.setItem('clear_advance_auth_token', event.data.token);
          }
          setCurrentUser(event.data.user);
          toast('Logged in via LINE', 'success');
          window.removeEventListener('message', handleMessage);
          setLoading(false);
        }
      };

      window.addEventListener('message', handleMessage);
      
      // Cleanup if popup closed manually
      const checkPopup = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopup);
          setLoading(false);
          window.removeEventListener('message', handleMessage);
        }
      }, 1000);

    } catch (err: any) {
      toast(err.message || 'Connection error', 'error');
      setLoading(false);
    }
  };

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!userId || !pin) {
      toast('Please enter User ID and PIN', 'error');
      setErrorMsg('กรุณากรอก User ID และ PIN');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, pin })
      });
      const data = await res.json();
      
      if (data.success) {
        if (data.token) {
          localStorage.setItem('clear_advance_auth_token', data.token);
        }
        setCurrentUser(data.user);
        toast('Login successful', 'success');
      } else {
        const localizedError = data.error === 'User not found' ? 'ไม่พบบัญชีผู้ใช้นี้ในระบบ' :
                             data.error === 'Invalid PIN' ? 'รหัส PIN ไม่ถูกต้อง' :
                             data.error === 'User disabled' ? 'บัญชีผู้ใช้นี้ถูกปิดใช้งานชั่วคราว' :
                             (data.error || 'เข้าสู่ระบบไม่สำเร็จ');
        toast(localizedError, 'error');
        setErrorMsg(localizedError);
      }
    } catch (err) {
      toast('Connection error', 'error');
      setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm w-full max-w-sm text-center">
        <div className="flex justify-center mb-6">
          <img 
            src={logoImg} 
            alt="POSH MANOR Logo" 
            className="w-[80px] h-[80px] object-contain mx-auto animate-fade-in"
            referrerPolicy="no-referrer"
          />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">POSH MANOR</h1>
        <p className="text-slate-500 text-sm mb-8">Advance Management System</p>
        
        <button 
          onClick={handleLineLogin}
          className="w-full py-3 bg-[#06C755] text-white font-bold rounded-xl shadow-sm hover:bg-[#05a647] transition-colors flex items-center justify-center gap-2 mb-6"
        >
          <img src="https://upload.wikimedia.org/wikipedia/commons/4/41/LINE_logo.svg" alt="LINE" className="w-5 h-5 invert brightness-0" />
          Login with LINE
        </button>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-slate-400">Or use PIN</span>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm font-semibold rounded-xl text-left flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handlePinLogin} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">User ID</label>
            <input 
              type="text" 
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="e.g. SEM-XXXX"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">PIN Code</label>
            <input 
              type="password" 
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              maxLength={6}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-center tracking-widest font-bold"
            />
          </div>
          <button 
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-black text-white font-bold rounded-xl shadow-sm hover:bg-neutral-900 transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? 'Verifying...' : 'Login with PIN'}
          </button>
        </form>
        
        <p className="mt-8 text-xs text-slate-400">
          Adv System Version 1 : 2026
        </p>
      </div>
      <GlobalUI />
    </div>
  );
}
