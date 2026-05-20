import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare } from 'lucide-react';

export default function Chat({ socket, roomId, user }) {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Listens to messages broadcasted by the signaling server
    if (socket) {
      socket.on('receive-message', (msg) => {
        setMessages((prev) => [...prev, msg]);
      });
    }

    return () => {
      if (socket) socket.off('receive-message');
    };
  }, [socket]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !socket) return;

    // Send to socket signaling server
    socket.emit('send-message', {
      roomId,
      message: messageInput.trim()
    });

    setMessageInput('');
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 rounded-2xl border border-gray-800/80 overflow-hidden">
      
      {/* Drawer Header */}
      <div className="p-4 bg-gray-900/80 border-b border-gray-800 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-brand-violet" />
        <span className="font-bold text-sm text-white">Live Discussion Channel</span>
      </div>

      {/* Messages List Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 min-h-[250px] bg-[#0A0E17]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
            <div className="w-12 h-12 rounded-2xl bg-gray-900 border border-gray-800/80 flex items-center justify-center text-gray-500 mb-3">
              <MessageSquare className="w-6 h-6" />
            </div>
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">No messages yet</span>
            <p className="text-[11px] text-gray-600 mt-1 max-w-[200px]">Send a message to start collaboration chat.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender === user.name;
            return (
              <div 
                key={msg.id || Math.random().toString()} 
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-fade-in`}
              >
                {/* Sender Tag */}
                <span className="text-[9px] font-semibold text-gray-500 mb-1 px-1">
                  {isMe ? 'You' : msg.sender}
                </span>

                {/* Bubble Container */}
                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-xs leading-relaxed shadow-sm ${
                  isMe 
                    ? 'bg-gradient-to-tr from-brand-violet to-indigo-600 text-white rounded-tr-none' 
                    : 'bg-gray-900 border border-gray-800/80 text-gray-200 rounded-tl-none'
                }`}>
                  <p className="break-words whitespace-pre-wrap">{msg.message}</p>
                </div>

                {/* Timestamp */}
                <span className="text-[8px] text-gray-600 mt-1 px-1 font-mono">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input footer */}
      <form onSubmit={handleSendMessage} className="p-3 bg-gray-900/80 border-t border-gray-800 flex gap-2">
        <input
          type="text"
          placeholder="Type your message..."
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          className="flex-1 bg-gray-950 border border-gray-800 focus:border-brand-violet rounded-xl px-4 py-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-violet/20 transition-all"
        />
        <button
          type="submit"
          disabled={!messageInput.trim()}
          className="p-3 bg-brand-violet text-white hover:bg-brand-violet/90 disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed hover:scale-[1.03] active:scale-95 rounded-xl shadow-md transition-all flex items-center justify-center shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
