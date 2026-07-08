import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';

const LawyerPortfolioView = () => {
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    practice_area: '',
    year_completed: new Date().getFullYear(),
    outcome: 'won',
    description: '',
    is_landmark: false
  });

  useEffect(() => {
    if (!user) return;
    const fetchCases = async () => {
      try {
        const { data, error } = await supabase
          .from('portfolio_cases')
          .select('*')
          .eq('lawyer_id', user.id)
          .order('year_completed', { ascending: false });

        if (error) throw error;
        setCases(data || []);
      } catch (err) {
        console.error('Error fetching cases:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCases();
  }, [user]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('portfolio_cases')
        .insert([{ ...formData, lawyer_id: user.id }])
        .select();

      if (error) throw error;
      setCases(prev => [data[0], ...prev]);
      setIsModalOpen(false);
      setFormData({
        title: '',
        practice_area: '',
        year_completed: new Date().getFullYear(),
        outcome: 'won',
        description: '',
        is_landmark: false
      });
    } catch (err) {
      console.error('Error adding case:', err);
      alert('Failed to add case');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCase = async (id) => {
    if (!window.confirm('Are you sure you want to delete this case?')) return;
    try {
      const { error } = await supabase.from('portfolio_cases').delete().eq('id', id);
      if (error) throw error;
      setCases(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error('Error deleting case:', err);
    }
  };

  if (loading) return <div className="p-8 text-center animate-pulse">Loading portfolio...</div>;

  return (
    <div className="p-4 md:p-8 max-w-container-max mx-auto animate-fadeIn space-y-8 relative">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-primary p-6 md:p-8 rounded-xl text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="font-display-lg text-display-lg font-bold text-secondary-fixed">Portfolio & Landmark Cases</h3>
          <p className="text-on-primary-container font-body-md mt-1">Showcase your expertise and track record to prospective clients.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="relative z-10 px-6 py-2.5 bg-secondary-container text-primary rounded-lg font-bold flex items-center gap-2 hover:bg-white transition-colors shadow-sm active:scale-95"
        >
          <span className="material-symbols-outlined filled-icon">add_circle</span>
          Add Case
        </button>
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
          <span className="material-symbols-outlined text-[150px] filled-icon translate-x-4 translate-y-4">folder_special</span>
        </div>
      </div>

      {/* Case Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cases.length > 0 ? cases.map(c => (
          <div key={c.id} className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-all flex flex-col h-full relative overflow-hidden group">
            {c.is_landmark && (
              <div className="absolute top-0 right-0 bg-secondary-fixed text-on-secondary-fixed text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-lg shadow-sm z-10">
                LANDMARK
              </div>
            )}
            <div className={`p-6 border-b border-outline-variant flex-1 ${c.is_landmark ? 'bg-gradient-to-br from-secondary-fixed/10 to-transparent border-secondary-fixed/50' : ''}`}>
              <div className="flex items-start justify-between mb-4 mt-2">
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider border ${
                  c.outcome === 'won' ? 'bg-success-green/15 text-success-green border-success-green/20' :
                  c.outcome === 'settled' ? 'bg-primary/10 text-primary border-primary/20' :
                  'bg-error/10 text-error border-error/20'
                }`}>
                  {c.outcome}
                </span>
                <span className="text-xs text-on-surface-variant font-bold">{c.year_completed}</span>
              </div>
              <h4 className="font-headline-sm text-body-lg text-primary font-bold mb-2">{c.title}</h4>
              <p className="text-sm text-on-surface-variant line-clamp-3">{c.description}</p>
            </div>
            <div className="p-4 bg-surface-container-low/50 flex flex-wrap gap-2 items-center justify-between">
              <div className="flex gap-2">
                <span className="text-[10px] font-bold text-on-primary-container bg-primary-container/10 px-2 py-1 rounded border border-primary-container/20">{c.practice_area}</span>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => deleteCase(c.id)} className="p-1 text-on-surface-variant hover:text-error transition-colors"><span className="material-symbols-outlined text-[18px]">delete</span></button>
              </div>
            </div>
          </div>
        )) : (
          <div className="col-span-full p-12 text-center text-on-surface-variant border border-dashed border-outline-variant rounded-xl">
            <span className="material-symbols-outlined text-[48px] mb-4 opacity-50">folder_open</span>
            <p>No portfolio cases added yet. Start by adding a landmark case.</p>
          </div>
        )}
      </div>

      {/* Modal Form Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-primary/40 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-surface-container-lowest w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-surface-container-low/50">
              <h3 className="font-headline-md text-headline-sm text-primary font-bold">Add New Portfolio Case</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-full transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <form className="space-y-6" id="add-case-form" onSubmit={handleSubmit}>
                
                <div className="space-y-1.5 gold-glow rounded-lg">
                  <label className="text-body-sm font-bold text-on-surface-variant block">Case Title</label>
                  <input type="text" name="title" value={formData.title} onChange={handleChange} required placeholder="e.g. Acme Corp vs. OmniDynamics" className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:ring-0 text-on-surface" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5 gold-glow rounded-lg">
                    <label className="text-body-sm font-bold text-on-surface-variant block">Practice Area (Type)</label>
                    <input type="text" name="practice_area" value={formData.practice_area} onChange={handleChange} required placeholder="e.g. Intellectual Property" className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:ring-0 text-on-surface" />
                  </div>
                  <div className="space-y-1.5 gold-glow rounded-lg">
                    <label className="text-body-sm font-bold text-on-surface-variant block">Year Completed</label>
                    <input type="number" name="year_completed" value={formData.year_completed} onChange={handleChange} required placeholder="2023" className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:ring-0 text-on-surface" />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-body-sm font-bold text-on-surface-variant block">Case Outcome</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="outcome" value="won" checked={formData.outcome === 'won'} onChange={handleChange} className="w-4 h-4 text-primary focus:ring-secondary" />
                      <span className="text-body-sm font-medium">Won</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="outcome" value="settled" checked={formData.outcome === 'settled'} onChange={handleChange} className="w-4 h-4 text-primary focus:ring-secondary" />
                      <span className="text-body-sm font-medium">Settled</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="outcome" value="lost" checked={formData.outcome === 'lost'} onChange={handleChange} className="w-4 h-4 text-primary focus:ring-secondary" />
                      <span className="text-body-sm font-medium">Lost / Other</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5 gold-glow rounded-lg">
                  <label className="text-body-sm font-bold text-on-surface-variant block">Case Description</label>
                  <textarea name="description" value={formData.description} onChange={handleChange} rows="4" placeholder="Briefly describe the case, your role, and the impact..." className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:ring-0 text-on-surface resize-none"></textarea>
                </div>

                <div className="flex items-center gap-3 p-4 bg-secondary-fixed/10 border border-secondary-fixed/30 rounded-lg">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" name="is_landmark" checked={formData.is_landmark} onChange={handleChange} className="sr-only peer" />
                    <div className="w-10 h-6 bg-outline-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary"></div>
                  </label>
                  <div>
                    <span className="font-bold text-body-sm text-primary">Mark as Landmark Case</span>
                    <p className="text-[11px] text-on-surface-variant">Landmark cases are highlighted on your public profile.</p>
                  </div>
                </div>

              </form>
            </div>
            
            <div className="p-6 border-t border-outline-variant bg-surface-container-lowest flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2 border border-primary text-primary rounded-lg font-label-md hover:bg-surface-container-low transition-colors active:scale-95"
              >
                Cancel
              </button>
              <button form="add-case-form" type="submit" disabled={isSaving} className="px-6 py-2 bg-primary text-white rounded-lg font-label-md hover:bg-secondary transition-colors shadow-sm active:scale-95">
                {isSaving ? 'Saving...' : 'Save Case'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default LawyerPortfolioView;
