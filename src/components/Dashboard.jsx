import React, { useState } from 'react';
import { Video, Plus, ArrowRight, LogOut, Clipboard, Check, Sparkles, MonitorPlay } from 'lucide-react';

export default function Dashboard({ user, token, backendUrl, onJoinRoom, onLogout }) {
  const [roomIdInput, setRoomIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [createdRoomId, setCreatedRoomId] = useState('');

  // 1. Create a Room
  const handleCreateRoom = async () => {
    setLoading(true);
    setError('');
    setCreatedRoomId('');
    try {
      const response = await fetch(`${backendUrl}/api/rooms/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setCreatedRoomId(data.roomId);
        // Auto copy to clipboard
        navigator.clipboard.writeText(data.roomId);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 3000);
        
        // Auto navigate inside room after brief delay for visual feedback
        setTimeout(() => {
          onJoinRoom(data.roomId);
        }, 1200);
      } else {
        setError(data.message || 'Could not create meeting room.');
      }
    } catch (err) {
      console.error('Create room api error:', err);
      setError('Network connection error. Server might be down.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Join an Existing Room
  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!roomIdInput.trim()) {
      setError('Please enter a valid Room ID.');
      return;
    }

    setLoading(true);
    setError('');
    
    // Clean formatted ID before checking
    const formattedId = roomIdInput.trim().toLowerCase();

    try {
      const response = await fetch(`${backendUrl}/api/rooms/${formattedId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        onJoinRoom(data.room.roomId);
      } else {
        setError(data.message || 'Room does not exist or has expired.');
      }
    } catch (err) {
      console.error('Join room API error:', err);
      setError('Server network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070A13] text-gray-200 relative overflow-hidden flex flex-col">
      
      {/* Background blur effects */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-brand-violet/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-brand-teal/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Header bar */}
      <header className="border-b border-gray-800/80 bg-dark-void/60 backdrop-blur-md px-6 py-4 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-brand-violet to-brand-teal rounded-xl flex items-center justify-center shadow-md shadow-brand-violet/10">
            <MonitorPlay className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Horizon Portal
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-sm font-semibold text-white">{user.name}</span>
            <span className="text-[10px] text-gray-500 tracking-wider font-medium uppercase">{user.email}</span>
          </div>
          
          {/* Custom Avatar */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-violet/20 to-brand-teal/20 border border-brand-violet/40 flex items-center justify-center font-bold text-white uppercase shadow-sm">
            {user.name.charAt(0)}
          </div>

          <button 
            onClick={onLogout}
            className="p-2.5 bg-gray-900/60 border border-gray-800 hover:border-red-500/40 hover:bg-red-950/20 text-gray-400 hover:text-red-400 rounded-xl transition-all duration-300"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        <div className="w-full max-w-4xl grid md:grid-cols-5 gap-8 items-stretch animate-slide-up">
          
          {/* Left panel: Info & Cosmic Card (Columns: 2) */}
          <div className="md:col-span-2 flex flex-col justify-between glass-panel rounded-3xl p-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-violet/10 rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-violet/10 border border-brand-violet/30 rounded-full text-brand-violet text-[10px] font-bold tracking-wider uppercase">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Enterprise Suite Active</span>
              </div>
              
              <h2 className="text-4xl font-extrabold text-white leading-tight">
                Seamless <br/>
                <span className="bg-gradient-to-r from-brand-violet to-brand-teal bg-clip-text text-transparent">Collaborative</span> <br/>
                Meetings.
              </h2>
              
              <p className="text-gray-400 text-sm leading-relaxed">
                Connect dynamically over WebRTC channels. Draw together, chat instantly, share files in a fully protected sandbox.
              </p>
            </div>

            {/* Micro Dashboard Statistics Grid */}
            <div className="grid grid-cols-2 gap-4 mt-8">
              <div className="p-4 bg-gray-950/40 border border-gray-800/80 rounded-2xl">
                <span className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">P2P Latency</span>
                <span className="text-xl font-extrabold text-brand-teal">~24 ms</span>
              </div>
              <div className="p-4 bg-gray-950/40 border border-gray-800/80 rounded-2xl">
                <span className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Canvas Sync</span>
                <span className="text-xl font-extrabold text-brand-violet">Real-Time</span>
              </div>
            </div>
          </div>

          {/* Right Panel: Operations (Columns: 3) */}
          <div className="md:col-span-3 flex flex-col gap-6">
            
            {/* Display validation or server error cards */}
            {error && (
              <div className="p-4 bg-red-950/40 border border-red-500/30 rounded-2xl text-red-400 text-xs font-semibold">
                {error}
              </div>
            )}

            {/* Create Meeting Card */}
            <div className="glass-panel p-8 rounded-3xl relative overflow-hidden shadow-lg group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-violet/5 group-hover:bg-brand-violet/10 rounded-full blur-3xl transition-all duration-300 pointer-events-none"></div>
              
              <div className="flex items-start justify-between relative z-10">
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Video className="w-5 h-5 text-brand-violet" />
                    <span>Host Instant Room</span>
                  </h3>
                  <p className="text-xs text-gray-400">Spawn a new meeting code and invite your colleagues instantly.</p>
                </div>
                
                <button
                  onClick={handleCreateRoom}
                  disabled={loading}
                  className="p-4 bg-brand-violet text-white hover:bg-brand-violet/90 rounded-2xl shadow-lg shadow-brand-violet/20 hover:scale-105 active:scale-95 transition-all relative z-20"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>

              {/* Clipboard overlay alert when room is generated */}
              {createdRoomId && (
                <div className="mt-4 p-4 bg-gray-950/60 border border-brand-violet/30 rounded-2xl flex items-center justify-between animate-fade-in">
                  <div>
                    <span className="block text-[9px] text-gray-500 uppercase tracking-wider font-bold">Room Code copied to clipboard!</span>
                    <span className="text-sm font-bold text-brand-teal font-mono">{createdRoomId}</span>
                  </div>
                  <div className="p-2 bg-brand-teal/10 border border-brand-teal/30 rounded-xl text-brand-teal">
                    {copySuccess ? <Check className="w-4 h-4" /> : <Clipboard className="w-4 h-4" />}
                  </div>
                </div>
              )}
            </div>

            {/* Join Meeting Card */}
            <div className="glass-panel p-8 rounded-3xl relative overflow-hidden shadow-lg">
              <div className="space-y-6">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <MonitorPlay className="w-5 h-5 text-brand-teal" />
                    <span>Enter Existing Room</span>
                  </h3>
                  <p className="text-xs text-gray-400">Join an ongoing collaboration session using a room code.</p>
                </div>

                <form onSubmit={handleJoinRoom} className="flex gap-3">
                  <input
                    type="text"
                    placeholder="e.g. abc-1234-xyz"
                    value={roomIdInput}
                    onChange={(e) => setRoomIdInput(e.target.value)}
                    className="flex-1 bg-gray-900/60 border border-gray-800 focus:border-brand-teal rounded-2xl px-5 py-4 text-sm font-mono text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-teal/30 transition-all uppercase"
                  />
                  <button
                    type="submit"
                    disabled={loading || !roomIdInput}
                    className="px-6 bg-gradient-to-r from-brand-teal to-emerald-600 hover:from-brand-teal hover:to-emerald-500 text-white rounded-2xl font-semibold text-sm flex items-center gap-2 shadow-lg shadow-brand-teal/10 hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed transition-all"
                  >
                    <span>Join</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* Footer copyright */}
      <footer className="py-6 text-center text-[10px] text-gray-600 tracking-wider font-semibold border-t border-gray-900 relative z-10">
        © 2026 HORIZON TECHX INC. ALL CHANNELS PROTECTED.
      </footer>
    </div>
  );
}
