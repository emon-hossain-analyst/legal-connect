-- =============================================================================
-- Phase 9: Row Level Security (RLS) Policies
-- =============================================================================

-- Enable RLS on all tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'departments', 'lawyers', 'lawyer_departments', 'jobs', 'job_proposals', 
    'contracts', 'contract_milestones', 'transactions', 'disputes', 'appointments', 
    'cases', 'case_progress', 'messages', 'documents', 'feedback', 'notifications', 
    'legal_updates', 'contact_inquiries', 'ai_chat_sessions', 'ai_chat_messages'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END;
$$;

-- 1. Users
CREATE POLICY "Users viewable by everyone" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users update own data" ON public.users FOR UPDATE USING (auth.uid() = id OR public.is_admin());

-- 2. Departments
CREATE POLICY "Departments viewable by everyone" ON public.departments FOR SELECT USING (true);
CREATE POLICY "Departments managed by admins" ON public.departments USING (public.is_admin());

-- 3. Lawyers
CREATE POLICY "Lawyers viewable by everyone" ON public.lawyers FOR SELECT USING (true);
CREATE POLICY "Lawyers update own profile" ON public.lawyers FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Lawyers insert own profile" ON public.lawyers FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- 4. Lawyer Departments
CREATE POLICY "Lawyer departments viewable by everyone" ON public.lawyer_departments FOR SELECT USING (true);
CREATE POLICY "Lawyers manage own departments" ON public.lawyer_departments USING (auth.uid() = lawyer_id OR public.is_admin());

-- 5. Jobs
CREATE POLICY "Jobs viewable by everyone" ON public.jobs FOR SELECT USING (true);
CREATE POLICY "Clients insert own jobs" ON public.jobs FOR INSERT WITH CHECK (auth.uid() = client_id OR public.is_admin());
CREATE POLICY "Clients update own jobs" ON public.jobs FOR UPDATE USING (auth.uid() = client_id OR public.is_admin());
CREATE POLICY "Clients delete own jobs" ON public.jobs FOR DELETE USING (auth.uid() = client_id OR public.is_admin());

-- 6. Job Proposals
CREATE POLICY "Proposals viewable by participants" ON public.job_proposals FOR SELECT USING (
  auth.uid() = lawyer_id OR public.is_admin() OR 
  EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.client_id = auth.uid())
);
CREATE POLICY "Lawyers insert own proposals" ON public.job_proposals FOR INSERT WITH CHECK (auth.uid() = lawyer_id OR public.is_admin());
CREATE POLICY "Lawyers update own proposals" ON public.job_proposals FOR UPDATE USING (auth.uid() = lawyer_id OR public.is_admin());

-- 7. Contracts & Milestones
CREATE POLICY "View own contracts" ON public.contracts FOR SELECT USING (auth.uid() = client_id OR auth.uid() = lawyer_id OR public.is_admin());
CREATE POLICY "Insert own contracts" ON public.contracts FOR INSERT WITH CHECK (auth.uid() = client_id OR auth.uid() = lawyer_id OR public.is_admin());
CREATE POLICY "Update own contracts" ON public.contracts FOR UPDATE USING (auth.uid() = client_id OR auth.uid() = lawyer_id OR public.is_admin());

CREATE POLICY "View contract milestones" ON public.contract_milestones FOR SELECT USING (
  public.is_admin() OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_id AND (c.client_id = auth.uid() OR c.lawyer_id = auth.uid()))
);
CREATE POLICY "Manage contract milestones" ON public.contract_milestones USING (
  public.is_admin() OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_id AND (c.client_id = auth.uid() OR c.lawyer_id = auth.uid()))
);

-- 8. Financials (Transactions & Disputes)
CREATE POLICY "View own transactions" ON public.transactions FOR SELECT USING (auth.uid() = client_id OR auth.uid() = lawyer_id OR public.is_admin());
CREATE POLICY "Insert transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = client_id OR public.is_admin());
CREATE POLICY "Update transactions" ON public.transactions FOR UPDATE USING (public.is_admin()); -- Usually backend/admin only

CREATE POLICY "View own disputes" ON public.disputes FOR SELECT USING (
  public.is_admin() OR auth.uid() = raised_by OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_id AND (c.client_id = auth.uid() OR c.lawyer_id = auth.uid()))
);
CREATE POLICY "Insert disputes" ON public.disputes FOR INSERT WITH CHECK (auth.uid() = raised_by OR public.is_admin());
CREATE POLICY "Update disputes" ON public.disputes FOR UPDATE USING (public.is_admin());

-- 9. Appointments & Cases
CREATE POLICY "View own appointments" ON public.appointments FOR SELECT USING (auth.uid() = client_id OR auth.uid() = lawyer_id OR public.is_admin());
CREATE POLICY "Clients book appointments" ON public.appointments FOR INSERT WITH CHECK (auth.uid() = client_id OR public.is_admin());
CREATE POLICY "Participants update appointments" ON public.appointments FOR UPDATE USING (auth.uid() = client_id OR auth.uid() = lawyer_id OR public.is_admin());

CREATE POLICY "View own cases" ON public.cases FOR SELECT USING (auth.uid() = client_id OR auth.uid() = lawyer_id OR public.is_admin());
CREATE POLICY "Participants manage cases" ON public.cases USING (auth.uid() = client_id OR auth.uid() = lawyer_id OR public.is_admin());

CREATE POLICY "View case progress" ON public.case_progress FOR SELECT USING (
  public.is_admin() OR EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND (c.client_id = auth.uid() OR c.lawyer_id = auth.uid()))
);
CREATE POLICY "Manage case progress" ON public.case_progress USING (
  public.is_admin() OR EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND (c.client_id = auth.uid() OR c.lawyer_id = auth.uid()))
);

-- 10. Messages
CREATE POLICY "Participants view messages" ON public.messages FOR SELECT USING (
  public.is_admin() OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.workspace_id = messages.workspace_id AND (c.client_id = auth.uid() OR c.lawyer_id = auth.uid()))
);
CREATE POLICY "Participants insert messages" ON public.messages FOR INSERT WITH CHECK (
  (auth.uid() = sender_id OR public.is_admin()) AND 
  EXISTS (SELECT 1 FROM public.contracts c WHERE c.workspace_id = workspace_id AND (c.client_id = auth.uid() OR c.lawyer_id = auth.uid()))
);

-- 11. Documents
CREATE POLICY "View own documents" ON public.documents FOR SELECT USING (auth.uid() = client_id OR auth.uid() = lawyer_id OR public.is_admin());
CREATE POLICY "Upload own documents" ON public.documents FOR INSERT WITH CHECK (auth.uid() = client_id OR auth.uid() = lawyer_id OR public.is_admin());
CREATE POLICY "Manage own documents" ON public.documents USING (auth.uid() = client_id OR auth.uid() = lawyer_id OR public.is_admin());

-- 12. Feedback
CREATE POLICY "Feedback viewable by everyone" ON public.feedback FOR SELECT USING (true);
CREATE POLICY "Clients leave feedback" ON public.feedback FOR INSERT WITH CHECK (auth.uid() = client_id OR public.is_admin());
CREATE POLICY "Lawyers respond to feedback" ON public.feedback FOR UPDATE USING (auth.uid() = lawyer_id OR public.is_admin());

-- 13. Notifications
CREATE POLICY "View own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());

-- 14. Legal Updates
CREATE POLICY "Legal updates viewable by everyone" ON public.legal_updates FOR SELECT USING (true);
CREATE POLICY "Lawyers post legal updates" ON public.legal_updates USING (auth.uid() = author_id OR public.is_admin());

-- 15. Contact Inquiries
CREATE POLICY "Contact inquiries viewable by admin" ON public.contact_inquiries FOR SELECT USING (public.is_admin());
CREATE POLICY "Anyone can insert inquiries" ON public.contact_inquiries FOR INSERT WITH CHECK (true);

-- 16. AI Chat
CREATE POLICY "View own AI sessions" ON public.ai_chat_sessions FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Manage own AI sessions" ON public.ai_chat_sessions USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "View own AI messages" ON public.ai_chat_messages FOR SELECT USING (
  public.is_admin() OR EXISTS (SELECT 1 FROM public.ai_chat_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
);
CREATE POLICY "Manage own AI messages" ON public.ai_chat_messages USING (
  public.is_admin() OR EXISTS (SELECT 1 FROM public.ai_chat_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
);
