import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

const CategoryManagement = () => {
  const [practiceAreas, setPracticeAreas] = useState([]);
  const [expertiseList, setExpertiseList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Forms State
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaIcon, setNewAreaIcon] = useState('gavel');
  const [newSubName, setNewSubName] = useState('');
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const [areasRes, expRes] = await Promise.all([
        supabase.from('practice_areas').select('*').order('name'),
        supabase.from('legal_expertise').select('*').order('name')
      ]);

      if (areasRes.error) throw areasRes.error;
      if (expRes.error) throw expRes.error;

      setPracticeAreas(areasRes.data || []);
      setExpertiseList(expRes.data || []);
      if (areasRes.data && areasRes.data.length > 0 && !selectedAreaId) {
        setSelectedAreaId(areasRes.data[0].id);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError('Failed to load categories. Please check your network connection.');
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateSlug = (text) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleCreatePracticeArea = async (e) => {
    e.preventDefault();
    const cleanName = newAreaName.trim();
    if (!cleanName) return;

    if (practiceAreas.some(area => area.name.toLowerCase() === cleanName.toLowerCase())) {
      toast.error(`Primary Practice Area "${cleanName}" already exists!`);
      return;
    }

    setIsSubmitting(true);
    const slug = generateSlug(cleanName);

    try {
      const { error } = await supabase.from('practice_areas').insert([
        { name: cleanName, slug, icon: newAreaIcon || 'gavel' }
      ]);

      if (error) {
        if (error.code === '23505' || error.message?.includes('duplicate key')) {
          throw new Error(`A practice area with name "${cleanName}" or slug "${slug}" already exists.`);
        }
        throw error;
      }
      toast.success('Primary Category created successfully!');
      setNewAreaName('');
      setNewAreaIcon('gavel');
      fetchCategories();
    } catch (err) {
      toast.error(`Failed to create primary category: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSubcategory = async (e) => {
    e.preventDefault();
    const cleanSubName = newSubName.trim();
    if (!cleanSubName || !selectedAreaId) return;

    const parentIdNum = parseInt(selectedAreaId, 10);
    if (expertiseList.some(sub => sub.practice_area_id === parentIdNum && sub.name.toLowerCase() === cleanSubName.toLowerCase())) {
      toast.error(`Subcategory "${cleanSubName}" already exists under this practice area!`);
      return;
    }

    setIsSubmitting(true);
    const slug = generateSlug(cleanSubName);

    try {
      const { error } = await supabase.from('legal_expertise').insert([
        {
          practice_area_id: parentIdNum,
          name: cleanSubName,
          slug
        }
      ]);

      if (error) {
        if (error.code === '23505' || error.message?.includes('duplicate key')) {
          throw new Error(`Subcategory "${cleanSubName}" already exists under this practice area.`);
        }
        throw error;
      }
      toast.success('Subcategory created successfully!');
      setNewSubName('');
      fetchCategories();
    } catch (err) {
      toast.error(`Failed to create subcategory: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteArea = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? All subcategories under it will also be deleted.`)) return;
    try {
      const { error } = await supabase.from('practice_areas').delete().eq('id', id);
      if (error) throw error;
      toast.success('Primary category deleted');
      fetchCategories();
    } catch (err) {
      toast.error('Failed to delete category');
    }
  };

  const handleDeleteSubcategory = async (id, name) => {
    if (!window.confirm(`Delete subcategory "${name}"?`)) return;
    try {
      const { error } = await supabase.from('legal_expertise').delete().eq('id', id);
      if (error) throw error;
      toast.success('Subcategory deleted');
      fetchCategories();
    } catch (err) {
      toast.error('Failed to delete subcategory');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-serif font-bold text-navy-primary">Category & Expertise Management</h1>
        <p className="text-gray-600 mt-1">Configure multi-tiered legal practice areas and granular expertise taxonomies across the marketplace.</p>
      </div>

      {/* Creation Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Primary Category Form */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-navy-primary mb-4 flex items-center gap-2">
              <span className="text-accent-gold">📁</span> Add Primary Practice Area
            </h2>
            <form onSubmit={handleCreatePracticeArea} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
                <input
                  type="text"
                  placeholder="e.g., Family Law, Corporate Law"
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-navy-primary focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon Identifier (Material/Emoji)</label>
                <input
                  type="text"
                  placeholder="e.g., gavel, business_center, family_restroom"
                  value={newAreaIcon}
                  onChange={(e) => setNewAreaIcon(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-navy-primary focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting || !newAreaName.trim()}
                className="w-full py-2.5 bg-navy-primary text-white font-medium rounded-lg hover:bg-navy-secondary transition disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : '+ Create Primary Category'}
              </button>
            </form>
          </div>
        </div>

        {/* Subcategory Form */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-navy-primary mb-4 flex items-center gap-2">
              <span className="text-teal-600">🔖</span> Add Legal Expertise Subcategory
            </h2>
            <form onSubmit={handleCreateSubcategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent Practice Area</label>
                <select
                  value={selectedAreaId}
                  onChange={(e) => setSelectedAreaId(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-600 focus:outline-none bg-white"
                  required
                >
                  <option value="" disabled>Select parent category...</option>
                  {practiceAreas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expertise / Subcategory Name</label>
                <input
                  type="text"
                  placeholder="e.g., Child Custody, Venture Capital"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-600 focus:outline-none"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting || !newSubName.trim() || !selectedAreaId}
                className="w-full py-2.5 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : '+ Create Subcategory'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Hierarchical Display Tree */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-navy-primary mb-6">Hierarchy Overview</h2>
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-navy-primary"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center space-y-4 my-4">
            <span className="material-symbols-outlined text-5xl text-red-500">error_outline</span>
            <h3 className="text-xl font-bold text-navy-primary">Failed to Load Categories</h3>
            <p className="text-gray-600 text-sm">{error}</p>
            <button 
              onClick={() => { setLoading(true); setError(null); fetchCategories(); }}
              className="px-6 py-2.5 bg-navy-primary hover:bg-navy-primary/90 text-white font-bold rounded-xl shadow transition active:scale-95"
            >
              Retry
            </button>
          </div>
        ) : practiceAreas.length === 0 ? (
          <div className="bg-surface-white rounded-xl border border-border-subtle p-12 text-center space-y-3">
            <span className="material-symbols-outlined text-5xl text-gray-300">category</span>
            <p className="font-bold text-gray-600 text-lg">No Practice Areas Created Yet</p>
            <p className="text-sm text-gray-400 max-w-md mx-auto">Use the form above to define primary legal practice areas and subcategories for lawyers and clients.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {practiceAreas.map((area) => {
              const subs = expertiseList.filter((exp) => exp.practice_area_id === area.id);
              return (
                <div key={area.id} className="border border-gray-200 rounded-xl p-5 bg-gray-50/50 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-gray-200 mb-3">
                      <div className="flex items-center gap-2 font-serif font-bold text-navy-primary text-lg">
                        <span className="text-accent-gold">{area.icon === 'gavel' ? '⚖️' : '📁'}</span>
                        {area.name}
                      </div>
                      <button
                        onClick={() => handleDeleteArea(area.id, area.name)}
                        className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50 transition"
                        title="Delete practice area"
                      >
                        Delete
                      </button>
                    </div>

                    <div className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 block mb-2">
                        Subcategories ({subs.length})
                      </span>
                      {subs.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No subcategories defined.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {subs.map((sub) => (
                            <div
                              key={sub.id}
                              className="bg-white border border-gray-200 px-3 py-1 rounded-full text-xs font-medium text-gray-700 flex items-center gap-2 shadow-2xs"
                            >
                              <span>{sub.name}</span>
                              <button
                                onClick={() => handleDeleteSubcategory(sub.id, sub.name)}
                                className="text-gray-400 hover:text-red-500 transition ml-1"
                                title="Remove subcategory"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryManagement;
