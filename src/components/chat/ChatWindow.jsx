import React, { useState, useRef, useEffect } from 'react';
import useChatSocket from '../../hooks/useChatSocket';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';

const ChatWindow = ({ workspaceId, currentUser, otherUser, isOpen, onClose }) => {
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);

  const { messages, sendMessage, isConnected, isLoading, error, typingUser, handleTyping, unreadCount } = useChatSocket(workspaceId);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUser]);

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!inputValue.trim() || !isConnected || isSending) {
      return;
    }

    try {
      setIsSending(true);
      await sendMessage(inputValue);
      setInputValue('');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    handleTyping();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  if (!isOpen) return null;

  // Show message if no workspace is selected
  if (!workspaceId) {
    return (
      <div className="fixed bottom-4 right-4 w-full sm:w-96 h-96 bg-white rounded-lg shadow-xl flex flex-col border border-[#E5E7EB] z-50">
        {/* Header */}
        <div className="bg-[#0F2A5E] text-white p-4 rounded-t-lg flex justify-between items-center">
          <h3 className="font-semibold">Chat</h3>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center text-center p-4">
          <div>
            <div className="text-4xl mb-2">💬</div>
            <p className="text-[#6B7280]">No active case selected</p>
            <p className="text-sm text-[#9CA3AF] mt-2">
              Select a case to start chatting with the lawyer
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-full sm:w-96 bg-white rounded-lg shadow-xl flex flex-col border border-[#E5E7EB] z-50 max-h-screen sm:max-h-[520px] animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="bg-[#0F2A5E] text-white p-4 rounded-t-lg flex justify-between items-center border-b border-[#1E3A5F]">
        <div className="flex-1">
          <h3 className="font-semibold text-base">
            {otherUser?.name || 'Chat'}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-[#1E6B4A]' : 'bg-[#DC2626]'
              }`}
            ></span>
            <span className="text-xs opacity-80">
              {isConnected ? 'Connected' : 'Reconnecting...'}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:bg-[#1E3A5F] hover:rounded p-1 text-xl leading-none"
        >
          ×
        </button>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 bg-[#FAFBFC]">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-300 animate-pulse"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-300 rounded animate-pulse mb-2 w-3/4"></div>
                  <div className="h-3 bg-gray-300 rounded animate-pulse w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-[#FEE2E2] border border-[#DC2626] text-[#991B1B] rounded p-3 text-sm">
            <p className="font-medium">Connection lost</p>
            <p className="text-xs mt-1">Retrying...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-2">💭</div>
            <p className="text-[#6B7280] text-sm">No messages yet</p>
            <p className="text-[#9CA3AF] text-xs mt-1">Start the conversation</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={message.sender_id === currentUser?.id}
                showAvatar={true}
              />
            ))}
            {typingUser && <TypingIndicator userName={typingUser} />}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      {!error && (
        <form
          onSubmit={handleSendMessage}
          className="border-t border-[#E5E7EB] p-4 bg-white rounded-b-lg"
        >
          <div className="flex gap-2">
            <textarea
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={!isConnected || isSending}
              rows="1"
              className="flex-1 border border-[#D1D5DB] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2A5E] resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
              style={{ maxHeight: '100px' }}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || !isConnected || isSending || isLoading}
              className="bg-[#0F2A5E] text-white px-4 py-2 rounded font-medium text-sm hover:bg-[#1E3A5F] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-w-12"
              title={!isConnected ? 'Reconnecting...' : ''}
            >
              {isSending ? (
                <span className="animate-spin">⟳</span>
              ) : (
                '⬆'
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ChatWindow;
