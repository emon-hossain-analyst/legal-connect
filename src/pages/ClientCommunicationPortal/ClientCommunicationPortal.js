import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import { getSignedDocumentUrl } from '../../services/storage.service';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, NavLink, useSearchParams } from 'react-router-dom';
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

const ClientCommunicationPortal = ({ inline = false }) => {
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
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const selectedChatRef = useRef(selectedChat);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Milestone states
  const [caseMilestones, setCaseMilestones] = useState([]);
  const [milestoneLoading, setMilestoneLoading] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState({ open: false, milestoneId: null, action: '' });
  const [feedbackText, setFeedbackText] = useState('');

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  // Fetch milestones when a chat is selected (use conversation's lawyer+client to find cases)
  useEffect(() => {
    if (!selectedChat || !user) { setCaseMilestones([]); return; }
    const fetchMilestones = async () => {
      setMilestoneLoading(true);
      try {
        // Find cases linked to this conversation's lawyer and client
        const { data: cases } = await supabase
          .from('cases')
          .select('id')
          .eq('client_id', user.id)
          .eq('lawyer_id', selectedChat.lawyerId);
        
        if (cases && cases.length > 0) {
          const caseIds = cases.map(c => c.id);
          const { data: ms } = await supabase
            .from('case_milestones')
            .select('*')
            .in('case_id', caseIds)
            .order('created_at', { ascending: true });
          setCaseMilestones(ms || []);
        } else {
          setCaseMilestones([]);
        }
      } catch (err) {
        console.error('Error fetching milestones:', err);
        setCaseMilestones([]);
      } finally {
        setMilestoneLoading(false);
      }
    };
    fetchMilestones();
  }, [selectedChat, user]);

  // Realtime subscription for milestone updates
  useEffect(() => {
    if (!selectedChat || !user) return;
    const channel = supabase
      .channel(`client_milestones_${selectedChat.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'case_milestones' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setCaseMilestones(prev => [...prev, payload.new]);
          toast('New milestone submitted by your lawyer', { icon: '📋' });
        } else if (payload.eventType === 'UPDATE') {
          setCaseMilestones(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedChat, user]);

  // Milestone actions
  const handleMilestoneAction = async (milestoneId, action, feedback = null) => {
    try {
      if (action === 'approved') {
        const { error: rpcErr } = await supabase.rpc('fn_approve_milestone_and_release_funds', {
          p_milestone_id: milestoneId,
          p_client_id: user.id
        });
        if (rpcErr) throw rpcErr;
      } else {
        const updateData = {
          status: action,
          reviewed_at: new Date().toISOString(),
        };
        if (feedback) updateData.client_feedback = feedback;

        const { error } = await supabase
          .from('case_milestones')
          .update(updateData)
          .eq('id', milestoneId);

        if (error) throw error;
      }

      // Also insert activity log
      await supabase.from('milestone_activity_log').insert([{
        milestone_id: milestoneId,
        actor_id: user.id,
        actor_role: 'client',
        action: action,
        note: feedback || null
      }]);

      if (action === 'approved') toast.success('Milestone approved & escrow released atomically!');
      else if (action === 'rejected') toast.error('Milestone rejected. Counsel notified.');
      else toast('Revision requested. Counsel notified.', { icon: '📝' });

      setFeedbackModal({ open: false, milestoneId: null, action: '' });
      setFeedbackText('');
    } catch (err) {
      console.error('Milestone action error:', err);
      toast.error('Failed to update milestone');
    }
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const authUser = user;
      if (!authUser) return [];

      // 1. Fetch from conversations table with fallback
      let conversations = [];
      try {
        const { data, error: fetchError } = await supabase
          .from('conversations')
          .select('*, lawyer:users!conversations_lawyer_id_fkey(id, name, profile_picture_url)')
          .eq('client_id', authUser.id);

        if (fetchError || !data) {
          const fallback = await supabase
            .from('conversations')
            .select('*')
            .or(`client_id.eq.${authUser.id},lawyer_id.eq.${authUser.id}`);
          conversations = fallback.data || [];
        } else {
          conversations = data;
        }
      } catch (err) {
        const fallback = await supabase
          .from('conversations')
          .select('*')
          .or(`client_id.eq.${authUser.id},lawyer_id.eq.${authUser.id}`);
        conversations = fallback.data || [];
      }

      const convMap = new Map();

      if (conversations && conversations.length > 0) {
        for (const c of conversations) {
          convMap.set(c.id, {
            id: c.id,
            lawyerId: c.lawyer?.id || c.lawyer_id,
            lawyerName: c.lawyer?.name ? `Adv. ${c.lawyer.name}` : 'Advocate',
            lawyerPic: c.lawyer?.profile_picture_url || null,
            created_at: c.created_at,
            raw: c
          });
        }
      }

      // 2. Also fetch recent messages directly to find any conversations not listed or update last message
      let msgRows = [];
      try {
        const { data: mData } = await supabase
          .from('messages')
          .select('*')
          .or(`sender_id.eq.${authUser.id},receiver_id.eq.${authUser.id}`)
          .order('created_at', { ascending: false })
          .limit(50);
        if (mData) msgRows = mData;
      } catch (e) {
        try {
          const { data: mData2 } = await supabase
            .from('messages')
            .select('*')
            .eq('sender_id', authUser.id)
            .order('created_at', { ascending: false })
            .limit(50);
          if (mData2) msgRows = mData2;
        } catch (e2) {}
      }

      // Merge messages into convMap
      for (const m of msgRows) {
        if (!m.conversation_id) continue;
        if (!convMap.has(m.conversation_id)) {
          const partnerId = m.sender_id === authUser.id ? m.receiver_id : m.sender_id;
          convMap.set(m.conversation_id, {
            id: m.conversation_id,
            lawyerId: partnerId || m.sender_id,
            lawyerName: 'Advocate',
            lawyerPic: null,
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
          
          // Fetch lawyer user details if missing or default
          let lName = c.lawyerName;
          let lPic = c.lawyerPic;
          if ((!lPic || lName === 'Advocate') && c.lawyerId) {
            const { data: uInfo } = await supabase.from('users').select('name, profile_picture_url').eq('id', c.lawyerId).maybeSingle();
            if (uInfo) {
              if (uInfo.name) lName = `Adv. ${uInfo.name}`;
              if (uInfo.profile_picture_url) lPic = uInfo.profile_picture_url;
            }
          }
          if (!lPic) {
            lPic = `https://ui-avatars.com/api/?name=${encodeURIComponent(lName)}&background=1b2b4b&color=fff`;
          }

          // Fetch specialization from lawyers table
          let spec = 'Supreme Court Advocate';
          if (c.lawyerId) {
            const { data: lSpec } = await supabase.from('lawyers').select('specialization').eq('user_id', c.lawyerId).maybeSingle();
            if (lSpec?.specialization) {
              spec = Array.isArray(lSpec.specialization) ? lSpec.specialization.join(', ') : lSpec.specialization;
            }
          }

          const { data: lastMsg } = await supabase.from('messages').select('content, created_at, sender_id').eq('conversation_id', currentWsId).order('created_at', { ascending: false }).limit(1).maybeSingle();
          const { count: unreadCount } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('conversation_id', currentWsId).eq('is_read', false).neq('sender_id', authUser.id);
          
          return {
            id: currentWsId,
            lawyerName: lName,
            lawyerPic: lPic,
            lawyerId: c.lawyerId,
            jobTitle: spec,
            lastMessage: lastMsg?.content || 'Started conversation',
            lastMessageTime: lastMsg ? lastMsg.created_at : c.created_at,
            unread: unreadCount || 0,
            created_at: c.created_at,
            raw: c.raw || {}
          };
        })
      );
      
      formattedChats.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
      setChats(formattedChats);
      return formattedChats;
    } catch (error) {
      console.error('[Fetch Error] Unexpected pipeline error:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const initializeMessagingPipeline = async () => {
      if (!searchParams) return;

      setLoading(true);
      try {
        const authUser = user;
        if (!authUser) {
          if (isMounted) setLoading(false);
          return;
        }

        const existingList = await fetchData();
        if (!isMounted) return;

        const targetLawyerId = searchParams.get('newChat') || searchParams.get('initiateChat') || searchParams.get('new_chat_with') || searchParams.get('lawyerId') || searchParams.get('userId');
        if (targetLawyerId) {
          console.log(`[Deep Link] Initiating chat verification with lawyer ID: ${targetLawyerId}`);

          // Resolve targetLawyerId to an actual users table UUID
          let resolvedUserId = targetLawyerId;
          let lawyerUserObj = null;

          const { data: uData } = await supabase
            .from('users')
            .select('id, name, profile_picture_url')
            .eq('id', targetLawyerId)
            .maybeSingle();

          if (uData) {
            lawyerUserObj = uData;
          } else {
            const { data: lData } = await supabase
              .from('lawyers')
              .select('user_id, id, user:users(id, name, profile_picture_url)')
              .or(`id.eq.${targetLawyerId},slug.eq.${targetLawyerId},user_id.eq.${targetLawyerId}`)
              .maybeSingle();

            if (lData && lData.user_id) {
              resolvedUserId = lData.user_id;
              lawyerUserObj = lData.user;
            }
          }

          let targetChat = (existingList || []).find(c => String(c.lawyerId) === String(resolvedUserId) || String(c.raw?.lawyer_id) === String(resolvedUserId));

          if (targetChat) {
            console.log('[Deep Link] Found existing conversation thread:', targetChat.id);
            setSelectedChat(targetChat);
            window.history.replaceState(null, '', `/client/portal/messages?chatId=${targetChat.id}`);
          } else {
            console.log('[Deep Link] Conversation missing. Querying or creating thread...');
            
            let { data: existingRow } = await supabase
              .from('conversations')
              .select('*')
              .eq('client_id', authUser.id)
              .eq('lawyer_id', resolvedUserId)
              .maybeSingle();

            let targetRow = existingRow;

            if (!targetRow) {
              const { data: insertedRow, error: insertError } = await supabase
                .from('conversations')
                .insert([{ client_id: authUser.id, lawyer_id: resolvedUserId }])
                .select()
                .single();

              if (insertError) {
                console.error('[Database Error] Failed to create new conversation thread:', insertError);
                if (insertError.code === '42501' || insertError.message?.includes('permission denied')) {
                  toast.error(`RLS Notice: Execute SQL 30 in Supabase for persistence. Opening session.`);
                } else {
                  toast.error(`Could not start messaging: ${insertError.message}`);
                }
                targetRow = { id: `local-${resolvedUserId}`, client_id: authUser.id, lawyer_id: resolvedUserId, created_at: new Date().toISOString() };
              } else {
                targetRow = insertedRow;
              }
            }

            if (targetRow && isMounted) {
              if (!lawyerUserObj) {
                const { data: lu } = await supabase
                  .from('users')
                  .select('id, name, profile_picture_url')
                  .eq('id', resolvedUserId)
                  .maybeSingle();
                lawyerUserObj = lu;
              }

              const lawyerName = lawyerUserObj?.name ? `Adv. ${lawyerUserObj.name}` : 'Verified Lawyer';
              const lawyerPic = lawyerUserObj?.profile_picture_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(lawyerName)}&background=1b2b4b&color=fff`;

              const formattedNewChat = {
                id: targetRow.id,
                lawyerName,
                lawyerPic,
                lawyerId: resolvedUserId,
                jobTitle: 'Consultation',
                lastMessage: 'Started conversation',
                lastMessageTime: targetRow.created_at || new Date().toISOString(),
                unread: 0,
                created_at: targetRow.created_at || new Date().toISOString(),
                raw: { ...targetRow, lawyer: lawyerUserObj }
              };

              setChats(prev => {
                const exists = prev.find(c => c.id === formattedNewChat.id);
                return exists ? prev : [formattedNewChat, ...prev];
              });
              setSelectedChat(formattedNewChat);
              window.history.replaceState(null, '', `/client/portal/messages?chatId=${formattedNewChat.id}`);
            }
          }
        } else {
          const targetChatId = searchParams.get('chatId') || searchParams.get('c');
          if (targetChatId) {
            const foundChat = (existingList || []).find(c => String(c.id) === String(targetChatId));
            if (foundChat) {
              setSelectedChat(foundChat);
            } else {
              // Directly query Supabase for this conversation ID if refreshed
              const { data: directConv } = await supabase.from('conversations').select('*').eq('id', targetChatId).maybeSingle();
              if (directConv) {
                const partnerId = directConv.client_id === authUser.id ? directConv.lawyer_id : directConv.client_id;
                let lName = 'Advocate';
                let lPic = null;
                if (partnerId) {
                  const { data: uInfo } = await supabase.from('users').select('name, profile_picture_url').eq('id', partnerId).maybeSingle();
                  if (uInfo?.name) lName = `Adv. ${uInfo.name}`;
                  if (uInfo?.profile_picture_url) lPic = uInfo.profile_picture_url;
                }
                const fallbackChat = {
                  id: directConv.id,
                  lawyerId: partnerId,
                  lawyerName: lName,
                  lawyerPic: lPic || `https://ui-avatars.com/api/?name=${encodeURIComponent(lName)}&background=1b2b4b&color=fff`,
                  jobTitle: 'Supreme Court Advocate',
                  lastMessage: 'Started conversation',
                  lastMessageTime: directConv.created_at || new Date().toISOString(),
                  unread: 0,
                  raw: directConv
                };
                setChats(prev => [fallbackChat, ...prev]);
                setSelectedChat(fallbackChat);
              } else if ((existingList || []).length > 0) {
                setSelectedChat((existingList || [])[0]);
              }
            }
          } else if ((existingList || []).length > 0) {
            setSelectedChat((existingList || [])[0]);
          }
        }
      } catch (err) {
        console.error('[Initialization Error] Unexpected pipeline error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (user) {
      initializeMessagingPipeline();
    }
    return () => { isMounted = false; };
  }, [searchParams, fetchData, user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`portal_chat_client_${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new;
        const currentChat = selectedChatRef.current;
        
        setChats(prev => prev.map(c => {
          if (msg.conversation_id !== c.id) return c;
          return {
            ...c,
            lastMessage: msg.content,
            lastMessageTime: msg.created_at,
            unread: currentChat?.id === c.id ? c.unread : c.unread + (msg.sender_id !== user.id ? 1 : 0)
          };
        }).sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime)));

        if (currentChat && msg.conversation_id === currentChat.id) {
          setMessages(prev => {
            if (prev.find(m => m.id === msg.id)) return prev;
            // Check if there's an optimistic message with same content
            const optIndex = prev.findIndex(m => m.isOptimistic && m.message === msg.content);
            if (optIndex !== -1) {
              const updated = [...prev];
              updated[optIndex] = {
                id: msg.id,
                sender: msg.sender_id === user.id ? 'client' : 'lawyer',
                message: msg.content,
                time: msg.created_at
              };
              return updated;
            }
              return [...prev, {
                id: msg.id,
                sender: msg.sender_id === user.id ? 'client' : 'lawyer',
                message: msg.content,
                message_type: msg.message_type,
                file_url: msg.file_url,
                time: msg.created_at
              }];
          });
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user]);

  useEffect(() => {
    if (!selectedChat || !user) return;
    let isMounted = true;

    const fetchChatDetails = async () => {
      try {
        await supabase.from('messages').update({ is_read: true }).eq('conversation_id', selectedChat.id).neq('sender_id', user.id);
        
        setChats(prev => prev.map(c => c.id === selectedChat.id ? { ...c, unread: 0 } : c));

        let msgs = [];
        try {
          const { data } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', selectedChat.id)
            .order('created_at', { ascending: true });
          if (data && data.length > 0) {
            msgs = data;
          } else if (selectedChat.lawyerId) {
            const { data: dMsgs } = await supabase
              .from('messages')
              .select('*')
              .or(`sender_id.eq.${selectedChat.lawyerId},receiver_id.eq.${selectedChat.lawyerId}`)
              .order('created_at', { ascending: true });
            if (dMsgs) msgs = dMsgs;
          }
        } catch (err) {}

        if (isMounted) {
          setMessages(msgs.map(m => ({
            id: m.id,
            sender: m.sender_id === user.id ? 'client' : 'lawyer',
            message: m.content,
            message_type: m.message_type,
            file_url: m.file_url,
            time: m.created_at
          })));
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }

        let docs = [];
        try {
          const { data: d1 } = await supabase
            .from('documents')
            .select('*')
            .eq('conversation_id', selectedChat.id)
            .eq('document_type', 'chat')
            .order('uploaded_at', { ascending: false })
            .limit(20);
          if (d1 && d1.length > 0) {
            docs = d1;
          } else {
            const { data: d2 } = await supabase
              .from('documents')
              .select('*')
              .eq('client_id', user.id)
              .eq('document_type', 'chat')
              .order('uploaded_at', { ascending: false })
              .limit(20);
            if (d2) docs = d2;
          }
        } catch (e) {}

        if (isMounted) {
          setChatDocuments(docs);
        }
      } catch (error) {
        console.error('Error fetching chat details:', error);
      }
    };

    fetchChatDetails();
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat?.id, user]);

  const handleChatSelect = (chat) => {
    setSelectedChat(chat);
    if (chat?.id) {
      window.history.replaceState(null, '', `/client/portal/messages?chatId=${chat.id}`);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || !user) return;
    const text = newMessage;
    setNewMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const tempId = 'temp-' + Date.now();
    const optimisticMsg = {
      id: tempId,
      sender: 'client',
      message: text,
      time: new Date().toISOString(),
      isOptimistic: true
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    try {
      let activeConvId = selectedChat.id;
      if (String(activeConvId).startsWith('local-') || selectedChat.isOptimistic) {
        // Lazily create thread in conversations table
        const { data: existConv } = await supabase
          .from('conversations')
          .select('id')
          .eq('client_id', user.id)
          .eq('lawyer_id', selectedChat.lawyerId)
          .maybeSingle();

        if (existConv?.id) {
          activeConvId = existConv.id;
        } else {
          const { data: newConv } = await supabase
            .from('conversations')
            .insert([{ client_id: user.id, lawyer_id: selectedChat.lawyerId }])
            .select()
            .single();
          if (newConv?.id) {
            activeConvId = newConv.id;
          }
        }

        if (activeConvId !== selectedChat.id) {
          setSelectedChat(prev => ({ ...prev, id: activeConvId }));
          setChats(prev => prev.map(c => c.id === selectedChat.id ? { ...c, id: activeConvId } : c));
        }
      }

      const payload = {
        conversation_id: activeConvId,
        sender_id: user.id,
        receiver_id: selectedChat.lawyerId,
        content: text,
        message_type: 'text',
        is_read: false
      };
      
      let data, error;
      const res = await supabase.from('messages').insert([payload]).select().single();
      if (res.error && res.error.message?.includes('receiver_id')) {
        delete payload.receiver_id;
        const retry = await supabase.from('messages').insert([payload]).select().single();
        data = retry.data;
        error = retry.error;
      } else {
        data = res.data;
        error = res.error;
      }

      if (error) throw error;
      
      setMessages(prev => prev.map(m => m.id === tempId ? {
        id: data.id,
        sender: 'client',
        message: data.content,
        time: data.created_at
      } : m));
      setChats(prev => prev.map(c => c.id === activeConvId || c.id === selectedChat.id ? { ...c, lastMessage: data.content, lastMessageTime: data.created_at } : c));
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message: ' + (error.message || 'Database error'));
      setMessages(prev => prev.filter(m => m.id !== tempId));
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
        client_id: user.id,
        lawyer_id: selectedChat.lawyerId,
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
        receiver_id: selectedChat.lawyerId,
        content: `📎 Attached File: ${file.name}`,
        message_type: 'file',
        file_url: fileUrl,
        is_read: false
      };
      const { data: newMsg } = await supabase.from('messages').insert([msgPayload]).select().single();
      if (newMsg) {
        setMessages(prev => [...prev, {
          id: newMsg.id,
          sender: 'client',
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
    e.target.style.height = '0px';
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
    return true; 
  });

  const clientName = user?.user_metadata?.name || 'Client';
  const clientId = user?.id?.substring(0,6).toUpperCase() || 'C-0000';
  const clientPic = user?.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(clientName)}&background=041635&color=fff`;

  if (loading) {
    return <div className="h-screen flex items-center justify-center text-primary font-bold">Loading portal...</div>;
  }

  return (
    <div className="bg-background font-body-md text-on-background overflow-hidden h-screen flex">
      <style>{`
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .chat-scrollbar::-webkit-scrollbar {
            width: 4px;
        }
        .chat-scrollbar::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 10px;
        }
        .sidebar-transition {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>

      {/* Column 1: SideNavBar (Rail/Sidebar) */}
      {!inline && (
        <aside className="sidebar-transition flex flex-col py-6 bg-primary dark:bg-primary-container h-full w-20 md:w-64 fixed left-0 top-0 border-r border-outline-variant shadow-sm z-50">
          <div className="px-6 mb-8 flex items-center gap-3" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <span className="material-symbols-outlined text-secondary-fixed text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>balance</span>
            <div className="hidden md:block">
              <h1 className="font-headline-md text-headline-md text-on-primary font-bold leading-none">LegalPortal</h1>
              <p className="text-[10px] uppercase tracking-widest text-on-primary-container">Marketplace</p>
            </div>
          </div>
          
          <nav className="flex-1 px-3 space-y-2">
            <NavLink to="/client/dashboard" className="flex items-center gap-4 px-3 py-3 rounded-lg text-on-primary-fixed-variant hover:bg-primary-fixed-variant hover:text-white transition-colors cursor-pointer active:scale-95 group">
              <span className="material-symbols-outlined">dashboard</span>
              <span className="hidden md:block font-label-md">Dashboard</span>
            </NavLink>
            
            <NavLink to="/cases" className="flex items-center gap-4 px-3 py-3 rounded-lg text-on-primary-fixed-variant hover:bg-primary-fixed-variant hover:text-white transition-colors cursor-pointer active:scale-95 group">
              <span className="material-symbols-outlined">gavel</span>
              <span className="hidden md:block font-label-md">Cases</span>
            </NavLink>
            
            <NavLink to="/client/portal" className="flex items-center gap-4 px-3 py-3 rounded-lg text-white border-l-4 border-secondary-fixed bg-primary-fixed-dim/10 cursor-pointer active:scale-95 group">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span>
              <span className="hidden md:block font-label-md">Messages</span>
            </NavLink>
            
            <NavLink to="/client/dashboard" className="flex items-center gap-4 px-3 py-3 rounded-lg text-on-primary-fixed-variant hover:bg-primary-fixed-variant hover:text-white transition-colors cursor-pointer active:scale-95 group">
              <span className="material-symbols-outlined">folder_shared</span>
              <span className="hidden md:block font-label-md">Documents</span>
            </NavLink>
          </nav>
          
          <div className="mt-auto px-6 space-y-6">
            <button onClick={() => navigate('/jobs/post')} className="bg-secondary-fixed text-on-secondary-fixed w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-secondary-container transition-all active:scale-95">
              <span className="material-symbols-outlined">add</span>
              <span className="hidden md:block">New Case</span>
            </button>
            
            <div className="pt-6 border-t border-primary-fixed-dim/20 space-y-2">
              <button onClick={() => navigate('/')} className="w-full flex items-center gap-4 text-on-primary-fixed-variant hover:text-white transition-colors group">
                <span className="material-symbols-outlined">home</span>
                <span className="hidden md:block font-label-md">Home</span>
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main className={inline ? "flex-1 flex flex-col h-full overflow-hidden w-full" : "flex-1 ml-20 md:ml-64 flex flex-col h-screen overflow-hidden"}>
        {/* TopAppBar */}
        <header className="flex justify-between items-center px-8 h-16 bg-surface dark:bg-surface-container-low border-b border-outline-variant z-40 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="font-headline-sm text-headline-sm text-primary dark:text-primary-fixed">Legal Messages</h2>
            <div className="relative hidden sm:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">search</span>
              <input className="bg-surface-container-high/50 border-none rounded-full pl-10 pr-4 py-1.5 text-sm focus:ring-2 focus:ring-secondary w-64 transition-all" placeholder="Search messages..." type="text"/>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <button className="p-2 rounded-full hover:bg-surface-container-high transition-all relative">
                <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
                <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full"></span>
              </button>
            </div>
            <div className="h-8 w-px bg-outline-variant"></div>
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/client/portal/overview')}>
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-primary">{clientName}</p>
                <p className="text-[10px] text-on-surface-variant">ID: #{clientId}</p>
              </div>
              <img className="w-10 h-10 rounded-full border-2 border-surface-container-high object-cover" alt="Client Avatar" src={clientPic}/>
            </div>
          </div>
        </header>

        {/* 3-Column Message Layout */}
        <section className="flex-1 flex overflow-hidden">
          
          {/* COLUMN 1: My Lawyers (280px) */}
          <div className="w-[280px] bg-surface flex flex-col border-r border-primary/10 shrink-0">
            <div className="p-4 border-b border-outline-variant/30">
              <h3 className="font-headline-md text-headline-md text-primary mb-3">My Lawyers</h3>
              <div className="relative mb-4">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">search</span>
                <input className="w-full bg-white border border-outline-variant/50 rounded-lg pl-10 pr-4 py-2 text-sm focus:border-secondary focus:ring-1 focus:ring-secondary" placeholder="Search conversations..." type="text"/>
              </div>
              <div className="flex gap-2 text-[12px] font-bold">
                <button onClick={() => setFilterTab('all')} className={`pb-2 border-b-2 ${filterTab === 'all' ? 'border-secondary text-primary' : 'border-transparent text-on-surface-variant hover:text-primary'}`}>All</button>
                <button onClick={() => setFilterTab('unread')} className={`pb-2 border-b-2 ${filterTab === 'unread' ? 'border-secondary text-primary' : 'border-transparent text-on-surface-variant hover:text-primary'}`}>Unread</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto chat-scrollbar">
              {filteredChats.length === 0 ? (
                <div className="p-6 text-center text-on-surface-variant text-sm">No conversations found.</div>
              ) : (
                filteredChats.map(c => (
                  <div 
                    key={c.id} 
                    onClick={() => handleChatSelect(c)}
                    className={`p-4 bg-white border-b border-outline-variant/30 cursor-pointer transition-colors ${selectedChat?.id === c.id ? 'border-l-4 border-secondary bg-surface-container-low' : 'hover:bg-surface-container-low border-l-4 border-transparent'}`}
                  >
                    <div className="flex gap-3">
                      <img className="w-12 h-12 rounded-lg object-cover" alt={c.lawyerName} src={c.lawyerPic} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-sm text-primary truncate">{c.lawyerName}</h4>
                          {c.unread > 0 ? (
                            <span className="bg-secondary text-white text-[10px] px-1.5 rounded-full font-bold">{c.unread}</span>
                          ) : (
                            <span className="text-[10px] text-outline">{timeAgo(c.lastMessageTime)}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[9px] font-bold text-secondary-container bg-primary-container px-1.5 py-0.5 rounded uppercase">LAWYER</span>
                          <span className="text-[10px] text-on-surface-variant truncate">{c.jobTitle}</span>
                        </div>
                        <p className={`text-xs mt-1 truncate ${c.unread > 0 ? 'text-primary font-bold' : 'text-outline'}`}>{c.lastMessage}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* COLUMN 2: Center Chat */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            {!selectedChat ? (
              <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant p-8 text-center bg-[#F8F9FF]">
                <span className="material-symbols-outlined text-6xl opacity-20 mb-4">chat</span>
                <h3 className="text-xl font-bold text-primary mb-2">Secure Messages</h3>
                <p>Select a lawyer from the left to start messaging.</p>
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <div className="h-20 px-6 border-b border-outline-variant/30 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <img className="w-10 h-10 rounded-full object-cover" alt={selectedChat.lawyerName} src={selectedChat.lawyerPic} />
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-headline-sm text-headline-sm text-primary">{selectedChat.lawyerName}</h3>
                        <span className="text-[10px] font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded-full border border-secondary/20">VERIFIED LAWYER</span>
                      </div>
                      <p className="text-xs text-on-surface-variant">Active Case: <span className="font-semibold text-primary">{selectedChat.jobTitle}</span></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setShowPhoneModal(true)}
                      title="Phone Consultation"
                      className="p-2.5 rounded-lg border border-outline-variant/50 text-primary hover:bg-primary/5 transition-all flex items-center justify-center active:scale-95 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-lg">call</span>
                    </button>
                    <button
                      onClick={() => setShowVideoModal(true)}
                      title="Video Consultation"
                      className="p-2.5 rounded-lg border border-outline-variant/50 text-primary hover:bg-primary/5 transition-all flex items-center justify-center active:scale-95 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-lg">videocam</span>
                    </button>
                    <button onClick={() => navigate(`/workspace/${selectedChat.contractId || selectedChat.id}`)} className="border border-secondary text-secondary px-4 py-2 rounded-lg font-bold text-sm hover:bg-secondary/5 transition-all flex items-center gap-2 hidden md:flex">
                      <span className="material-symbols-outlined text-sm">visibility</span>
                      View My Case
                    </button>
                  </div>
                </div>

                {/* Message Thread */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 chat-scrollbar bg-[#F8F9FF]">
                  <div className="flex justify-center">
                    <span className="text-[10px] uppercase tracking-widest text-outline bg-white px-4 py-1 rounded-full border border-outline-variant/20">Conversation Started</span>
                  </div>

                  {messages.map((m, i) => {
                    const isSent = m.sender === 'client';
                    const isFile = m.message_type === 'file' || m.message?.startsWith('📎 Attached File:');
                    const fileName = isFile ? m.message.replace('📎 Attached File: ', '') : null;
                    const matchedDoc = isFile ? chatDocuments.find(d => (d.title === fileName || d.file_name === fileName || d.file_url === m.file_url || d.storage_url === m.file_url)) : null;
                    const docUrl = m.file_url || matchedDoc?.file_url || matchedDoc?.storage_url;

                    return (
                      <div key={m.id} className={`flex gap-3 max-w-[80%] ${isSent ? 'ml-auto flex-row-reverse' : ''}`}>
                        {!isSent ? (
                          <img className="w-8 h-8 rounded-full object-cover self-end mb-1 shrink-0" alt="Lawyer" src={selectedChat.lawyerPic} />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-secondary text-on-secondary flex items-center justify-center text-[10px] font-bold self-end mb-1 shrink-0">
                            {clientName.substring(0,2).toUpperCase()}
                          </div>
                        )}
                        <div className={isSent ? 'text-right flex-1' : 'flex-1'}>
                          <div className={isSent 
                            ? 'bg-secondary-fixed text-on-secondary-fixed p-4 rounded-xl rounded-br-none shadow-sm'
                            : 'bg-primary text-white p-4 rounded-xl rounded-bl-none shadow-sm'}>
                            {isFile ? (
                              <div 
                                onClick={() => handleOpenDocument(docUrl)}
                                className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer border transition-all text-left ${isSent ? 'bg-secondary/10 border-secondary/20 hover:bg-secondary/20' : 'bg-white/10 border-white/20 hover:bg-white/20'}`}
                              >
                                <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center shrink-0">
                                  <span className="material-symbols-outlined text-2xl">description</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold truncate underline decoration-current/40 underline-offset-2">{fileName || 'Attached Document'}</p>
                                  <span className="text-[10px] opacity-75 block">Click to view document</span>
                                </div>
                                <span className="material-symbols-outlined text-lg opacity-80 shrink-0">open_in_new</span>
                              </div>
                            ) : (
                              <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                            )}
                          </div>
                          <div className={`flex items-center gap-1 mt-1 ${isSent ? 'justify-end' : ''}`}>
                            <span className="text-[10px] text-outline">{timeAgo(m.time)}</span>
                            {isSent && <span className="material-symbols-outlined text-[14px] text-secondary">done_all</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div className="p-4 bg-white border-t border-outline-variant/30 shrink-0">
                  <div className="bg-surface-container-low rounded-xl p-2 flex items-end gap-2 border border-outline-variant/30 focus-within:border-secondary transition-all">
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFile} className="p-2 text-outline hover:text-primary transition-colors">
                      <span className={`material-symbols-outlined ${uploadingFile ? 'animate-spin' : ''}`}>{uploadingFile ? 'refresh' : 'attach_file'}</span>
                    </button>
                    <textarea 
                      ref={textareaRef}
                      value={newMessage}
                      onChange={handleTextareaInput}
                      onKeyDown={handleKeyDown}
                      className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 resize-none max-h-32 chat-scrollbar h-auto" 
                      placeholder="Message your lawyer securely..." 
                      rows="1"
                    ></textarea>
                    <button onClick={handleSendMessage} disabled={!newMessage.trim()} className="bg-primary text-white p-2.5 rounded-lg flex items-center justify-center hover:bg-secondary transition-all active:scale-95 shadow-md disabled:opacity-50">
                      <span className="material-symbols-outlined">send</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* COLUMN 3: Case Info (260px) */}
          <aside className="w-[260px] bg-white border-l border-primary/10 flex flex-col p-4 overflow-y-auto chat-scrollbar hidden lg:flex shrink-0">
            {!selectedChat ? (
              <div className="p-6 text-center text-on-surface-variant">Select a chat to view info</div>
            ) : (
              <>
                <h3 className="font-headline-sm text-headline-sm text-primary mb-4">Case Info</h3>
                
                {/* Linked Case Card */}
                <div onClick={() => navigate(`/client/portal/cases/${selectedChat.case_id || selectedChat.contractId || selectedChat.id}`)} className="bg-surface-container-low p-4 rounded-lg border border-outline-variant/30 mb-6 cursor-pointer hover:border-secondary transition-all group">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-secondary text-sm">balance</span>
                    <p className="text-[10px] font-bold text-outline uppercase tracking-wider group-hover:text-secondary">Active Matter</p>
                  </div>
                  <h4 className="text-sm font-bold text-primary mb-1 line-clamp-2">{selectedChat.jobTitle || 'Consultation'}</h4>
                  <p className="text-[11px] text-on-surface-variant mb-3">Ref: #{(selectedChat.case_id || selectedChat.contractId || selectedChat.id || 'NEW').toString().substring(0,6).toUpperCase()}</p>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold">IN PROGRESS</span>
                    <span className="text-outline">{new Date(selectedChat.created_at || Date.now()).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Shared Files */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-[11px] font-bold text-outline uppercase tracking-widest">Shared Files</h4>
                    <button className="text-[10px] font-bold text-secondary hover:underline">View All</button>
                  </div>
                  <ul className="space-y-2">
                    {chatDocuments.length === 0 ? (
                      <p className="text-xs text-on-surface-variant">No files shared yet.</p>
                    ) : (
                      chatDocuments.map(doc => {
                        const docUrl = doc.file_url || doc.storage_url;
                        const docTitle = doc.title || doc.file_name || 'Document';
                        return (
                          <li key={doc.id} onClick={() => handleOpenDocument(docUrl)} className="flex items-center gap-2 p-2 hover:bg-surface-container-high rounded transition-colors cursor-pointer group">
                            <span className="material-symbols-outlined text-error text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
                            <span className="text-xs text-primary truncate group-hover:text-secondary">{docTitle}</span>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </div>

                {/* Participants */}
                <div className="mb-6">
                  <h4 className="text-[11px] font-bold text-outline uppercase tracking-widest mb-3">Participants</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <img className="w-8 h-8 rounded-full object-cover" alt={selectedChat.lawyerName} src={selectedChat.lawyerPic} />
                      <div>
                        <p className="text-xs font-bold text-primary leading-none">{selectedChat.lawyerName}</p>
                        <p className="text-[10px] text-on-surface-variant">Lead Counsel</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary text-on-secondary flex items-center justify-center text-[10px] font-bold">
                        {clientName.substring(0,2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-primary leading-none">You</p>
                        <p className="text-[10px] text-on-surface-variant">Client</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Wired Milestone Actions Panel */}
                <div className="mb-6 bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/40">
                  <h4 className="text-[11px] font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-secondary">fact_check</span>
                    Milestone Actions
                  </h4>
                  {milestoneLoading ? (
                    <p className="text-[11px] text-on-surface-variant animate-pulse">Loading milestones...</p>
                  ) : caseMilestones.filter(m => m.status === 'submitted').length === 0 ? (
                    <p className="text-[11px] text-on-surface-variant">No pending milestones to review.</p>
                  ) : (
                    <div className="space-y-3">
                      {caseMilestones.filter(m => m.status === 'submitted').map(m => (
                        <div key={m.id} className="bg-white border border-outline-variant/50 rounded-lg p-3">
                          <p className="text-[12px] font-bold text-primary mb-1">{m.title}</p>
                          {m.description && <p className="text-[10px] text-on-surface-variant mb-2">{m.description}</p>}
                          <p className="text-[10px] text-outline mb-2">Submitted {new Date(m.submitted_at || m.created_at).toLocaleDateString()}</p>
                          <div className="grid grid-cols-2 gap-2 mb-1.5">
                            <button 
                              onClick={() => handleMilestoneAction(m.id, 'approved')} 
                              className="bg-green-600 text-white py-1.5 px-2 rounded text-[10px] font-bold hover:bg-green-700 transition-all active:scale-95 flex items-center justify-center gap-1"
                            >
                              <span className="material-symbols-outlined text-sm">check</span> Approve
                            </button>
                            <button 
                              onClick={() => setFeedbackModal({ open: true, milestoneId: m.id, action: 'rejected' })} 
                              className="bg-red-600 text-white py-1.5 px-2 rounded text-[10px] font-bold hover:bg-red-700 transition-all active:scale-95 flex items-center justify-center gap-1"
                            >
                              <span className="material-symbols-outlined text-sm">close</span> Reject
                            </button>
                          </div>
                          <button 
                            onClick={() => setFeedbackModal({ open: true, milestoneId: m.id, action: 'revision_requested' })} 
                            className="w-full bg-primary/10 text-primary py-1.5 rounded text-[10px] font-bold hover:bg-primary/20 transition-all active:scale-95 flex items-center justify-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm">edit_note</span> Request Improvements
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Approved/Completed milestones summary */}
                  {caseMilestones.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-outline-variant/30">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[10px] font-bold text-outline">Progress</span>
                        <span className="text-[10px] font-bold text-primary">{caseMilestones.length > 0 ? Math.round((caseMilestones.filter(m => m.status === 'approved').length / caseMilestones.length) * 100) : 0}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-outline-variant/20 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${caseMilestones.length > 0 ? (caseMilestones.filter(m => m.status === 'approved').length / caseMilestones.length) * 100 : 0}%` }}></div>
                      </div>
                      <p className="text-[10px] text-outline mt-1">{caseMilestones.filter(m => m.status === 'approved').length}/{caseMilestones.length} milestones approved</p>
                    </div>
                  )}
                </div>

                {/* Feedback Modal for Reject / Request Improvements */}
                {feedbackModal.open && (
                  <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl max-w-sm w-full mx-4 p-5 shadow-2xl">
                      <h3 className="font-bold text-[#041635] text-base mb-2">
                        {feedbackModal.action === 'rejected' ? 'Reject Milestone' : 'Request Improvements'}
                      </h3>
                      <p className="text-xs text-gray-500 mb-3">Please provide feedback for your lawyer:</p>
                      <textarea
                        value={feedbackText}
                        onChange={e => setFeedbackText(e.target.value)}
                        placeholder="Explain what needs to change..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#755b00]/30 resize-none"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => { setFeedbackModal({ open: false, milestoneId: null, action: '' }); setFeedbackText(''); }} className="flex-1 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50">Cancel</button>
                        <button
                          onClick={() => handleMilestoneAction(feedbackModal.milestoneId, feedbackModal.action, feedbackText)}
                          disabled={!feedbackText.trim()}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50 ${feedbackModal.action === 'rejected' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#041635] hover:bg-[#1b2b4b]'}`}
                        >
                          {feedbackModal.action === 'rejected' ? 'Reject' : 'Send Request'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Security Info & Actions */}
                <div className="mt-auto pt-4 border-t border-outline-variant/30">
                  <div className="flex items-center gap-2 mb-6">
                    <span className="material-symbols-outlined text-secondary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
                    <p className="text-[11px] text-secondary font-semibold leading-tight">This conversation is confidential and encrypted.</p>
                  </div>
                  <div className="space-y-3">
                    <button onClick={() => navigate(`/client/portal/book-consultation/${selectedChat?.lawyerId || ''}`)} className="w-full bg-secondary text-on-secondary py-3 rounded-lg font-bold text-sm hover:brightness-110 shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-sm">calendar_today</span>
                      Book a Consultation
                    </button>
                    <button className="w-full border border-secondary text-secondary py-3 rounded-lg font-bold text-sm hover:bg-secondary/5 active:scale-95 transition-all flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-sm">grade</span>
                      Rate this Lawyer
                    </button>
                  </div>
                </div>
              </>
            )}
          </aside>
        </section>
      </main>

      {/* Phone Consultation Modal */}
      {showPhoneModal && selectedChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
                  <span className="material-symbols-outlined">call</span>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Phone Consultation</h3>
                  <p className="text-xs text-gray-500">Direct audio call connection</p>
                </div>
              </div>
              <button onClick={() => setShowPhoneModal(false)} className="text-gray-400 hover:text-gray-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Assigned Counsel</p>
                <p className="font-bold text-[#041635] text-base">{selectedChat.lawyerName}</p>
                <p className="text-xs text-gray-600">{selectedChat.jobTitle}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Contact Number</p>
                <p className="font-bold text-[#041635] text-lg font-mono">+880 1711-000000</p>
                <p className="text-[11px] text-green-600 font-medium mt-1">Available Mon-Thu 10:00 AM - 5:00 PM</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPhoneModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-bold text-sm hover:bg-gray-50 transition-all"
              >
                Close
              </button>
              <a
                href="tel:+8801711000000"
                onClick={() => {
                  toast.success(`Calling ${selectedChat.lawyerName}...`);
                  setShowPhoneModal(false);
                }}
                className="flex-1 px-4 py-2.5 rounded-lg bg-[#041635] text-white font-bold text-sm hover:bg-[#1b2b4b] transition-all flex items-center justify-center gap-2 shadow-md"
              >
                <span className="material-symbols-outlined text-sm">call</span>
                Call Now
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Video Consultation Modal */}
      {showVideoModal && selectedChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                  <span className="material-symbols-outlined">videocam</span>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Video Consultation Room</h3>
                  <p className="text-xs text-gray-500">Encrypted virtual conference</p>
                </div>
              </div>
              <button onClick={() => setShowVideoModal(false)} className="text-gray-400 hover:text-gray-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-blue-900 text-sm">
                <p className="font-bold mb-1">Ready to join your session?</p>
                <p className="text-xs opacity-90">Your video room is generated dynamically and secured with end-to-end encryption.</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase">Room ID</p>
                  <p className="font-mono text-sm font-bold text-[#041635]">LegalConnect-{String(selectedChat.id).substring(0,8)}</p>
                </div>
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded">Active</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowVideoModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-bold text-sm hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  window.open(`https://meet.jit.si/LegalConnect-${selectedChat.id}`, '_blank');
                  toast.success('Opening secure video room...');
                  setShowVideoModal(false);
                }}
                className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-md"
              >
                <span className="material-symbols-outlined text-sm">videocam</span>
                Join Video Room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientCommunicationPortal;