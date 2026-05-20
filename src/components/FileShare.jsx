import React, { useState, useEffect, useRef } from 'react';
import { Upload, Download, File, Loader2, Sparkles, FolderDown } from 'lucide-react';

export default function FileShare({ socket, roomId, token, backendUrl }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Listen for file broadcasts from other participants in the room
    if (socket) {
      const handleFileShared = (sharedFile) => {
        setFiles((prev) => [sharedFile, ...prev]);
      };
      
      socket.on('receive-shared-file', handleFileShared);
      
      // We can also trigger this via a standard room broadcast relay.
      // To ensure dual-relay compatibility (even if custom socket is not registered on backend yet),
      // we also listen for receive-message and filter if it contains file metadata.
      socket.on('file-shared', handleFileShared);

      return () => {
        socket.off('receive-shared-file', handleFileShared);
        socket.off('file-shared', handleFileShared);
      };
    }
  }, [socket]);

  // Format bytes to human readable format
  const formatBytes = (bytes, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const handleUploadFile = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Check size limit: 50MB
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('File size exceeds the 50MB limit.');
      return;
    }

    setUploading(true);
    setUploadProgress(20);
    setError('');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('roomId', roomId);

    try {
      setUploadProgress(50);
      const response = await fetch(`${backendUrl}/api/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await response.json();
      
      setUploadProgress(90);

      if (data.success) {
        setUploadProgress(100);
        const newSharedFile = data.file;

        // Append locally
        setFiles((prev) => [newSharedFile, ...prev]);

        // Broadcast to other sockets in room
        if (socket) {
          // Relaying through a chat message or a custom file-share notice
          socket.emit('send-message', {
            roomId,
            message: `📁 shared a file: "${newSharedFile.name}" (Download available in files tab)`
          });
          
          // Emit direct file sharing metadata to sync lists
          socket.emit('draw', { // Utilise current generic broadcast channel or relay custom
            roomId,
            drawData: {
              isSharedFileRelay: true,
              file: newSharedFile
            }
          });
        }
      } else {
        setError(data.message || 'File upload failed.');
      }
    } catch (err) {
      console.error('File upload network error:', err);
      setError('Network communication failed. Server might be down.');
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 800);
    }
  };

  // Listen to file relays coming through drawing/data socket channel
  useEffect(() => {
    if (socket) {
      const handleGeneralRelay = (drawData) => {
        if (drawData && drawData.isSharedFileRelay && drawData.file) {
          setFiles((prev) => {
            // Check duplicate
            if (prev.some(f => f.filename === drawData.file.filename)) return prev;
            return [drawData.file, ...prev];
          });
        }
      };
      socket.on('draw', handleGeneralRelay);
      return () => {
        socket.off('draw', handleGeneralRelay);
      };
    }
  }, [socket]);

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 rounded-2xl border border-gray-800/80 overflow-hidden">
      
      {/* Header */}
      <div className="p-4 bg-gray-900/80 border-b border-gray-800 flex items-center gap-2">
        <FolderDown className="w-5 h-5 text-brand-teal" />
        <span className="font-bold text-sm text-white">Files Share Vault</span>
      </div>

      {/* Upload Drop Zone Area */}
      <div className="p-5 border-b border-gray-900 bg-[#0A0E17]">
        <div
          onClick={triggerFileSelect}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-300 ${
            uploading 
              ? 'border-brand-teal/40 bg-brand-teal/5 pointer-events-none' 
              : 'border-gray-800 hover:border-brand-teal/50 hover:bg-gray-900/35'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUploadFile}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center space-y-3">
            {uploading ? (
              <>
                <Loader2 className="w-8 h-8 text-brand-teal animate-spin" />
                <div className="space-y-1 w-full max-w-[200px]">
                  <span className="text-xs font-semibold text-brand-teal">Uploading shared asset...</span>
                  <div className="w-full bg-gray-800 h-1 rounded-full overflow-hidden">
                    <div 
                      className="bg-brand-teal h-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl bg-gray-950 border border-gray-800 flex items-center justify-center text-gray-400">
                  <Upload className="w-5 h-5 text-brand-teal" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-white">Choose a file or drop here</span>
                  <p className="text-[10px] text-gray-500">Supports documents, PDFs, slides, and images up to 50MB</p>
                </div>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-950/20 border border-red-900/30 rounded-xl text-[11px] font-semibold text-red-400">
            {error}
          </div>
        )}
      </div>

      {/* Shared Files List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#070A12] min-h-[150px]">
        <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider pl-1 mb-2">
          Shared Document Registry
        </span>

        {files.length === 0 ? (
          <div className="py-8 text-center text-gray-600 flex flex-col items-center justify-center">
            <File className="w-8 h-8 text-gray-700 mb-2" />
            <p className="text-[11px] font-medium leading-relaxed">No shared files in this meeting yet.</p>
          </div>
        ) : (
          files.map((file) => (
            <div 
              key={file.filename || Math.random().toString()} 
              className="p-3.5 bg-gray-900/80 border border-gray-800/80 rounded-2xl flex items-center justify-between gap-3 hover:border-gray-700/80 transition-all duration-300 animate-fade-in"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-gray-950 border border-gray-800 flex items-center justify-center text-gray-400 shrink-0">
                  <File className="w-4 h-4 text-brand-teal" />
                </div>
                <div className="min-w-0">
                  <span className="block text-xs font-semibold text-white truncate" title={file.name}>
                    {file.name}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-gray-500 font-semibold uppercase">
                    <span>{file.sender}</span>
                    <span>•</span>
                    <span className="font-mono">{formatBytes(file.size)}</span>
                  </div>
                </div>
              </div>

              <a
                href={`${backendUrl}${file.url}`}
                download={file.name}
                target="_blank"
                rel="noreferrer"
                className="p-2 bg-gray-950 border border-gray-800 hover:border-brand-teal hover:bg-brand-teal/10 hover:text-brand-teal rounded-xl text-gray-400 transition-all shadow-sm shrink-0"
                title="Download file"
              >
                <Download className="w-4 h-4" />
              </a>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
