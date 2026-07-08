import React from 'react';

function TypingIndicator({ userName }) {
  if (!userName) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 text-[#6B7280]">
      <style>{`
        @keyframes typingPulse {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.45; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
      <div className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-[#0E7490]" style={{ animation: 'typingPulse 1s infinite ease-in-out' }} />
        <span className="h-2 w-2 rounded-full bg-[#0E7490]" style={{ animation: 'typingPulse 1s infinite ease-in-out 0.15s' }} />
        <span className="h-2 w-2 rounded-full bg-[#0E7490]" style={{ animation: 'typingPulse 1s infinite ease-in-out 0.3s' }} />
      </div>
      <span className="text-sm">{userName} is typing...</span>
    </div>
  );
}

export default TypingIndicator;
