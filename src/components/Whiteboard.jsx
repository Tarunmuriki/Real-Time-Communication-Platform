import React, { useRef, useEffect, useState } from 'react';
import { Palette, Trash2, Eraser, Square } from 'lucide-react';

export default function Whiteboard({ socket, roomId }) {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#6366F1'); // Indigo default
  const [brushSize, setBrushSize] = useState(4);
  const [isEraser, setIsEraser] = useState(false);

  // Colors available for selection
  const colors = [
    '#6366F1', // Indigo
    '#14B8A6', // Teal
    '#EF4444', // Red
    '#F59E0B', // Yellow
    '#10B981', // Green
    '#FFFFFF'  // White
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    
    // We set a large fixed internal resolution for consistency across users.
    // CSS will stretch/fit it responsively in the panel container.
    canvas.width = 1200;
    canvas.height = 800;

    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    context.lineJoin = 'round';
    contextRef.current = context;

    // Load initial background (dark board look)
    clearCanvasLocal();

    // Socket drawing listener
    if (socket) {
      socket.on('draw', (drawData) => {
        const { x, y, prevX, prevY, strokeColor, strokeSize, isClear } = drawData;
        
        if (isClear) {
          clearCanvasLocal();
          return;
        }

        drawStrokeOnCanvas(x, y, prevX, prevY, strokeColor, strokeSize);
      });
    }

    return () => {
      if (socket) socket.off('draw');
    };
  }, [socket]);

  // Utility to clear local canvas back to dark slate
  const clearCanvasLocal = () => {
    const canvas = canvasRef.current;
    if (!canvas || !contextRef.current) return;
    const ctx = contextRef.current;
    ctx.fillStyle = '#0F172A'; // Slate-900 canvas bg
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  // Emit clear board event to everyone
  const handleClearBoard = () => {
    clearCanvasLocal();
    if (socket) {
      socket.emit('draw', {
        roomId,
        drawData: { isClear: true }
      });
    }
  };

  // Perform actual drawing on canvas
  const drawStrokeOnCanvas = (x, y, prevX, prevY, strokeColor, strokeSize) => {
    if (!contextRef.current) return;
    const ctx = contextRef.current;
    ctx.beginPath();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeSize;
    ctx.moveTo(prevX, prevY);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.closePath();
  };

  // Map mouse event page coordinates to fixed internal resolution
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Scale coords to match internal fixed width/height
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  };

  // Mouse & Touch down handlers
  const startDrawing = (e) => {
    const coords = getCoordinates(e.nativeEvent.touches ? e.nativeEvent.touches[0] : e);
    setIsDrawing(true);
    canvasRef.current.prevCoords = coords;
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault(); // Stop scrolling on touch screens

    const currentCoords = getCoordinates(e.nativeEvent.touches ? e.nativeEvent.touches[0] : e);
    const prevCoords = canvasRef.current.prevCoords;

    if (!prevCoords) return;

    const strokeColor = isEraser ? '#0F172A' : color;
    const strokeSize = brushSize;

    // Draw locally
    drawStrokeOnCanvas(currentCoords.x, currentCoords.y, prevCoords.x, prevCoords.y, strokeColor, strokeSize);

    // Emit to other peers
    if (socket) {
      socket.emit('draw', {
        roomId,
        drawData: {
          x: currentCoords.x,
          y: currentCoords.y,
          prevX: prevCoords.x,
          prevY: prevCoords.y,
          strokeColor,
          strokeSize
        }
      });
    }

    canvasRef.current.prevCoords = currentCoords;
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      canvasRef.current.prevCoords = null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 rounded-2xl border border-gray-800/80 overflow-hidden">
      
      {/* Control bar */}
      <div className="p-4 bg-gray-900/80 border-b border-gray-800 flex flex-wrap gap-4 items-center justify-between">
        
        {/* Colors */}
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-brand-violet" />
          <div className="flex gap-1.5 bg-black/45 p-1 rounded-xl border border-gray-800">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setColor(c);
                  setIsEraser(false);
                }}
                style={{ backgroundColor: c }}
                className={`w-6 h-6 rounded-lg transition-all ${
                  color === c && !isEraser ? 'scale-110 ring-2 ring-indigo-500' : 'opacity-70 hover:opacity-100'
                }`}
                title={c === '#FFFFFF' ? 'White / Chalk' : 'Brush Color'}
              />
            ))}
          </div>
        </div>

        {/* Eraser and sizes */}
        <div className="flex items-center gap-4">
          
          {/* Eraser */}
          <button
            onClick={() => setIsEraser(!isEraser)}
            className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-semibold ${
              isEraser 
                ? 'bg-brand-violet text-white border-brand-violet shadow-sm shadow-brand-violet/20' 
                : 'bg-gray-800/60 text-gray-300 border-gray-700 hover:border-gray-600'
            }`}
            title="Toggle Eraser"
          >
            <Eraser className="w-4 h-4" />
            <span>Eraser</span>
          </button>

          {/* Size slide */}
          <div className="flex items-center gap-2">
            <Square className="w-3.5 h-3.5 text-gray-500" />
            <input
              type="range"
              min="2"
              max="24"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-20 sm:w-28 accent-brand-violet cursor-pointer h-1 bg-gray-800 rounded-lg appearance-none"
            />
            <span className="text-[10px] font-mono text-gray-400 font-bold bg-black/35 px-1.5 py-0.5 rounded border border-gray-800">
              {brushSize}px
            </span>
          </div>
        </div>

        {/* Clear panel */}
        <button
          onClick={handleClearBoard}
          className="p-2 bg-red-950/20 border border-red-900/30 hover:border-red-500/50 hover:bg-red-950/40 text-red-400 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold"
          title="Clear Board"
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear Board</span>
        </button>
      </div>

      {/* Canvas viewport container */}
      <div className="flex-1 bg-[#0F172A] relative flex items-center justify-center p-2 min-h-[300px]">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-full max-h-[60vh] object-contain rounded-lg shadow-inner cursor-crosshair touch-none"
          style={{ display: 'block' }}
        />
      </div>
    </div>
  );
}
