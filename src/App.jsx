import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import MeetingRoom from './components/MeetingRoom';
import { Loader2 } from 'lucide-react';

// Smart auto-resolving backend URL that works both locally and over the LAN
const BACKEND_URL = `${window.location.protocol}//${window.location.hostname}:5001`;

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('horizon_token') || null);
  const [user, setUser] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [verifying, setVerifying] = useState(true);

  // Verify JWT session on initial startup
  useEffect(() => {
    const verifySession = async () => {
      const cachedToken = localStorage.getItem('horizon_token');
      if (!cachedToken) {
        setVerifying(false);
        return;
      }

      try {
        const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${cachedToken}`,
            'Content-Type': 'application/json'
          }
        });
        const data = await response.json();
        
        if (data.success) {
          setUser(data.user);
          setToken(cachedToken);
        } else {
          // Token expired or invalid, purge
          handleLogout();
        }
      } catch (err) {
        console.error('Session verification network error:', err);
        // Fallback: trust local storage if offline backend fallback is active, 
        // to let the user proceed immediately
        const cachedUser = localStorage.getItem('horizon_user');
        if (cachedUser) {
          setUser(JSON.parse(cachedUser));
        } else {
          handleLogout();
        }
      } finally {
        setVerifying(false);
      }
    };

    verifySession();
  }, []);

  const handleAuthSuccess = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('horizon_token');
    localStorage.removeItem('horizon_user');
    setToken(null);
    setUser(null);
    setRoomId(null);
  };

  const handleJoinRoom = (selectedRoomId) => {
    setRoomId(selectedRoomId);
  };

  const handleLeaveRoom = () => {
    setRoomId(null);
  };

  // 1. App Startup Verification State
  if (verifying) {
    return (
      <div className="min-h-screen bg-[#070A13] flex flex-col items-center justify-center text-gray-200">
        <Loader2 className="w-12 h-12 text-brand-violet animate-spin mb-4" />
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Securing collaboration tunnel...
        </span>
      </div>
    );
  }

  // 2. Auth State Router
  if (!token || !user) {
    return (
      <Auth 
        onAuthSuccess={handleAuthSuccess} 
        backendUrl={BACKEND_URL} 
      />
    );
  }

  // 3. Meeting Room Active
  if (roomId) {
    return (
      <MeetingRoom
        roomId={roomId}
        user={user}
        token={token}
        backendUrl={BACKEND_URL}
        onLeaveRoom={handleLeaveRoom}
      />
    );
  }

  // 4. Standard Portal Dashboard
  return (
    <Dashboard
      user={user}
      token={token}
      backendUrl={BACKEND_URL}
      onJoinRoom={handleJoinRoom}
      onLogout={handleLogout}
    />
  );
}
