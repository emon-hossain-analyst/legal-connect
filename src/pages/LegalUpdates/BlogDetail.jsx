import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { dateStyle: 'long' }) : '');

const BlogDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true); setNotFound(false); setPost(null);
      try {
        const { data, error } = await supabase
          .from('legal_updates')
          .select('*, lawyer:users!legal_updates_lawyer_id_fkey(name, profile_picture_url)')
          .eq('slug', slug)
          .maybeSingle();
        if (error) throw error;
        if (!data) { if (!cancelled) setNotFound(true); return; }
        if (cancelled) return;
        setPost(data);

        // SEO metadata (SPA — set document head).
        document.title = `${data.seo_title || data.title} · LegalConnect`;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.setAttribute('content', data.seo_description || data.excerpt || data.title);

        // Count the view (safe RPC; ignore failure pre-migration).
        supabase.rpc('fn_increment_post_view', { p_slug: slug }).then(() => {});

        // Related: same category, published, excluding this one.
        const { data: rel } = await supabase
          .from('legal_updates')
          .select('id, title, slug, category, excerpt, featured_image_url, created_at, published_at')
          .eq('category', data.category)
          .neq('id', data.id)
          .order('published_at', { ascending: false })
          .limit(3);
        if (!cancelled) setRelated(rel || []);
      } catch (err) {
        console.error('[BlogDetail] load error:', err);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    window.scrollTo(0, 0);
    return () => { cancelled = true; };
  }, [slug]);

  const share = (network) => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(post?.title || 'Legal Update');
    const map = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      twitter: `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
    };
    if (map[network]) window.open(map[network], '_blank', 'noopener,noreferrer,width=600,height=500');
    else if (navigator.clipboard) { navigator.clipboard.writeText(window.location.href); }
  };

  if (loading) {
    return <div className="max-w-3xl mx-auto px-6 py-20 animate-pulse space-y-4">
      <div className="h-8 w-2/3 bg-gray-200 rounded" /><div className="h-64 bg-gray-200 rounded-xl" />
      <div className="h-4 bg-gray-200 rounded" /><div className="h-4 bg-gray-200 rounded" /><div className="h-4 w-5/6 bg-gray-200 rounded" />
    </div>;
  }

  if (notFound) {
    return <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <div className="text-5xl mb-4 opacity-40">📰</div>
      <h1 className="text-2xl font-bold text-navy-primary mb-2">Article not found</h1>
      <p className="text-gray-500 mb-6">This article may have been unpublished or moved.</p>
      <Link to="/legal-updates" className="px-5 py-2.5 bg-navy-primary text-white rounded-lg font-bold">Back to Legal Updates</Link>
    </div>;
  }

  return (
    <article className="bg-white min-h-screen pb-20">
      <div className="max-w-3xl mx-auto px-6">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-400 pt-8 flex items-center gap-2" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-navy-primary">Home</Link><span>/</span>
          <Link to="/legal-updates" className="hover:text-navy-primary">Legal Updates</Link><span>/</span>
          <span className="text-gray-600 truncate">{post.title}</span>
        </nav>

        <header className="mt-6">
          <Link to={`/legal-updates?category=${encodeURIComponent(post.category || 'General')}`} className="inline-block px-3 py-1 bg-navy-primary/10 text-navy-primary text-xs font-bold uppercase tracking-widest rounded">{post.category || 'General'}</Link>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-navy-primary mt-4 leading-tight">{post.title}</h1>
          <div className="flex items-center gap-4 mt-5 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-navy-primary text-white flex items-center justify-center font-bold text-xs overflow-hidden">
                {post.lawyer?.profile_picture_url ? <img src={post.lawyer.profile_picture_url} alt="" className="w-full h-full object-cover" /> : (post.lawyer?.name || 'L').charAt(0)}
              </div>
              <span className="font-semibold text-gray-700">{post.lawyer?.name || 'LegalConnect Editorial'}</span>
            </div>
            <span>·</span><span>{fmtDate(post.published_at || post.created_at)}</span>
            <span>·</span><span>{post.reading_time || 1} min read</span>
            {typeof post.view_count === 'number' && (<><span>·</span><span>{post.view_count} views</span></>)}
          </div>
        </header>

        {post.featured_image_url && (
          <img src={post.featured_image_url} alt={post.title} className="w-full rounded-2xl mt-8 max-h-[420px] object-cover" />
        )}

        <div className="prose prose-lg max-w-none mt-8 text-gray-700 leading-relaxed">
          {(post.content || '').split('\n').filter((p) => p.trim()).map((para, i) => <p key={i} className="mb-5">{para}</p>)}
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-8">
            {post.tags.map((t) => <span key={t} className="px-3 py-1 bg-bg-light text-gray-600 text-xs font-semibold rounded-full">#{t}</span>)}
          </div>
        )}

        {/* Share */}
        <div className="flex items-center gap-3 mt-8 pt-6 border-t border-border-subtle">
          <span className="text-sm font-bold text-gray-500">Share:</span>
          <button onClick={() => share('twitter')} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm font-semibold hover:bg-gray-200">Twitter</button>
          <button onClick={() => share('facebook')} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm font-semibold hover:bg-gray-200">Facebook</button>
          <button onClick={() => share('linkedin')} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm font-semibold hover:bg-gray-200">LinkedIn</button>
          <button onClick={() => share('copy')} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm font-semibold hover:bg-gray-200">Copy link</button>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-14">
            <h2 className="text-xl font-bold text-navy-primary mb-5">Related Articles</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {related.map((r) => (
                <button key={r.id} onClick={() => navigate(`/legal-updates/${r.slug}`)} className="text-left p-4 rounded-xl border border-border-subtle hover:shadow-md transition">
                  <span className="text-[11px] font-bold uppercase text-navy-primary/70">{r.category}</span>
                  <h3 className="font-bold text-navy-primary mt-1 line-clamp-2">{r.title}</h3>
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2">{r.excerpt}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="mt-12">
          <Link to="/legal-updates" className="text-navy-primary font-bold hover:underline">← Back to all Legal Updates</Link>
        </div>
      </div>
    </article>
  );
};

export default BlogDetail;
