import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { 
  Video, VideoOff, Mic, MicOff, Monitor, XCircle, 
  MessageSquare, Palette, FolderDown, LogOut, Copy, Check, Users
} from 'lucide-react';
import Chat from './Chat';
import Whiteboard from './Whiteboard';
import FileShare from './FileShare';

export default function MeetingRoom({ roomId, user, token, backendUrl, onLeaveRoom }) {
  const [socket, setSocket] = useState(null);
  
  // Streams & hardware states
  const [localStream, setLocalStream] = useState(null);
  const [remotePeers, setRemotePeers] = useState([]); // Array of { socketId, user, stream, isSharingScreen }
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [hardwareError, setHardwareError] = useState('');

  // Sidebar drawer panels toggles
  const [activeDrawer, setActiveDrawer] = useState('chat'); // 'chat', 'whiteboard', 'files', or null
  const [copied, setCopied] = useState(false);

  // References
  const localVideoRef = useRef(null);
  const peersRef = useRef({}); // socketId -> RTCPeerConnection
  const streamRef = useRef(null); // Reference to track localStream across closures
  const screenTrackRef = useRef(null); // Screen track reference

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(backendUrl, {
      auth: { token },
      transports: ['websocket']
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      // Clean up local tracks on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [backendUrl, token]);

  // Request Camera & Audio Streams
  useEffect(() => {
    if (!socket) return;

    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: true
        });
        
        setLocalStream(stream);
        streamRef.current = stream;
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Start socket room join
        socket.emit('join-room', { roomId, user });
      } catch (err) {
        console.warn('Hardware permission blocked:', err.message);
        setHardwareError('Camera/Microphone access blocked. You are in Text-Only Collaboration mode.');
        setCameraActive(false);
        setMicActive(false);

        // Proceed to join room without local streams
        socket.emit('join-room', { roomId, user });
      }
    };

    initMedia();
  }, [socket, roomId, user]);

  // WebRTC Mesh Coordination
  useEffect(() => {
    if (!socket) return;

    // 1. Relayed when newly joined: returns all existing users in room
    socket.on('room-participants', async (participants) => {
      console.log('Received participants list from room:', participants);
      
      for (const peer of participants) {
        const pc = createPeerConnection(peer.socketId, peer.user);
        peersRef.current[peer.socketId] = pc;

        // Create WebRTC Offer
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('webrtc-offer', {
            targetSocketId: peer.socketId,
            offer
          });
        } catch (err) {
          console.error('Error creating offer for peer:', err);
        }
      }
    });

    // 2. Relayed when another user joins: creates peer connection but awaits their offer
    socket.on('user-connected', ({ socketId, user: newUser }) => {
      console.log(`User connected to signaling mesh: ${newUser.name} (${socketId})`);
      const pc = createPeerConnection(socketId, newUser);
      peersRef.current[socketId] = pc;
    });

    // 3. Receive offer from another peer: set remote description and create answer
    socket.on('webrtc-offer', async ({ senderSocketId, offer }) => {
      const pc = peersRef.current[senderSocketId];
      if (!pc) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        socket.emit('webrtc-answer', {
          targetSocketId: senderSocketId,
          answer
        });
      } catch (err) {
        console.error('Error processing offer:', err);
      }
    });

    // 4. Receive answer from peer: set remote description
    socket.on('webrtc-answer', async ({ senderSocketId, answer }) => {
      const pc = peersRef.current[senderSocketId];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    // 5. Receive ICE candidate from peer: append candidate
    socket.on('webrtc-candidate', async ({ senderSocketId, candidate }) => {
      const pc = peersRef.current[senderSocketId];
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      }
    });

    // 6. Handle peer disconnecting
    socket.on('user-disconnected', ({ socketId }) => {
      console.log(`Peer disconnected from mesh: ${socketId}`);
      if (peersRef.current[socketId]) {
        peersRef.current[socketId].close();
        delete peersRef.current[socketId];
      }
      setRemotePeers((prev) => prev.filter(p => p.socketId !== socketId));
    });

    return () => {
      socket.off('room-participants');
      socket.off('user-connected');
      socket.off('webrtc-offer');
      socket.off('webrtc-answer');
      socket.off('webrtc-candidate');
      socket.off('user-disconnected');
    };
  }, [socket, localStream]);

  // Create standard RTCPeerConnection configurations
  const createPeerConnection = (peerSocketId, peerUser) => {
    const iceServers = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(iceServers);

    // Relays ICE Candidate
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc-candidate', {
          targetSocketId: peerSocketId,
          candidate: event.candidate
        });
      }
    };

    // Relays Tracks / Streams
    pc.ontrack = (event) => {
      console.log(`Track received from peer socket: ${peerSocketId}`);
      const remoteStream = event.streams[0];
      
      setRemotePeers((prev) => {
        // Update if already present, otherwise add
        const exists = prev.some(p => p.socketId === peerSocketId);
        if (exists) {
          return prev.map(p => p.socketId === peerSocketId ? { ...p, stream: remoteStream } : p);
        }
        return [...prev, { socketId: peerSocketId, user: peerUser, stream: remoteStream, isSharingScreen: false }];
      });
    };

    // Add local tracks to peer connection
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, streamRef.current);
      });
    }

    return pc;
  };

  // Hardware Toggles
  const toggleCamera = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraActive(videoTrack.enabled);
      }
    }
  };

  const toggleMic = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicActive(audioTrack.enabled);
      }
    }
  };

  // Screen Sharing
  const toggleScreenShare = async () => {
    if (screenSharing) {
      stopScreenShare();
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      screenTrackRef.current = screenTrack;
      setScreenSharing(true);

      // Listen for screen sharing stop from the native browser top bar banner
      screenTrack.onended = () => {
        stopScreenShare();
      };

      // Hot-swap video tracks across all active peer connections in mesh
      Object.values(peersRef.current).forEach((pc) => {
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
        }
      });

      // Update local view
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }

      socket?.emit('screen-share', { roomId, isSharing: true });

    } catch (err) {
      console.error('Failed to share display:', err.message);
    }
  };

  const stopScreenShare = () => {
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }

    setScreenSharing(false);

    // Revert to camera tracks
    if (streamRef.current) {
      const cameraTrack = streamRef.current.getVideoTracks()[0];
      
      Object.values(peersRef.current).forEach((pc) => {
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender && cameraTrack) {
          videoSender.replaceTrack(cameraTrack);
        }
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = streamRef.current;
      }
    }

    socket?.emit('screen-share', { roomId, isSharing: false });
  };

  // Copy meeting code
  const copyMeetingId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Determine dynamic grid sizing styles depending on total participant count (including local)
  const getGridClass = () => {
    const count = remotePeers.length + (cameraActive || localStream ? 1 : 0);
    if (count <= 1) return 'grid-cols-1 max-w-xl mx-auto';
    if (count === 2) return 'grid-cols-1 sm:grid-cols-2 max-w-4xl mx-auto';
    return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto';
  };

  return (
    <div className="min-h-screen bg-[#070A13] text-gray-200 flex flex-col relative overflow-hidden h-screen">
      
      {/* Upper meeting details bar */}
      <header className="border-b border-gray-900 bg-dark-void/70 backdrop-blur-md px-6 py-4 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm bg-gradient-to-r from-brand-violet to-brand-teal bg-clip-text text-transparent uppercase tracking-wider">
            Room Active Session
          </span>
          <div className="bg-gray-900/80 border border-gray-800 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-gray-300">{roomId}</span>
            <button 
              onClick={copyMeetingId}
              className="p-1 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-all"
              title="Copy Room ID"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-brand-teal" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Counter of users */}
        <div className="flex items-center gap-2 bg-brand-violet/10 border border-brand-violet/30 px-3.5 py-1.5 rounded-xl">
          <Users className="w-4 h-4 text-brand-violet" />
          <span className="text-xs font-semibold text-brand-violet">
            {remotePeers.length + 1} Participant{remotePeers.length !== 0 && 's'}
          </span>
        </div>
      </header>

      {/* Main body area: Video Canvas Grid + Sidebar Drawers */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        
        {/* Workspace core */}
        <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto space-y-4">
          
          {/* Hardware permission warnings */}
          {hardwareError && (
            <div className="p-3.5 bg-red-950/20 border border-red-900/30 rounded-xl text-center text-xs font-semibold text-red-400 max-w-xl mx-auto w-full">
              {hardwareError}
            </div>
          )}

          {/* Active Work Area Switch */}
          {activeDrawer === 'whiteboard' ? (
            // Whiteboard Mode: primary view with small video shelf at top
            <div className="flex-1 flex flex-col gap-4 min-h-0">
              
              {/* Row of small video streams */}
              <div className="flex gap-4 overflow-x-auto py-1 shrink-0 scrollbar-thin">
                {(cameraActive || localStream) && (
                  <div className="w-44 aspect-video bg-gray-950 border border-gray-850 rounded-xl overflow-hidden relative shrink-0">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[9px] font-bold text-brand-teal">
                      You (Camera)
                    </div>
                  </div>
                )}
                {remotePeers.map((peer) => (
                  <div key={peer.socketId} className="w-44 aspect-video bg-gray-950 border border-gray-850 rounded-xl overflow-hidden relative shrink-0">
                    <video
                      ref={(el) => {
                        if (el && peer.stream) el.srcObject = peer.stream;
                      }}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[9px] font-bold text-white">
                      {peer.user.name}
                    </div>
                  </div>
                ))}
              </div>

              {/* Collaborative canvas */}
              <div className="flex-1 min-h-0">
                <Whiteboard socket={socket} roomId={roomId} />
              </div>
            </div>
          ) : (
            // standard Video Call Mode: beautiful responsive grid of participants
            <div className="flex-1 flex items-center justify-center">
              <div className={`grid gap-5 w-full ${getGridClass()}`}>
                
                {/* Local Camera Display */}
                {(cameraActive || localStream) && (
                  <div className="video-container aspect-video bg-gray-950 border border-gray-800/80 rounded-3xl overflow-hidden relative shadow-md group">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-full text-[10px] font-semibold text-brand-teal border border-brand-teal/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-teal animate-ping" />
                      <span>{screenSharing ? 'Sharing Screen' : 'Camera On'}</span>
                    </div>
                    <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/50 backdrop-blur-md rounded-xl text-xs font-semibold text-white">
                      You ({user.name})
                    </div>
                  </div>
                )}

                {/* Remote Participant Streams */}
                {remotePeers.map((peer) => (
                  <div 
                    key={peer.socketId}
                    className="video-container aspect-video bg-gray-950 border border-gray-850 rounded-3xl overflow-hidden relative shadow-md"
                  >
                    <video
                      ref={(el) => {
                        if (el && peer.stream) el.srcObject = peer.stream;
                      }}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/50 backdrop-blur-md rounded-xl text-xs font-semibold text-white">
                      {peer.user.name}
                    </div>
                  </div>
                ))}

                {/* Placeholder when lonely */}
                {remotePeers.length === 0 && !localStream && (
                  <div className="aspect-video bg-gray-950 border border-gray-850 rounded-3xl flex flex-col items-center justify-center text-center p-8">
                    <Users className="w-8 h-8 text-gray-700 mb-2 animate-pulse" />
                    <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Awaiting connections...</span>
                    <p className="text-[10px] text-gray-600 mt-1 max-w-[200px]">Share your room code with peers to start face-to-face chat.</p>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* Floating actions menu at bottom */}
          <div className="flex justify-center pb-2 shrink-0">
            <div className="bg-gray-900/90 backdrop-blur-md border border-gray-800/80 px-6 py-3.5 rounded-3xl flex items-center gap-3 shadow-xl">
              
              {/* Camera Trigger */}
              <button
                onClick={toggleCamera}
                disabled={!localStream}
                className={`p-3 rounded-2xl transition-all ${
                  cameraActive 
                    ? 'bg-gray-800 hover:bg-gray-700 text-white hover:scale-105' 
                    : 'bg-red-500/20 border border-red-500/30 text-red-500 hover:scale-105'
                }`}
                title={cameraActive ? 'Turn Video Off' : 'Turn Video On'}
              >
                {cameraActive ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>

              {/* Mic Trigger */}
              <button
                onClick={toggleMic}
                disabled={!localStream}
                className={`p-3 rounded-2xl transition-all ${
                  micActive 
                    ? 'bg-gray-800 hover:bg-gray-700 text-white hover:scale-105' 
                    : 'bg-red-500/20 border border-red-500/30 text-red-500 hover:scale-105'
                }`}
                title={micActive ? 'Mute Mic' : 'Unmute Mic'}
              >
                {micActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>

              {/* Display share */}
              <button
                onClick={toggleScreenShare}
                disabled={!localStream}
                className={`p-3 rounded-2xl transition-all ${
                  screenSharing 
                    ? 'bg-brand-teal text-white shadow-md shadow-brand-teal/20 hover:scale-105' 
                    : 'bg-gray-800 hover:bg-gray-700 text-white hover:scale-105'
                }`}
                title={screenSharing ? 'Stop Screen Share' : 'Share Screen'}
              >
                <Monitor className="w-5 h-5" />
              </button>

              <div className="w-[1px] h-6 bg-gray-800 mx-1" />

              {/* Whiteboard Panel Drawer Toggle */}
              <button
                onClick={() => setActiveDrawer(activeDrawer === 'whiteboard' ? null : 'whiteboard')}
                className={`p-3 rounded-2xl transition-all ${
                  activeDrawer === 'whiteboard' 
                    ? 'bg-brand-violet text-white shadow-md shadow-brand-violet/20 hover:scale-105' 
                    : 'bg-gray-800 hover:bg-gray-700 text-white hover:scale-105'
                }`}
                title="Collaborative Canvas"
              >
                <Palette className="w-5 h-5" />
              </button>

              {/* Chat Panel Drawer Toggle */}
              <button
                onClick={() => setActiveDrawer(activeDrawer === 'chat' ? null : 'chat')}
                className={`p-3 rounded-2xl transition-all ${
                  activeDrawer === 'chat' 
                    ? 'bg-brand-violet text-white shadow-md shadow-brand-violet/20 hover:scale-105' 
                    : 'bg-gray-800 hover:bg-gray-700 text-white hover:scale-105'
                }`}
                title="Instant Chat"
              >
                <MessageSquare className="w-5 h-5" />
              </button>

              {/* Files vault Drawer Toggle */}
              <button
                onClick={() => setActiveDrawer(activeDrawer === 'files' ? null : 'files')}
                className={`p-3 rounded-2xl transition-all ${
                  activeDrawer === 'files' 
                    ? 'bg-brand-teal text-white shadow-md shadow-brand-teal/20 hover:scale-105' 
                    : 'bg-gray-800 hover:bg-gray-700 text-white hover:scale-105'
                }`}
                title="Files Sharing vault"
              >
                <FolderDown className="w-5 h-5" />
              </button>

              <div className="w-[1px] h-6 bg-gray-800 mx-1" />

              {/* Leave Meeting action */}
              <button
                onClick={onLeaveRoom}
                className="p-3 bg-red-600 hover:bg-red-500 hover:scale-105 active:scale-95 text-white rounded-2xl shadow-lg shadow-red-600/10 transition-all flex items-center justify-center"
                title="Disconnect call"
              >
                <LogOut className="w-5 h-5" />
              </button>

            </div>
          </div>

        </div>

        {/* Sidebar panels tray */}
        {activeDrawer && activeDrawer !== 'whiteboard' && (
          <div className="w-80 border-l border-gray-900 bg-gray-950 p-4 shrink-0 flex flex-col h-full animate-fade-in relative z-20">
            {activeDrawer === 'chat' && (
              <Chat 
                socket={socket} 
                roomId={roomId} 
                user={user} 
              />
            )}
            {activeDrawer === 'files' && (
              <FileShare 
                socket={socket} 
                roomId={roomId} 
                token={token} 
                backendUrl={backendUrl} 
              />
            )}
          </div>
        )}

      </div>
    </div>
  );
}
