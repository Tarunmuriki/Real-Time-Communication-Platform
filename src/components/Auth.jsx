import React, { useState } from 'react';
import { Mail, Lock, User, ShieldAlert, KeyRound, Activity } from 'lucide-react';

export default function Auth({ onAuthSuccess, backendUrl }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password || (!isLogin && !formData.name)) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setError('');
    
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const body = isLogin 
      ? { email: formData.email, password: formData.password }
      : { name: formData.name, email: formData.email, password: formData.password };

    try {
      const response = await fetch(`${backendUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (data.success) {
        // Cache JWT and user in parent / local storage
        localStorage.setItem('horizon_token', data.token);
        localStorage.setItem('horizon_user', JSON.stringify(data.user));
        onAuthSuccess(data.token, data.user);
      } else {
        setError(data.message || 'Authentication failed. Please check credentials.');
      }
    } catch (err) {
      console.error('Auth network error:', err);
      setError('Cannot reach auth server. Please ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#070A13] px-4 relative overflow-hidden">
      
      {/* Background Neon Glowing Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-violet/10 rounded-full blur-[100px] animate-pulse-slow"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-teal/10 rounded-full blur-[100px] animate-pulse-slow"></div>

      <div className="w-full max-w-md animate-slide-up relative z-10">
        
        {/* Core Logo / Title */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-tr from-brand-violet to-brand-teal rounded-2xl flex items-center justify-center shadow-lg shadow-brand-violet/20 mb-3 border border-white/10">
            <Activity className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
            Horizon Collaboration
          </h1>
          <p className="text-gray-400 text-sm mt-1">Real-Time Encrypted Video & Canvas Collaboration</p>
        </div>

        {/* Tab Toggle Card */}
        <div className="glass-panel rounded-3xl overflow-hidden shadow-2xl shadow-black/40">
          
          {/* Header tabs toggle */}
          <div className="flex border-b border-gray-800/80 bg-black/25">
            <button
              onClick={() => { setIsLogin(true); setError(''); }}
              className={`flex-1 py-4 text-sm font-semibold transition-all duration-300 relative ${
                isLogin ? 'text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Sign In
              {isLogin && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-violet animate-fade-in" />}
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(''); }}
              className={`flex-1 py-4 text-sm font-semibold transition-all duration-300 relative ${
                !isLogin ? 'text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Register
              {!isLogin && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-teal animate-fade-in" />}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            
            {/* Display error warnings */}
            {error && (
              <div className="p-4 bg-red-950/40 border border-red-500/30 rounded-2xl flex items-start gap-3 animate-fade-in">
                <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <span className="text-red-300 text-xs font-medium leading-relaxed">{error}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Registration: Name field */}
              {!isLogin && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider pl-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" />
                    <input
                      name="name"
                      type="text"
                      placeholder="Tarun"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full bg-gray-900/60 border border-gray-800 focus:border-brand-teal rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-teal/30 transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Email Address */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider pl-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" />
                  <input
                    name="email"
                    type="email"
                    placeholder="tarun@gmail.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full bg-gray-900/60 border border-gray-800 focus:border-brand-violet rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-violet/30 transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider pl-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" />
                  <input
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full bg-gray-900/60 border border-gray-800 focus:border-brand-violet rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-violet/30 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-2xl text-sm font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2 ${
                isLogin 
                  ? 'bg-gradient-to-r from-brand-violet to-indigo-600 hover:from-brand-violet hover:to-indigo-500 shadow-brand-violet/20 hover:scale-[1.01]' 
                  : 'bg-gradient-to-r from-brand-teal to-emerald-600 hover:from-brand-teal hover:to-emerald-500 shadow-brand-teal/20 hover:scale-[1.01]'
              } ${loading ? 'opacity-80 cursor-wait' : ''}`}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Securing workspace...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-5 h-5" />
                  <span>{isLogin ? 'Enter Secure Room' : 'Create Secure Profile'}</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Security badge at bottom */}
        <div className="mt-8 flex justify-center items-center gap-2 text-gray-500 text-xs">
          <ShieldAlert className="w-4 h-4 text-brand-teal" />
          <span>Equipped with AES/RSA standard end-to-end media channel encryption</span>
        </div>
      </div>
    </div>
  );
}
