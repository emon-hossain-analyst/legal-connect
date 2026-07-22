import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase, isMissingFunctionError } from '../../services/supabase';
import { getSignedDocumentUrl } from '../../services/storage.service';
import { useAuth } from '../../context/AuthContext';
import useChatSocket from '../../hooks/useChatSocket';
import { SkeletonDashboard } from '../../components/Skeleton/Skeleton';
import Button from '../../components/Button/Button';
import styles from './Workspace.module.css';

const STATUS_COLORS = {
  pending: '#6B7280', in_progress: '#C8920A', completed: '#1E6B4A', blocked: '#DC2626',
};

const Workspace = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contract, setContract] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('milestones');
  const [newMilestone, setNewMilestone] = useState({ title: '', description: '', due_date: '' });
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fileInputRef = useRef(null);

  const { user } = useAuth();
  const userType = user?.user_type;
  const isLawyer = userType === 'lawyer';

  // Chat — workspace_id comes from contract
  const wsId = contract?.workspace_id || null;
  const { messages, isLoading: chatLoading, sendMessage, emitTyping, markRead } = useChatSocket(wsId);

  useEffect(() => {
    if (user?.id) {
      setCurrentUserId(user.id);
    }
  }, [user?.id]);

  const load = useCallback(async () => {
    try {
      const { data: contractData, error: contractErr } = await supabase
        .from('contracts')
        .select(`*, client:users!contracts_client_id_fkey(name), lawyer:users!contracts_lawyer_id_fkey(name), jobs(title)`)
        .eq('workspace_id', id)
        .single();
        
      if (contractErr) throw contractErr;

      const formattedContract = {
        ...contractData,
        client_name: contractData.client?.name,
        lawyer_name: contractData.lawyer?.name,
        job_title: contractData.jobs?.title
      };
      setContract(formattedContract);

      const { data: milestoneData } = await supabase
        .from('contract_milestones')
        .select('*')
        .eq('contract_id', contractData.id)
        .order('created_at', { ascending: true });
      setMilestones(milestoneData || []);

      const { data: docData } = await supabase
        .from('documents')
        .select('*')
        .eq('client_id', contractData.client_id)
        .eq('lawyer_id', contractData.lawyer_id);
      setDocuments(docData || []);
    } catch {
      toast.error('Contract not found or access denied');
      navigate('/client/dashboard');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (wsId) markRead(); }, [wsId, markRead]);

  const completedCount = milestones.filter((m) => m.status === 'completed').length;
  const realProgress = milestones.length ? Math.round((completedCount / milestones.length) * 100) : 0;

  // Animated progress bar: start at 0, animate to real value on mount
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const progressAnimated = useRef(false);
  useEffect(() => {
    if (!progressAnimated.current && realProgress > 0) {
      const timer = setTimeout(() => setAnimatedProgress(realProgress), 100);
      progressAnimated.current = true;
      return () => clearTimeout(timer);
    }
    setAnimatedProgress(realProgress);
  }, [realProgress]);

  const handleStatusChange = async (milestoneId, status) => {
    try {
      if (status === 'completed') {
        const { error: rpcError } = await supabase.rpc('fn_approve_milestone_and_release_funds', {
          p_milestone_id: milestoneId,
          p_client_id: contract?.client_id || user.id
        });
        if (rpcError) throw rpcError;
        toast.success('Milestone approved & escrow released atomically');
        load();
        return;
      }
      const { data, error } = await supabase
        .from('contract_milestones')
        .update({ status })
        .eq('id', milestoneId)
        .select()
        .single();
      if (error) throw error;
      setMilestones((prev) => prev.map((m) => m.id === milestoneId ? data : m));
      toast.success('Milestone updated');
    } catch (err) {
      toast.error(err.message || 'Failed to update milestone');
    }
  };

  const handleAddMilestone = async (e) => {
    e.preventDefault();
    if (!newMilestone.title.trim()) { toast.error('Title is required'); return; }
    try {
      const payload = {
        contract_id: contract.id,
        title: newMilestone.title,
        description: newMilestone.description,
        due_date: newMilestone.due_date || null,
        status: 'pending'
      };
      const { data, error } = await supabase.from('contract_milestones').insert([payload]).select().single();
      if (error) throw error;
      
      setMilestones((prev) => [...prev, data]);
      setNewMilestone({ title: '', description: '', due_date: '' });
      setShowMilestoneForm(false);
      toast.success('Milestone added');
    } catch (err) {
      toast.error(err.message || 'Failed to add milestone');
    }
  };

  const handleComplete = async () => {
    try {
      // Completion is gated server-side (sql/69): refuses to close while
      // milestones are open or a balance is outstanding, cascades the close,
      // notifies both parties, and requests a client review.
      const { data, error } = await supabase.rpc('fn_complete_contract', { p_contract_id: contract.id });

      if (error) {
        // Backward compatibility: if the gate RPC isn't deployed yet, fall
        // back to the legacy direct update so pre-migration behavior holds.
        if (isMissingFunctionError(error)) {
          const { error: legacyErr } = await supabase.from('contracts').update({ status: 'completed' }).eq('id', contract.id);
          if (legacyErr) throw legacyErr;
          toast.success('Contract marked as complete!');
          load();
          return;
        }
        throw error;
      }

      if (data && data.success === false && Array.isArray(data.blockers) && data.blockers.length > 0) {
        // Show exactly what's blocking completion (progressive disclosure).
        toast.error(`Can't complete yet:\n• ${data.blockers.join('\n• ')}`, { duration: 6000 });
        return;
      }

      toast.success(data?.already_completed ? 'Contract already complete.' : 'Contract marked as complete!');
      load();
    } catch (err) {
      toast.error(err.message || 'Failed to complete contract');
    }
  };

  const handleViewDocument = async (docId) => {
    try {
      const doc = documents.find(d => d.id === docId);
      if (doc && (doc.file_url || doc.storage_url)) {
        const url = await getSignedDocumentUrl(doc.file_url || doc.storage_url);
        if (url) {
          window.open(url, '_blank', 'noopener,noreferrer');
        } else {
          toast.error('Unable to open document. Please try again.');
        }
      } else {
        toast.error('Download URL not available');
      }
    } catch {
      toast.error('Failed to open document');
    }
  };

  const handleUploadDocument = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds 5MB limit.');
      return;
    }
    const allowed = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'txt', 'zip'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !allowed.includes(ext)) {
      toast.error(`Unsupported file format. Allowed: ${allowed.join(', ').toUpperCase()}`);
      return;
    }

    setUploadingDoc(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `workspace_docs/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);
        
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const newDoc = {
        client_id: contract.client_id,
        lawyer_id: contract.lawyer_id,
        file_name: file.name,
        file_type: file.type || fileExt,
        file_url: publicUrl,
        storage_url: publicUrl,
        uploaded_by: isLawyer ? contract.lawyer_name : contract.client_name,
        uploaded_at: new Date().toISOString()
      };

      const { data: insertedDoc, error: insertError } = await supabase
        .from('documents')
        .insert([newDoc])
        .select()
        .single();

      if (insertError) throw insertError;
      
      setDocuments(prev => [insertedDoc, ...prev]);
      toast.success('Document uploaded successfully');
    } catch (err) {
      toast.error('Failed to upload document');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const text = newMessage.trim();
    setNewMessage('');
    const result = await sendMessage(text);
    if (result && !result.success) {
      toast.error('Failed to send message');
      setNewMessage(text);
    }
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    const diff = (Date.now() - d) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className={styles.page}><SkeletonDashboard /></div>;
  if (!contract) return null;

  const otherParty = isLawyer
    ? { label: 'Client', name: contract.client_name }
    : { label: 'Lawyer', name: contract.lawyer_name };

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        {/* ── Left: Contract Summary ── */}
        <aside className={styles.summary}>
          <h2>Contract</h2>
          <div className={styles.summaryCard}>
            <p className={styles.jobTitle}>{contract.job_title}</p>
            <div className={styles.summaryRow}>
              <span>Agreed Fee</span>
              <strong>{contract.currency} {Number(contract.agreed_fee).toLocaleString()}</strong>
            </div>
            <div className={styles.summaryRow}>
              <span>Started</span>
              <strong>{new Date(contract.started_at).toLocaleDateString()}</strong>
            </div>
            <div className={styles.summaryRow}>
              <span>{otherParty.label}</span>
              <strong>{otherParty.name}</strong>
            </div>
            <div className={styles.summaryRow}>
              <span>Status</span>
              <span className={`${styles.contractStatus} ${styles[contract.status]}`}>
                {contract.status}
              </span>
            </div>
          </div>

          {!isLawyer && contract.status === 'active' && (
            <Button variant="primary" onClick={handleComplete} className={styles.completeBtn}>
              Mark Complete
            </Button>
          )}

          <button className={styles.backBtn} onClick={() => navigate(-1)}>← Back</button>
        </aside>

        {/* ── Center: Milestones / Documents ── */}
        <main className={styles.center}>
          <div className={styles.tabs}>
            <button className={tab === 'milestones' ? styles.activeTab : styles.tab}
              onClick={() => setTab('milestones')}>
              Milestones
            </button>
            <button className={tab === 'documents' ? styles.activeTab : styles.tab}
              onClick={() => setTab('documents')}>
              Documents ({documents.length})
            </button>
          </div>

          {tab === 'milestones' && (
            <>
              {/* Progress bar */}
              <div className={styles.progressSection}>
                <div className={styles.progressHeader}>
                  <span>Progress</span>
                  <span>{completedCount}/{milestones.length} completed</span>
                </div>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${animatedProgress}%`, transition: 'width 0.8s ease-out' }} />
                </div>
              </div>

              {milestones.length === 0 ? (
                <p className={styles.empty}>No milestones yet.</p>
              ) : (
                <ul className={styles.milestoneList}>
                  {milestones.map((m) => (
                    <li key={m.id} className={styles.milestoneItem}>
                      <div className={styles.milestoneLeft}>
                        <span className={styles.milestoneDot}
                          style={{ background: STATUS_COLORS[m.status] }} />
                        <div>
                          <p className={styles.milestoneTitle}>{m.title}</p>
                          {m.description && <p className={styles.milestoneDesc}>{m.description}</p>}
                          {m.due_date && (
                            <p className={styles.milestoneDue}>
                              Due: {new Date(m.due_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      {isLawyer && contract.status === 'active' ? (
                        <select
                          value={m.status}
                          onChange={(e) => handleStatusChange(m.id, e.target.value)}
                          className={styles.statusSelect}
                          style={{ borderColor: STATUS_COLORS[m.status] }}
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="blocked">Blocked</option>
                        </select>
                      ) : (
                        <span className={styles.statusBadge}
                          style={{ color: STATUS_COLORS[m.status] }}>
                          {m.status.replace('_', ' ')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {isLawyer && contract.status === 'active' && (
                <div className={styles.addMilestone}>
                  {showMilestoneForm ? (
                    <form onSubmit={handleAddMilestone} className={styles.milestoneForm}>
                      <input placeholder="Milestone title *" value={newMilestone.title}
                        onChange={(e) => setNewMilestone((f) => ({ ...f, title: e.target.value }))} />
                      <input placeholder="Description (optional)" value={newMilestone.description}
                        onChange={(e) => setNewMilestone((f) => ({ ...f, description: e.target.value }))} />
                      <input type="date" value={newMilestone.due_date}
                        onChange={(e) => setNewMilestone((f) => ({ ...f, due_date: e.target.value }))} />
                      <div className={styles.milestoneFormActions}>
                        <button type="submit" className={styles.addBtn}>Add</button>
                        <button type="button" className={styles.cancelMsBtn}
                          onClick={() => setShowMilestoneForm(false)}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <button className={styles.addMilestoneBtn}
                      onClick={() => setShowMilestoneForm(true)}>
                      + Add Milestone
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {tab === 'documents' && (
            <div className={styles.docsList}>
              <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>Shared Documents</h3>
                <input 
                  type="file" 
                  hidden 
                  ref={fileInputRef} 
                  onChange={handleUploadDocument} 
                />
                <Button 
                  variant="primary" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingDoc}
                >
                  {uploadingDoc ? 'Uploading...' : 'Upload Document'}
                </Button>
              </div>
              {documents.length === 0 ? (
                <p className={styles.empty}>No documents shared in this workspace.</p>
              ) : (
                documents.map((doc) => (
                  <div key={doc.id} className={styles.docItem}>
                    <span>📄</span>
                    <div style={{ flex: 1 }}>
                      <p className={styles.docName}>{doc.file_name || doc.name}</p>
                      <p className={styles.docMeta}>
                        {doc.uploaded_by || 'Unknown'} · {new Date(doc.uploaded_at || new Date()).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      className={styles.viewDocBtn}
                      onClick={() => handleViewDocument(doc.id)}
                      title="Open document"
                    >
                      View ↗
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </main>

        {/* ── Right: Chat ── */}
        <aside className={styles.chatPanel}>
          <h3 className={styles.chatTitle}>Workspace Chat</h3>
          <div className={styles.messages}>
            {chatLoading ? (
              <p className={styles.chatLoading}>Loading messages…</p>
            ) : messages.length === 0 ? (
              <p className={styles.chatEmpty}>No messages yet. Start the conversation!</p>
            ) : (
              messages.map((msg) => {
                const isOwn = String(msg.sender_id) === String(currentUserId);
                return (
                  <div key={msg.id} className={`${styles.msg} ${isOwn ? styles.ownMsg : ''}`}>
                    <div className={styles.msgBubble}>
                      <p>{msg.content}</p>
                      <span className={styles.msgTime}>{formatTime(msg.timestamp || msg.created_at)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <form onSubmit={handleSend} className={styles.chatForm}>
            <input
              value={newMessage}
              onChange={(e) => { setNewMessage(e.target.value); emitTyping(e.target.value.length > 0); }}
              placeholder="Type a message…"
              className={styles.chatInput}
            />
            <button type="submit" className={styles.sendBtn} disabled={!newMessage.trim()}>Send</button>
          </form>
        </aside>
      </div>
    </div>
  );
};

export default Workspace;
