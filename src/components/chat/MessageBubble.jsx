import React from 'react';

function MessageBubble({ message, isOwn }) {
  const timeString = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
  const avatarLetter = (message.sender_name || 'U').charAt(0).toUpperCase();
  const roleLabel = message.sender_role === 'lawyer' ? 'Lawyer' : 'Client';
  const roleClassName = message.sender_role === 'lawyer'
    ? 'bg-[#C8920A] text-white'
    : 'bg-[#0E7490] text-white';

  return (
    <div className={`mb-3 flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
      {!isOwn && (
        <div className="order-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#0E7490] text-sm font-bold text-white">
          {avatarLetter}
        </div>
      )}

      <div className={`order-2 max-w-[70%] rounded-2xl px-4 py-2 ${isOwn ? 'bg-[#0F2A5E] text-white rounded-br-sm' : 'border border-[#0E7490] border-opacity-30 bg-[#F5F6FA] text-[#1A1F2E] rounded-bl-sm'}`}>
        <span className={`mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${roleClassName}`}>
          {roleLabel}
        </span>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        <div className="mt-1 flex items-center gap-1">
          <span className={`text-[10px] ${isOwn ? 'text-blue-200' : 'text-[#6B7280]'}`}>
            {timeString}
          </span>
          {isOwn && (
            <span className={`text-[10px] ${message.is_read ? 'text-[#1E6B4A]' : 'text-blue-200'}`}>
              {message.is_read ? '✓✓' : '✓'}
            </span>
          )}
        </div>
      </div>

      {isOwn && (
        <div className="order-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#0F2A5E] text-sm font-bold text-white">
          {avatarLetter}
        </div>
      )}
    </div>
  );
}

export default MessageBubble;
