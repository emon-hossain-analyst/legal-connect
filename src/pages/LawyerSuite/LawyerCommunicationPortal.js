import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import { getSignedDocumentUrl } from '../../services/storage.service';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

const timeAgo = (date) => {
  if (!date) return '';
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 86400) {
    const hours = new Date(date).getHours();
    const minutes = new Date(date).getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hrs12 = hours % 12 || 12;
    return `${hrs12}:${minutes} ${ampm}`;
  }
  if (s < 172800) return 'Yesterday';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const LawyerCommunicationPortal = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [filterTab, setFilterTab] = useState('all');
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatDocuments, setChatDocuments] = useState([]);
  
  // Fix 4: Create Contract overlay state
  const [linkedContract, setLinkedContract] = useState(null);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [contractTitle, setContractTitle] = useState('');
  const [contractScope, setContractScope] = useState('');
  const [contractFee, setContractFee] = useState('');
  const [hasMilestones, setHasMilestones] = useState(true);
  const [submittingContract, setSubmittingContract] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      if (!user?.id) return [];

      // Check if lawyer has a profile ID in lawyers table
      const { data: lProfile } = await supabase
        .from('lawyers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      const lawyerProfileId = lProfile?.id;

      let filterQuery = `lawyer_id.eq.${user.id},client_id.eq.${user.id}`;
      if (lawyerProfileId) {
        filterQuery += `,lawyer_id.eq.${lawyerProfileId}`;
      }

      // 1. Fetch from conversations table
      let conversations = [];
      try {
        const { data } = await supabase
          .from('conversations')
          .select('*')
          .or(filterQuery);
        if (data && data.length > 0) {
          conversations = data;
        } else {
          const { data: d1 } = await supabase.from('conversations').select('*').eq('lawyer_id', user.id);
          let combined = d1 || [];
          if (lawyerProfileId) {
            const { data: d2 } = await supabase.from('conversations').select('*').eq('lawyer_id', lawyerProfileId);
            if (d2) combined = [...combined, ...d2];
          }
          conversations = combined;
        }
      } catch (err) {
        try {
          const { data: d1 } = await supabase.from('conversations').select('*').eq('lawyer_id', user.id);
          conversations = d1 || [];
        } catch (e) {}
      }

      // 2. Also fetch recent messages directly
      let msgRows = [];
      try {
        let msgFilter = `sender_id.eq.${user.id},receiver_id.eq.${user.id}`;
        if (lawyerProfileId) msgFilter += `,sender_id.eq.${lawyerProfileId},receiver_id.eq.${lawyerProfileId}`;
        const { data: mData } = await supabase
          .from('messages')
          .select('*')
          .or(msgFilter)
          .order('created_at', { ascending: false })
          .limit(50);
        if (mData && mData.length > 0) {
          msgRows = mData;
        } else {
          const { data: m1 } = await supabase.from('messages').select('*').eq('receiver_id', user.id).limit(50);
          msgRows = m1 || [];
        }
      } catch (err) {
        try {
          const { data: m1 } = await supabase.from('messages').select('*').eq('receiver_id', user.id).limit(50);
          msgRows = m1 || [];
        } catch (e) {}
      }

      const convMap = new Map();
      for (const c of conversations) {
        convMap.set(c.id, {
          id: c.id,
          clientId: c.client_id === user.id || c.client_id === lawyerProfileId ? c.lawyer_id : c.client_id,
          created_at: c.created_at,
          raw: c
        });
      }

      for (const m of msgRows) {
        if (!m.conversation_id) continue;
        if (!convMap.has(m.conversation_id)) {
          const partnerId = (m.sender_id === user.id || m.sender_id === lawyerProfileId) ? m.receiver_id : m.sender_id;
          convMap.set(m.conversation_id, {
            id: m.conversation_id,
            clientId: partnerId,
            created_at: m.created_at
          });
        }
      }

      const rawChats = Array.from(convMap.values());
      if (rawChats.length === 0) {
        setChats([]);
        return [];
      }

      const formattedChats = await Promise.all(
        rawChats.map(async (c) => {
          const currentWsId = c.id;
          let chatName = 'Client';
          let clientPic = null;
          let cId = c.clientId;

          if (cId) {
            const { data: uInfo } = await supabase.from('users').select('id, name, profile_picture_url').eq('id', cId).maybeSingle();
            if (uInfo) {
              if (uInfo.name) chatName = uInfo.name;
              if (uInfo.profile_picture_url) clientPic = uInfo.profile_picture_url;
            }
          }

          if (!clientPic) {
            clientPic = `https://ui-avatars.com/api/?name=${encodeURIComponent(chatName)}&background=e2e9f5&color=041635`;
          }

          const { data: lastMsg } = await supabase.from('messages').select('content, created_at').eq('conversation_id', currentWsId).order('created_at', { ascending: false }).limit(1).maybeSingle();
          const { count: unreadCount } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('conversation_id', currentWsId).eq('is_read', false).neq('sender_id', user.id);

          return {
            id: currentWsId,
            clientName: chatName,
            clientPic,
            clientId: cId,
            contractId: c.raw?.contract_id || currentWsId,
            jobTitle: 'Consultation',
            lastMessage: lastMsg?.content || 'Started conversation',
            lastMessageTime: lastMsg?.created_at || c.created_at,
            unread: unreadCount || 0,
          };
        })
      );

      formattedChats.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
      setChats(formattedChats);
      return formattedChats;
    } catch (error) {
      console.error('Error fetching data:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const initializePipeline = async () => {
      if (!user?.id) return;
      const existingList = await fetchData();
      if (!isMounted) return;

      const targetClientId = searchParams.get('clientId') || searchParams.get('userId') || searchParams.get('newChat') || searchParams.get('initiateChat') || searchParams.get('new_chat_with');
      if (targetClientId) {
        let targetChat = (existingList || []).find(c => String(c.clientId) === String(targetClientId));
        if (targetChat) {
          handleChatSelect(targetChat);
          window.history.replaceState(null, '', `/lawyer-suite/communication?chatId=${targetChat.id}`);
        } else {
          let { data: existingRow } = await supabase
            .from('conversations')
            .select('*')
            .eq('lawyer_id', user.id)
            .eq('client_id', targetClientId)
            .maybeSingle();

          let targetRow = existingRow;
          if (!targetRow) {
            const { data: insertedRow } = await supabase
              .from('conversations')
              .insert([{ lawyer_id: user.id, client_id: targetClientId }])
              .select()
              .single();
            targetRow = insertedRow || { id: `local-${targetClientId}`, lawyer_id: user.id, client_id: targetClientId, created_at: new Date().toISOString() };
          }

          if (targetRow && isMounted) {
            const { data: cu } = await supabase
              .from('users')
              .select('id, name, profile_picture_url')
              .eq('id', targetClientId)
              .maybeSingle();

            const clientName = cu?.name || 'Client';
            const clientPic = cu?.profile_picture_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(clientName)}&background=e2e9f5&color=041635`;

            const formattedNewChat = {
              id: targetRow.id,
              clientName,
              clientPic,
              clientId: targetClientId,
              contractId: targetRow.id,
              jobTitle: 'Consultation',
              lastMessage: 'Started conversation',
              lastMessageTime: targetRow.created_at || new Date().toISOString(),
              unread: 0,
            };

            setChats(prev => {
              const exists = prev.find(c => c.id === formattedNewChat.id);
              return exists ? prev : [formattedNewChat, ...prev];
            });
            handleChatSelect(formattedNewChat);
            window.history.replaceState(null, '', `/lawyer-suite/communication?chatId=${formattedNewChat.id}`);
          }
        }
      } else {
        const targetChatId = searchParams.get('chatId') || searchParams.get('c');
        if (targetChatId && existingList?.length > 0) {
          const found = existingList.find(c => String(c.id) === String(targetChatId));
          if (found) handleChatSelect(found);
          else handleChatSelect(existingList[0]);
        } else if (existingList?.length > 0 && !selectedChat) {
          handleChatSelect(existingList[0]);
        }
      }
    };

    initializePipeline();
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, fetchData]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`portal_chat_lawyer_${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new;
        
        setChats(prev => {
          const exists = prev.some(c => c.id === msg.conversation_id);
          if (!exists) {
            fetchData();
            return prev;
          }
          return prev.map(c => {
            if (msg.conversation_id !== c.id) return c;
            return {
              ...c,
              lastMessage: msg.content,
              lastMessageTime: msg.created_at,
              unread: selectedChat?.id === c.id ? c.unread : c.unread + (msg.sender_id !== user.id ? 1 : 0)
            };
          }).sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
        });

        if (selectedChat && msg.conversation_id === selectedChat.id) {
          setMessages(prev => {
            if (prev.find(m => m.id === msg.id)) return prev;
            return [...prev, {
              id: msg.id,
              sender: msg.sender_id === user.id ? 'lawyer' : 'client',
              message: msg.content,
              message_type: msg.message_type,
              file_url: msg.file_url,
              time: msg.created_at
            }];
          });
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, () => {
        fetchData();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, selectedChat, fetchData]);

  const handleChatSelect = async (chat) => {
    setSelectedChat(chat);
    if (!user) return;
    try {
      // Mark as read
      await supabase.from('messages').update({ is_read: true }).eq('conversation_id', chat.id).neq('sender_id', user.id);
      
      setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unread: 0 } : c));

      // Fetch messages
      let msgs = [];
      try {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', chat.id)
          .order('created_at', { ascending: true });
        if (data && data.length > 0) {
          msgs = data;
        } else if (chat.clientId) {
          const { data: dMsgs } = await supabase
            .from('messages')
            .select('*')
            .or(`sender_id.eq.${chat.clientId},receiver_id.eq.${chat.clientId}`)
            .order('created_at', { ascending: true });
          if (dMsgs) msgs = dMsgs;
        }
      } catch (err) {}
      
      setMessages(msgs.map(m => ({
        id: m.id,
        sender: m.sender_id === user.id ? 'lawyer' : 'client',
        message: m.content,
        message_type: m.message_type,
        file_url: m.file_url,
        time: m.created_at
      })));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

      // Fetch specific documents for this chat
      let docs = [];
      try {
        const { data: d1 } = await supabase
          .from('documents')
          .select('*')
          .eq('conversation_id', chat.id)
          .eq('document_type', 'chat')
          .order('uploaded_at', { ascending: false })
          .limit(20);
        if (d1 && d1.length > 0) {
          docs = d1;
        } else {
          const { data: d2 } = await supabase
            .from('documents')
            .select('*')
            .eq('client_id', chat.clientId)
            .eq('document_type', 'chat')
            .order('uploaded_at', { ascending: false })
            .limit(20);
          if (d2) docs = d2;
        }
      } catch (e) {}

      setChatDocuments(docs);

      let cData = null;
      try {
        if (chat.contractId && typeof chat.contractId === 'string' && chat.contractId.length > 10) {
          const { data } = await supabase.from('contracts').select('*').eq('id', chat.contractId).maybeSingle();
          if (data) cData = data;
        }
        if (!cData && chat.clientId) {
          const { data } = await supabase.from('contracts').select('*').eq('lawyer_id', user.id).eq('client_id', chat.clientId).order('created_at', { ascending: false }).maybeSingle();
          if (data) cData = data;
        }
      } catch (e) {}
      setLinkedContract(cData);

    } catch (error) {
      console.error('Error fetching chat details:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || !user) return;
    try {
      const text = newMessage;
      setNewMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = '40px';
      }
      
      const payload = {
        conversation_id: selectedChat.id,
        sender_id: user.id,
        receiver_id: selectedChat.clientId,
        content: text,
        message_type: 'text',
        is_read: false
      };
      
      const { data, error } = await supabase.from('messages').insert([payload]).select().single();
      if (error) throw error;
      
      setMessages(prev => {
        if (prev.find(m => m.id === data.id)) return prev;
        return [...prev, {
          id: data.id,
          sender: 'lawyer',
          message: data.content,
          time: data.created_at
        }];
      });
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat || !user) return;
    setUploadingFile(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
      const filePath = `chat_attachments/${fileName}`;

      let fileUrl = filePath;
      try {
        await supabase.storage.from('documents').upload(filePath, file);
        const { data: pubData } = supabase.storage.from('documents').getPublicUrl(filePath);
        if (pubData?.publicUrl) fileUrl = pubData.publicUrl;
      } catch (err) {}

      const docPayload = {
        client_id: selectedChat.clientId,
        lawyer_id: user.id,
        conversation_id: selectedChat.id,
        document_type: 'chat',
        title: file.name,
        file_url: fileUrl
      };
      const { data: newDoc } = await supabase.from('documents').insert([docPayload]).select().single();
      setChatDocuments(prev => [newDoc || docPayload, ...prev]);

      const msgPayload = {
        conversation_id: selectedChat.id,
        sender_id: user.id,
        receiver_id: selectedChat.clientId,
        content: `📎 Attached File: ${file.name}`,
        message_type: 'file',
        file_url: fileUrl,
        is_read: false
      };
      const { data: newMsg } = await supabase.from('messages').insert([msgPayload]).select().single();
      if (newMsg) {
        setMessages(prev => [...prev, {
          id: newMsg.id,
          sender: 'lawyer',
          message: newMsg.content,
          message_type: 'file',
          file_url: fileUrl,
          time: newMsg.created_at
        }]);
      }
      toast.success('File attached and sent successfully!');
    } catch (err) {
      console.error('Error attaching file:', err);
      toast.error('Failed to attach file');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleOpenDocument = async (docUrl) => {
    if (!docUrl) {
      toast.error('File document link is processing or unavailable');
      return;
    }
    const signedUrl = await getSignedDocumentUrl(docUrl);
    if (signedUrl) {
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } else {
      toast.error('Unable to open document. Please try again.');
    }
  };

  const handleTextareaInput = (e) => {
    setNewMessage(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const filteredChats = chats.filter(c => {
    if (filterTab === 'unread') return c.unread > 0;
    return true; // 'all' and 'archived' not fully implemented logic
  });

  // Fixed contract schema mapping
  const handleCreateContract = async (e) => {
    e.preventDefault();
    if (!contractTitle.trim() || !contractFee || Number(contractFee) <= 0) {
      toast.error('Please fill in title and valid fee amount');
      return;
    }
    setSubmittingContract(true);
    try {
      const numAmt = Number(contractFee);
      const payload = {
        lawyer_id: user.id,
        client_id: selectedChat.clientId,
        title: contractTitle.trim(),
        terms: contractScope.trim() || 'Standard legal representation terms.',
        amount: numAmt,
        agreed_fee: numAmt,
        agreed_amount: numAmt,
        outstanding_balance: numAmt,
        fee_structure: hasMilestones ? 'Milestone-based' : 'Fixed Fee',
        payment_schedule: hasMilestones ? 'Per Milestone' : '100% Upfront',
        status: 'Pending Review',
        fee_locked: false
      };
      const { data: newC, error } = await supabase.from('contracts').insert([payload]).select().single();
      if (error) throw error;
      setLinkedContract(newC);
      toast.success('Contract sent to client for review');
      setContractModalOpen(false);
      setContractTitle('');
      setContractScope('');
      setContractFee('');
    } catch (err) {
      console.error('Create contract error:', err);
      toast.error(err.message || 'Failed to create contract');
    } finally {
      setSubmittingContract(false);
    }
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center text-primary font-bold">Loading messages...</div>;
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex overflow-hidden bg-background font-body-md text-on-background">
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .chat-bubble-received {
            position: relative;
            border-left: 4px solid #ffe08f;
        }
        .chat-bubble-sent {
            background-color: rgba(255, 224, 143, 0.08);
            border: 1px solid rgba(255, 224, 143, 0.2);
        }
      `}</style>

      {/* COLUMN 1: Conversation List */}
      <section className="w-full md:w-[280px] border-r border-outline-variant flex flex-col bg-white shrink-0 absolute md:static z-20 h-full transition-transform" style={{ transform: selectedChat ? 'translateX(-100%)' : 'translateX(0)' }}>
        <div className="p-4 space-y-4 border-b border-outline-variant/30">
          <div className="flex items-center justify-between">
            <h2 className="font-headline-md text-headline-md text-primary">Messages</h2>
            <button className="bg-secondary-fixed text-on-secondary-fixed p-2 rounded-lg hover:bg-secondary transition-all active:scale-95 shadow-sm">
              <span className="material-symbols-outlined">edit_square</span>
            </button>
          </div>
          <div className="flex gap-1 bg-surface-container rounded-lg p-1">
            <button onClick={() => setFilterTab('all')} className={`flex-1 text-label-md py-1.5 rounded-md ${filterTab === 'all' ? 'bg-white shadow-sm text-primary font-semibold' : 'text-on-surface-variant hover:bg-white/50'}`}>All</button>
            <button onClick={() => setFilterTab('unread')} className={`flex-1 text-label-md py-1.5 rounded-md ${filterTab === 'unread' ? 'bg-white shadow-sm text-primary font-semibold' : 'text-on-surface-variant hover:bg-white/50'}`}>Unread</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-20 md:pb-0">
          {filteredChats.length === 0 ? (
            <div className="p-6 text-center text-on-surface-variant text-sm">No conversations found.</div>
          ) : (
            filteredChats.map(c => (
              <div 
                key={c.id} 
                onClick={() => handleChatSelect(c)}
                className={`p-4 cursor-pointer border-b border-outline-variant/10 transition-colors ${selectedChat?.id === c.id ? 'border-l-4 border-secondary-fixed bg-secondary-fixed/5' : 'hover:bg-surface border-l-4 border-transparent'}`}
              >
                <div className="flex gap-3">
                  <div className="relative shrink-0">
                    <img className="w-12 h-12 rounded-full object-cover" src={c.clientPic} alt={c.clientName} />
                    {c.unread === 0 && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="text-body-md font-bold text-primary truncate">{c.clientName}</h3>
                      {c.unread > 0 ? (
                        <span className="bg-secondary-fixed text-on-secondary-fixed text-[10px] font-bold px-1.5 py-0.5 rounded-full">{c.unread}</span>
                      ) : (
                        <span className="text-[10px] text-on-surface-variant">{timeAgo(c.lastMessageTime)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-secondary-fixed/20 text-secondary px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tighter">CLIENT</span>
                      <span className="text-[10px] text-on-surface-variant font-medium">#{(c.contractId || c.id || 'N/A').toString().substring(0,6).toUpperCase()}</span>
                    </div>
                    <p className={`text-body-sm truncate ${c.unread > 0 ? 'text-primary font-bold' : 'text-on-surface-variant'}`}>{c.lastMessage}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* COLUMN 2: Active Chat Thread */}
      <section className={`flex-1 flex flex-col h-full relative overflow-hidden bg-surface z-10 w-full ${!selectedChat ? 'hidden md:flex' : 'flex'}`}>
        {!selectedChat ? (
          <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant p-8 text-center">
            <span className="material-symbols-outlined text-6xl opacity-20 mb-4">forum</span>
            <h3 className="text-xl font-bold text-primary mb-2">Your Conversations</h3>
            <p>Select a chat from the left to start messaging.</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <header className="h-16 px-4 md:px-6 border-b border-outline-variant/30 flex items-center justify-between bg-white/80 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-3 md:gap-4">
                <button className="md:hidden p-1 mr-1 text-on-surface-variant" onClick={() => setSelectedChat(null)}>
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <img className="w-10 h-10 rounded-full object-cover hidden sm:block" src={selectedChat.clientPic} alt="Client" />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-headline-sm font-bold text-primary truncate max-w-[150px] md:max-w-xs">{selectedChat.clientName}</h2>
                    <span className="bg-secondary-fixed/20 text-secondary px-2 py-0.5 rounded text-[10px] font-bold uppercase hidden sm:inline-block">CLIENT</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="text-[11px] text-on-surface-variant font-medium truncate">{selectedChat.jobTitle}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 md:gap-3">
                <button onClick={() => navigate(`/workspace/${selectedChat.contractId}`)} className="hidden md:block border border-secondary-fixed text-on-secondary-container px-4 py-1.5 rounded text-label-md font-bold hover:bg-secondary-fixed/10 transition-colors">
                  View Case File
                </button>
                <button onClick={() => { window.open(`https://meet.jit.si/LegalConnect-${selectedChat.id}`, '_blank'); toast.success('Joining Jitsi Video Room...'); }} title="Join Video Call" className="p-2 text-primary hover:bg-surface-container-high rounded-full transition-all flex items-center gap-1">
                  <span className="material-symbols-outlined">videocam</span>
                </button>
                <button onClick={() => toast('Calling client phone...', { icon: '📞' })} title="Phone Call" className="p-2 text-primary hover:bg-surface-container-high rounded-full transition-all hidden sm:flex items-center gap-1">
                  <span className="material-symbols-outlined">call</span>
                </button>
                <button className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded-full transition-all lg:hidden">
                  <span className="material-symbols-outlined">info</span>
                </button>
              </div>
            </header>

            {/* Chat Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              <div className="flex items-center justify-center gap-4 py-2">
                <div className="h-[1px] flex-1 bg-outline-variant/40"></div>
                <span className="text-label-md text-on-surface-variant font-medium uppercase tracking-widest">Conversation Started</span>
                <div className="h-[1px] flex-1 bg-outline-variant/40"></div>
              </div>

              {messages.map((m, i) => {
                const isSent = m.sender === 'lawyer';
                const isFile = m.message_type === 'file' || m.message?.startsWith('📎 Attached File:');
                const fileName = isFile ? m.message.replace('📎 Attached File: ', '') : null;
                const matchedDoc = isFile ? chatDocuments.find(d => (d.title === fileName || d.file_name === fileName || d.file_url === m.file_url || d.storage_url === m.file_url)) : null;
                const docUrl = m.file_url || matchedDoc?.file_url || matchedDoc?.storage_url;

                return (
                  <div key={m.id} className={`flex w-full ${isSent ? 'justify-end' : 'justify-start'}`}>
                    <div className={isSent ? 'bg-indigo-600 text-white rounded-l-lg rounded-tr-lg p-3 max-w-[70%] shadow-sm' : 'bg-slate-900 text-white rounded-r-lg rounded-tl-lg p-3 max-w-[70%] shadow-sm'}>
                      {isFile ? (
                        <div 
                          onClick={() => handleOpenDocument(docUrl)}
                          className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer border transition-all ${isSent ? 'bg-indigo-700/60 border-indigo-400/30 hover:bg-indigo-700' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}
                        >
                          <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-2xl">description</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate underline decoration-white/40 underline-offset-2">{fileName || 'Attached Document'}</p>
                            <span className="text-[10px] opacity-75 block">Click to view document</span>
                          </div>
                          <span className="material-symbols-outlined text-lg opacity-80 shrink-0">open_in_new</span>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.message}</p>
                      )}
                      <span className={`block text-[10px] mt-1.5 ${isSent ? 'text-indigo-200 text-right' : 'text-slate-400 text-left'}`}>{timeAgo(m.time)}</span>
                    </div>
                  </div>
                );
              })}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Sticky Input Bar */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 shrink-0 z-20">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-end gap-2 md:gap-3 bg-surface-container rounded-xl p-2 border border-outline-variant/10 focus-within:border-secondary transition-all">
                  <button className="p-2 text-on-surface-variant hover:text-primary transition-colors hidden sm:block">
                    <span className="material-symbols-outlined">add_circle</span>
                  </button>
                  <textarea 
                    ref={textareaRef}
                    value={newMessage}
                    onChange={handleTextareaInput}
                    onKeyDown={handleKeyDown}
                    className="flex-1 bg-transparent border-none focus:ring-0 resize-none py-2 text-body-md h-[40px] max-h-[120px] scrollbar-hide" 
                    placeholder="Type your message..." 
                    rows="1"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFile} className="p-2 text-on-surface-variant hover:text-primary transition-colors hidden sm:block">
                      <span className={`material-symbols-outlined ${uploadingFile ? 'animate-spin' : ''}`}>{uploadingFile ? 'refresh' : 'attach_file'}</span>
                    </button>
                    <button onClick={handleSendMessage} disabled={!newMessage.trim()} className="bg-primary text-white p-2 rounded-lg hover:bg-primary-container transition-all shadow-md ml-1 disabled:opacity-50">
                      <span className="material-symbols-outlined">send</span>
                    </button>
                  </div>
                </div>
                <div className="hidden md:flex items-center justify-center gap-1.5 mt-2 opacity-60">
                  <span className="material-symbols-outlined text-[14px]">lock</span>
                  <span className="text-[10px] font-medium uppercase tracking-widest">End-to-end encrypted</span>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* COLUMN 3: Conversation Info Panel */}
      <section className="w-80 flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto h-full hidden lg:flex flex-col">
        {!selectedChat ? (
          <div className="p-6 text-center text-on-surface-variant">Select a chat to see details</div>
        ) : (
          <>
            <div className="p-6 border-b border-outline-variant/30">
              <h2 className="font-headline-sm text-headline-sm text-primary mb-1">Conversation Info</h2>
              <p className="text-[11px] text-on-surface-variant font-medium">Active Session</p>
            </div>
            
            {/* Linked Case Details */}
            <div className="p-5">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-3">Linked Case</p>
              <div onClick={() => navigate(`/lawyer-suite/cases/${selectedChat.case_id || selectedChat.contractId || selectedChat.id}`)} className="bg-surface rounded-xl border border-outline-variant/30 p-4 shadow-sm hover:border-secondary-fixed transition-all cursor-pointer">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-body-md font-bold text-primary leading-tight line-clamp-2">{selectedChat.jobTitle}</h4>
                  <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ml-2">ACTIVE</span>
                </div>
                <p className="text-body-sm text-on-surface-variant mb-3">Ref: #{(selectedChat.case_id || selectedChat.contractId || selectedChat.id || 'N/A').toString().substring(0,6).toUpperCase()}</p>
                <div className="text-label-md text-secondary font-bold flex items-center gap-1 hover:underline">
                  Open Case File <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                </div>
              </div>
            </div>

            {/* Fix 4: Contract Agreement Section */}
            <div className="px-5 pb-3">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-3">Service Contract</p>
              {linkedContract ? (
                <div className="bg-[#f8fafc] rounded-xl border border-[#e2e8f0] p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-body-md font-bold text-[#041635] leading-tight line-clamp-1">{linkedContract.title || 'Legal Agreement'}</h4>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${linkedContract.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                      {linkedContract.status}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-[#0F2A5E] mb-2">
                    Fee: BDT {Number(linkedContract.agreed_fee || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <button onClick={() => navigate('/lawyer-suite/contracts')} className="text-xs text-secondary font-bold hover:underline">
                    Manage Contract Details →
                  </button>
                </div>
              ) : (
                <div className="bg-[#fffbeb] rounded-xl border border-[#fde68a] p-4 text-center">
                  <p className="text-xs text-gray-700 mb-3">No contract agreement has been issued for this consultation session yet.</p>
                  <button 
                    onClick={() => {
                      setContractTitle(`Legal Representation - ${selectedChat.clientName}`);
                      setContractScope(`Legal consultation and representation services regarding ${selectedChat.jobTitle || 'matter'}.`);
                      setContractFee('');
                      setContractModalOpen(true);
                    }}
                    className="w-full py-2.5 px-4 bg-[#d97706] hover:bg-[#b45309] text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">draw</span> Create Contract
                  </button>
                </div>
              )}
            </div>

            {/* Shared Files List */}
            <div className="px-5 py-2">
              <div className="flex justify-between items-center mb-4">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Shared Files</p>
                <button className="text-[10px] font-bold text-secondary uppercase hover:underline">View All</button>
              </div>
              <div className="space-y-3">
                {chatDocuments.length === 0 ? (
                  <p className="text-xs text-on-surface-variant">No files shared yet.</p>
                ) : (
                  chatDocuments.map(doc => {
                    const docUrl = doc.file_url || doc.storage_url;
                    const docTitle = doc.title || doc.file_name || 'Document';
                    return (
                      <div key={doc.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer group" onClick={() => handleOpenDocument(docUrl)}>
                        <div className="w-8 h-8 bg-error/10 text-error flex items-center justify-center rounded shrink-0">
                          <span className="material-symbols-outlined text-[18px]">description</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-primary truncate group-hover:text-secondary">{docTitle}</p>
                          <p className="text-[10px] text-on-surface-variant">{timeAgo(doc.uploaded_at || doc.created_at)}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Participants */}
            <div className="px-5 py-6">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-4">Participants</p>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-container text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {user?.user_metadata?.name?.charAt(0) || 'L'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-primary truncate">{user?.user_metadata?.name || 'You'}</p>
                    <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-tighter">LAWYER</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <img className="w-8 h-8 rounded-full object-cover shrink-0" src={selectedChat.clientPic} alt={selectedChat.clientName} />
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-primary truncate">{selectedChat.clientName}</p>
                    <span className="text-[10px] text-secondary font-bold uppercase tracking-tighter">CLIENT</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Panel Actions */}
            <div className="mt-auto p-5 border-t border-outline-variant/30 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-body-sm font-semibold text-primary">Mark as Confidential</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-10 h-5 bg-outline-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-secondary-fixed"></div>
                </label>
              </div>
              <button onClick={() => navigate('/lawyer-suite/schedule/availability')} className="w-full border-2 border-secondary-fixed text-on-secondary-container py-2.5 rounded-lg text-label-md font-bold hover:bg-secondary-fixed transition-colors flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[18px]">calendar_add_on</span>
                Schedule Consultation
              </button>
            </div>
          </>
        )}
      </section>

      {/* Fix 4: Slide-over overlay modal for Create Contract */}
      {contractModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-sm flex justify-end animate-fadeIn">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-[#041635] text-white">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-400">gavel</span>
                  <h3 className="font-bold text-lg">Create Legal Contract</h3>
                </div>
                <button onClick={() => setContractModalOpen(false)} className="text-gray-300 hover:text-white">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <form onSubmit={handleCreateContract} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Client Name (Read-Only)</label>
                  <input type="text" readOnly value={selectedChat?.clientName || ''} className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded text-sm font-bold text-gray-700 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Linked Case Ref</label>
                  <input type="text" readOnly value={selectedChat?.jobTitle || `Ref #${(selectedChat?.id || '').toString().substring(0,8)}`} className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded text-sm font-semibold text-gray-600 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#041635] uppercase mb-1">Contract Title *</label>
                  <input type="text" required value={contractTitle} onChange={e => setContractTitle(e.target.value)} placeholder="e.g., Retainer Agreement for Corporate Litigation" className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-[#041635] focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#041635] uppercase mb-1">Scope of Work</label>
                  <textarea rows="4" value={contractScope} onChange={e => setContractScope(e.target.value)} placeholder="Detail the representation services, advice, and deliverables..." className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-[#041635] focus:outline-none"></textarea>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#041635] uppercase mb-1">Agreed Fee (BDT) *</label>
                  <input type="number" required min="1" step="any" value={contractFee} onChange={e => setContractFee(e.target.value)} placeholder="e.g., 25000" className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-bold focus:border-[#041635] focus:outline-none" />
                </div>
                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer bg-gray-50 p-3 rounded border border-gray-200">
                    <input type="checkbox" checked={hasMilestones} onChange={e => setHasMilestones(e.target.checked)} className="rounded text-[#041635] focus:ring-0" />
                    <span className="text-xs font-bold text-gray-700">Enable Milestone Payment Structure</span>
                  </label>
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setContractModalOpen(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded text-sm font-bold hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={submittingContract} className="flex-1 py-2.5 bg-[#041635] text-white rounded text-sm font-bold hover:bg-[#1B2B4B] disabled:opacity-50">
                    {submittingContract ? 'Sending...' : 'Send Contract'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LawyerCommunicationPortal;
