import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useChatSocket from '../../hooks/useChatSocket';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';

// Derive a deterministic workspace UUID from two user IDs
const workspaceIdFn = (a, b) => {
  const [lo, hi] = [Math.min(a, b), Math.max(a, b)];
  return `00000000-0000-0000-${String(lo).padStart(4, '0')}-${String(hi).padStart(12, '0')}`;
};

const Chat = () => {
  const { userId: paramUserId } = useParams();
  const navigate = useNavigate();
  const [chatUsers, setChatUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(paramUserId || null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [filterTab, setFilterTab] = useState('All'); // All, Unread, Recent

  const selectedUserRef = useRef(selectedUser);
  useEffect(() => { selectedUserRef.current = selectedUser; }, [selectedUser]);

  const wsId = currentUserId && selectedUser
    ? workspaceIdFn(parseInt(currentUserId), parseInt(selectedUser))
    : null;

  const { messages, isLoading: loadingMessages, typingUser, sendMessage, emitTyping, markRead } =
    useChatSocket(wsId);

  const { user } = useAuth();

  // Get current user id
  useEffect(() => {
    if (user?.id) {
      setCurrentUserId(user.id);
    }
  }, [user]);

  // Load conversation list
  useEffect(() => {
    if (!user) return;
    const fetchUsers = async () => {
      try {
        let userIds = new Set();
        // Get appointments
        const { data: apts } = await supabase.from('appointments').select('client_id, lawyer_id').or(`client_id.eq.${user.id},lawyer_id.eq.${user.id}`);
        apts?.forEach(a => { userIds.add(a.client_id); userIds.add(a.lawyer_id); });
        // Get contracts
        const { data: contracts } = await supabase.from('contracts').select('client_id, lawyer_id').or(`client_id.eq.${user.id},lawyer_id.eq.${user.id}`);
        contracts?.forEach(c => { userIds.add(c.client_id); userIds.add(c.lawyer_id); });
        
        userIds.delete(user.id);
        
        if (userIds.size === 0) {
          setChatUsers([]);
          return;
        }

        const { data: users } = await supabase.from('users').select('id, name, user_type').in('id', Array.from(userIds));
        
        const formattedUsers = await Promise.all((users || []).map(async u => {
          const currentWsId = workspaceIdFn(user.id, u.id);
          const { data: lastMsg } = await supabase.from('messages').select('content, created_at').eq('workspace_id', currentWsId).order('created_at', { ascending: false }).limit(1).single();
          const { count: unreadCount } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('workspace_id', currentWsId).eq('is_read', false).neq('sender_id', user.id);
          return {
            ...u,
            last_message: lastMsg?.content || null,
            last_message_time: lastMsg?.created_at || null,
            unread_count: unreadCount || 0
          };
        }));
        
        // Sort by last message time
        formattedUsers.sort((a,b) => new Date(b.last_message_time || 0) - new Date(a.last_message_time || 0));
        setChatUsers(formattedUsers);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, [user]);

  // Real-time: update conversation list last_message on new message
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('chat_list_global')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new;
        setChatUsers(prev => {
          const updated = prev.map(u => {
            const expectedWsId = workspaceIdFn(user.id, u.id);
            if (msg.workspace_id !== expectedWsId) return u;
            return {
              ...u,
              last_message: msg.content,
              last_message_time: msg.created_at,
              unread_count: String(u.id) === String(selectedUserRef.current)
                ? u.unread_count
                : (u.unread_count || 0) + (msg.sender_id !== user.id ? 1 : 0),
            };
          });
          return updated.sort((a,b) => new Date(b.last_message_time || 0) - new Date(a.last_message_time || 0));
        });
      })
      .subscribe();
      
    return () => supabase.removeChannel(channel);
  }, [user]);

  // Mark messages read when conversation opens
  useEffect(() => {
    if (wsId) {
      markRead();
      setChatUsers(prev => prev.map(u =>
        String(u.id) === String(selectedUser) ? { ...u, unread_count: 0 } : u
      ));
    }
  }, [wsId, markRead, selectedUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    let contentToSend = newMessage.trim();
    
    if (attachment) {
      setUploading(true);
      try {
        const fileExt = attachment.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `chat_attachments/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, attachment);
          
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath);
          
        contentToSend = `[Attachment: ${attachment.name}](${publicUrl})\n` + contentToSend;
        setAttachment(null);
      } catch (err) {
        toast.error('Failed to upload attachment');
        setUploading(false);
        return;
      }
      setUploading(false);
    }
    
    if (!contentToSend) return;

    setNewMessage('');
    emitTyping(false);
    const result = await sendMessage(contentToSend);
    if (result && !result.success) {
      toast.error('Failed to send message');
      setNewMessage(contentToSend);
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    emitTyping(e.target.value.length > 0);
  };

  const formatListTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const diff = (Date.now() - d) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 172800) return 'Yesterday';
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const formatMessageTime = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const selectedUserData = chatUsers.find((u) => String(u.id) === String(selectedUser));

  const filteredUsers = chatUsers.filter(u => {
    if (filterTab === 'Unread') return u.unread_count > 0;
    return true;
  });

  return (
    <div className="flex h-screen bg-[#2d2d2d] text-gray-200 font-sans">
      <style>{`
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24; }
        .material-symbols-filled { font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24; font-family: 'Material Symbols Outlined'; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #555; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #777; }
        
        .chat-sidebar { background-color: #272727; }
        .chat-main { background-color: #323232; }
      `}</style>
      
      {/* Sidebar List */}
      <div className="w-80 flex flex-col border-r border-[#404040] chat-sidebar shrink-0 z-10">
        <div className="p-5 border-b border-[#404040]">
          <h2 className="text-xl font-semibold mb-4 text-white">Messages</h2>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">search</span>
            <input 
              type="text" 
              placeholder="Search conversations..." 
              className="w-full bg-[#1e1e1e] border border-[#404040] rounded-md py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-gray-500 text-white placeholder-gray-500"
            />
          </div>
        </div>

        <div className="flex px-4 py-3 gap-2 border-b border-[#404040]">
          {['All', 'Unread', 'Recent'].map(tab => (
            <button 
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`flex-1 py-1 text-sm rounded border ${filterTab === tab ? 'bg-[#3b3b3b] border-gray-500 text-white' : 'border-[#404040] text-gray-400 hover:bg-[#333]'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingUsers ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-12 h-12 bg-[#404040] rounded-full"></div>
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-[#404040] rounded w-3/4"></div>
                    <div className="h-3 bg-[#404040] rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-sm">No conversations found.</div>
          ) : (
            filteredUsers.map(u => {
              const isActive = String(selectedUser) === String(u.id);
              // Avatar colors pseudo-random
              const colors = ['bg-[#1b2b4b]', 'bg-[#1e4b3e]', 'bg-[#5a4220]', 'bg-[#4a2b2b]', 'bg-[#3e3b5e]'];
              const colorIdx = parseInt(u.id) % colors.length;
              const avatarColor = colors[colorIdx || 0];

              return (
                <div 
                  key={u.id} 
                  onClick={() => { setSelectedUser(String(u.id)); navigate(`/chat/${u.id}`); }}
                  className={`flex items-start gap-3 p-4 cursor-pointer border-b border-[#404040] transition-colors
                    ${isActive ? 'bg-white text-black' : 'hover:bg-[#333]'}`}
                >
                  <div className="relative shrink-0">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-medium text-lg ${avatarColor}`}>
                      {u.name.substring(0, 2).toUpperCase()}
                    </div>
                    {/* Status dot */}
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-[#272727] rounded-full"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className={`font-semibold text-sm truncate ${isActive ? 'text-black' : 'text-gray-100'}`}>{u.name}</h4>
                      <span className={`text-xs ${isActive ? 'text-gray-500' : 'text-gray-400'}`}>{formatListTime(u.last_message_time)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className={`text-sm truncate ${isActive ? 'text-gray-600' : 'text-gray-400'}`}>
                        {u.last_message || 'No messages yet'}
                      </p>
                      {u.unread_count > 0 && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${isActive ? 'bg-[#c9a84c] text-white' : 'bg-[#c9a84c] text-[#241a00]'}`}>
                          {u.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col chat-main">
        {!selectedUser ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a conversation to start messaging
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="h-20 border-b border-[#404040] px-6 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-[#1b2b4b] flex items-center justify-center text-white font-medium text-lg border border-[#404040]">
                    {selectedUserData?.name?.substring(0, 2).toUpperCase() || 'U'}
                  </div>
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-[#323232] rounded-full"></div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-white">{selectedUserData?.name || 'User'}</h3>
                    <span className="bg-[#e7eefb] text-[#374668] text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1">
                      <span className="material-symbols-filled text-[12px] text-blue-500">verified</span> Verified
                    </span>
                  </div>
                  <p className="text-sm text-green-500 flex items-center gap-1">
                    Online <span className="text-gray-500">•</span> {selectedUserData?.user_type === 'lawyer' ? 'Corporate Law' : 'Client'}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                {['call', 'videocam', 'more_horiz', 'info'].map((icon, idx) => (
                  <button key={idx} className="w-10 h-10 rounded border border-[#404040] flex items-center justify-center text-gray-400 hover:bg-[#404040] hover:text-white transition-colors">
                    <span className="material-symbols-outlined">{icon}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Active Contract Banner */}
            <div className="px-6 py-4 border-b border-[#404040]">
              <div className="bg-white rounded-lg p-3 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#c9a84c]">description</span>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Active contract</p>
                    <p className="text-sm text-black font-semibold">Company Registration — Startup Legal Setup</p>
                  </div>
                </div>
                <button className="border border-gray-300 rounded px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">folder_open</span> Workspace
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              <div className="flex items-center gap-4 my-4">
                <div className="h-px bg-[#404040] flex-1"></div>
                <span className="text-xs text-gray-500 font-medium">Today</span>
                <div className="h-px bg-[#404040] flex-1"></div>
              </div>

              {loadingMessages ? (
                <div className="text-center text-gray-500">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-500 mt-10">Start the conversation!</div>
              ) : (
                messages.map((msg, index) => {
                  const isOwn = String(msg.sender_id) === String(currentUserId);
                  const showAvatar = !isOwn && (index === 0 || String(messages[index-1]?.sender_id) !== String(msg.sender_id));
                  
                  // Check if it's an attachment
                  const isAttachment = msg.content.startsWith('[Attachment:');
                  let textContent = msg.content;
                  let attachName = null;
                  let attachUrl = null;

                  if (isAttachment) {
                    const match = msg.content.match(/\[Attachment:\s*(.+?)\]\((.+?)\)/);
                    if (match) {
                      attachName = match[1];
                      attachUrl = match[2];
                      textContent = msg.content.replace(match[0], '').trim();
                    }
                  }

                  return (
                    <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start gap-3'}`}>
                      {!isOwn && (
                        <div className="w-8 shrink-0">
                          {showAvatar ? (
                            <div className="w-8 h-8 rounded-full bg-[#1b2b4b] flex items-center justify-center text-white text-xs border border-[#404040]">
                              {selectedUserData?.name?.substring(0, 2).toUpperCase() || 'U'}
                            </div>
                          ) : <div className="w-8 h-8"></div>}
                        </div>
                      )}
                      
                      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[70%]`}>
                        <div 
                          className={`px-5 py-3 rounded-2xl shadow-sm text-[15px] leading-relaxed
                            ${isOwn 
                              ? 'bg-[#182848] text-[#e2e8f0] rounded-tr-sm border border-[#23355b]' 
                              : 'bg-[#262626] text-gray-200 rounded-tl-sm border border-[#363636]'}`}
                        >
                          {attachUrl && (
                            <a href={attachUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 mb-2 p-2 bg-black/20 rounded border border-white/10 hover:bg-black/30 transition-colors">
                              <span className="material-symbols-outlined text-[#c9a84c]">attach_file</span>
                              <span className="text-sm font-medium underline-offset-2 hover:underline">{attachName}</span>
                            </a>
                          )}
                          <p className="whitespace-pre-wrap">{textContent}</p>
                        </div>
                        
                        <div className={`flex items-center gap-1 mt-1 text-[11px] text-gray-500 ${isOwn ? 'flex-row' : 'flex-row-reverse'}`}>
                          <span>{formatMessageTime(msg.timestamp || msg.created_at)}</span>
                          {isOwn && (
                            <span className={msg.is_read ? 'text-[#c9a84c]' : 'text-gray-500'}>
                              {msg.is_read ? '✓✓' : '✓'}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {isOwn && (
                        <div className="w-8 shrink-0 ml-3 flex justify-end">
                          <div className="w-8 h-8 rounded-full bg-teal-700 flex items-center justify-center text-white text-xs border border-teal-600">
                            ME
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              {typingUser && (
                <div className="text-gray-500 text-sm flex items-center gap-2 ml-11">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-75"></span>
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-150"></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 pt-2 border-t border-[#404040] bg-[#2d2d2d]">
              {/* Action chips */}
              <div className="flex gap-3 mb-4">
                {[
                  { icon: 'attach_file', label: 'Attach file', action: () => fileInputRef.current?.click() },
                  { icon: 'folder', label: 'Send case doc' },
                  { icon: 'event', label: 'Book appointment' },
                ].map((action, idx) => (
                  <button key={idx} onClick={action.action} className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-2 py-3 rounded-lg border border-[#444] bg-[#333] hover:bg-[#3d3d3d] transition-colors text-gray-300">
                    <span className="material-symbols-outlined">{action.icon}</span>
                    <span className="text-sm font-medium">{action.label}</span>
                  </button>
                ))}
              </div>

              {/* Text input */}
              <form onSubmit={handleSend} className="relative flex items-center">
                <input 
                  type="file" 
                  hidden 
                  ref={fileInputRef} 
                  onChange={e => setAttachment(e.target.files[0])} 
                  accept=".pdf,.doc,.docx,.jpg,.png" 
                />
                
                {attachment && (
                  <div className="absolute -top-12 left-0 bg-[#333] border border-[#444] rounded-lg px-4 py-2 flex items-center gap-3 shadow-lg z-10">
                    <span className="material-symbols-outlined text-[#c9a84c]">description</span>
                    <span className="text-sm text-gray-200">{attachment.name}</span>
                    <button type="button" onClick={() => setAttachment(null)} className="text-gray-400 hover:text-white ml-2">✖</button>
                  </div>
                )}
                
                <input 
                  type="text" 
                  value={newMessage}
                  onChange={handleTyping}
                  placeholder="Type a message..."
                  className="w-full bg-[#333] border border-[#444] rounded-lg py-4 pl-4 pr-16 text-gray-200 focus:outline-none focus:border-gray-400 placeholder-gray-500"
                />
                <button 
                  type="submit" 
                  disabled={(!newMessage.trim() && !attachment) || uploading}
                  className="absolute right-2 w-10 h-10 rounded bg-[#444] hover:bg-[#555] flex items-center justify-center text-gray-300 disabled:opacity-50 transition-colors"
                >
                  <span className="material-symbols-outlined">{uploading ? 'hourglass_empty' : 'send'}</span>
                </button>
              </form>
              
              <p className="text-center text-xs text-gray-400 mt-4">
                Messages are encrypted and visible only to you and your lawyer
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Chat;
