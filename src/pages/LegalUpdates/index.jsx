import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

const PRESET_CATEGORIES = [
  'All', 'General', 'Corporate Law', 'Family Law', 
  'Criminal Law', 'Real Estate', 'Immigration', 'Tax Law', 'Employment Law'
];

const SkeletonCard = () => (
  <div className="bg-surface-white rounded-lg border border-border-subtle p-6 shadow-sm animate-pulse h-[300px] flex flex-col justify-between">
    <div>
      <div className="w-24 h-6 bg-gray-200 rounded mb-4"></div>
      <div className="w-full h-6 bg-gray-200 rounded mb-2"></div>
      <div className="w-3/4 h-6 bg-gray-200 rounded mb-6"></div>
      <div className="w-full h-4 bg-gray-200 rounded mb-2"></div>
      <div className="w-full h-4 bg-gray-200 rounded mb-2"></div>
      <div className="w-5/6 h-4 bg-gray-200 rounded mb-2"></div>
    </div>
    <div className="flex items-center gap-3 border-t border-border-subtle pt-4 mt-6">
      <div className="w-8 h-8 rounded-full bg-gray-200"></div>
      <div className="w-24 h-4 bg-gray-200 rounded"></div>
      <div className="ml-auto w-16 h-4 bg-gray-200 rounded"></div>
    </div>
  </div>
);

const LegalUpdates = () => {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Track expanded cards
  const [expandedIds, setExpandedIds] = useState(new Set());

  useEffect(() => {
    fetchUpdates();
  }, []);

  const fetchUpdates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('legal_updates')
        .select(`
          *,
          lawyer:users!legal_updates_lawyer_id_fkey(name, profile_picture_url)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUpdates(data || []);
    } catch (err) {
      console.error('Error fetching updates:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const filteredUpdates = updates.filter(update => {
    const matchesSearch = update.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          update.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || update.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="bg-bg-light min-h-screen pb-20">
      
      {/* Header */}
      <div className="bg-navy-primary text-white py-16 text-center border-b-4 border-accent-gold">
        <div className="max-w-3xl mx-auto px-6">
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-6">Legal Updates & Insights</h1>
          
          <div className="relative max-w-xl mx-auto">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl">🔍</span>
            <input 
              type="text" 
              placeholder="Search articles, topics, or keywords..." 
              className="w-full pl-12 pr-4 py-4 rounded-full border-none focus:outline-none focus:ring-4 focus:ring-accent-gold/50 text-text-dark shadow-lg text-lg"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 mt-10">
        
        {/* Categories */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
          {PRESET_CATEGORIES.map(cat => (
            <button 
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors border shadow-sm ${
                selectedCategory === cat 
                  ? 'bg-accent-gold text-navy-primary border-accent-gold' 
                  : 'bg-white text-text-muted border-border-subtle hover:bg-bg-light'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          ) : filteredUpdates.length > 0 ? (
            filteredUpdates.map(update => {
              const isExpanded = expandedIds.has(update.id);
              return (
                <div 
                  key={update.id} 
                  className={`bg-white rounded-lg border border-border-subtle shadow-sm overflow-hidden flex flex-col transition-all duration-500 hover:shadow-md cursor-pointer ${
                    isExpanded ? 'row-span-2' : ''
                  }`}
                  style={{
                    maxHeight: isExpanded ? '2000px' : '400px',
                  }}
                  onClick={() => !isExpanded && toggleExpand(update.id)}
                >
                  <div className="p-6 flex-1 flex flex-col">
                    <span className="inline-block px-3 py-1 bg-navy-primary/10 text-navy-primary text-xs font-bold uppercase tracking-widest rounded-sm mb-4 self-start">
                      {update.category || 'General'}
                    </span>
                    <h2 className="text-xl font-bold text-navy-primary mb-4 leading-tight group-hover:text-accent-gold transition-colors">
                      {update.title}
                    </h2>
                    
                    <div className={`text-text-muted text-sm flex-1 overflow-hidden transition-all duration-500 relative ${isExpanded ? '' : 'line-clamp-4'}`}>
                      {update.content.split('\n').map((paragraph, idx) => (
                        <p key={idx} className="mb-4">{paragraph}</p>
                      ))}
                      {!isExpanded && (
                        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>
                      )}
                    </div>
                  </div>

                  <div className="bg-bg-light/50 px-6 py-4 border-t border-border-subtle flex flex-col">
                    <div className="flex justify-between items-center w-full">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-navy-primary text-white flex items-center justify-center font-bold text-xs uppercase overflow-hidden">
                          {update.lawyer?.profile_picture_url ? (
                            <img src={update.lawyer.profile_picture_url} alt={update.lawyer.name} className="w-full h-full object-cover" />
                          ) : (
                            (update.lawyer?.name || 'L').charAt(0)
                          )}
                        </div>
                        <span className="text-sm font-bold text-text-dark">{update.lawyer?.name?.split(' ')[0] || 'Expert'}</span>
                      </div>
                      <div className="text-xs font-medium text-text-muted">
                        {new Date(update.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleExpand(update.id); }}
                        className="mt-6 w-full py-2 bg-bg-light border border-border-subtle text-text-dark rounded text-sm font-bold hover:bg-gray-200 transition-colors"
                      >
                        Collapse Article
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full bg-white rounded-lg border border-border-subtle p-16 text-center shadow-sm">
              <div className="text-5xl mb-4 text-text-muted opacity-50">📰</div>
              <h3 className="text-xl font-bold text-navy-primary mb-2">No updates available.</h3>
              <p className="text-text-muted">Check back soon for new legal insights and articles.</p>
              <button 
                onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
                className="mt-6 px-6 py-2 bg-white border-2 border-navy-primary text-navy-primary rounded font-bold hover:bg-bg-light transition-colors"
              >
                Clear Search
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LegalUpdates;