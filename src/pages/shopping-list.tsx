import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/lib/hooks/useAuth';
import { getSupabaseClient } from '@/lib/supabase';
import { FaPlus, FaCheck, FaTimes, FaShoppingCart, FaStickyNote, FaSave } from 'react-icons/fa';
import { MdEdit, MdDelete } from 'react-icons/md';

interface ShoppingItem {
  id: string;
  name: string;
  quantity: string;
  category: string;
  completed: boolean;
  notes: string;
  created_at: string;
}

interface CookingNote {
  id: string;
  title: string;
  content: string;
  recipe_id?: string;
  recipe_title?: string;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  'produce',
  'dairy',
  'meat',
  'pantry',
  'frozen',
  'beverages',
  'snacks',
  'condiments',
  'bakery',
  'other'
];

export default function ShoppingList() {
  const router = useRouter();
  const { session, user, loading: sessionLoading } = useAuth();
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [cookingNotes, setCookingNotes] = useState<CookingNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Shopping list states
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('other');
  const [newItemNotes, setNewItemNotes] = useState('');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemQuantity, setEditItemQuantity] = useState('');
  const [editItemCategory, setEditItemCategory] = useState('');
  const [editItemNotes, setEditItemNotes] = useState('');
  
  // Notes states
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editNoteTitle, setEditNoteTitle] = useState('');
  const [editNoteContent, setEditNoteContent] = useState('');
  const [activeTab, setActiveTab] = useState<'shopping' | 'notes'>('shopping');

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      router.push('/login?redirectTo=/shopping-list');
      return;
    }
    if (user) {
      loadData();
    }
  }, [session, sessionLoading, user]);

  // Helper to handle and log errors
  const handleSupabaseError = (context: string, error: any) => {
    console.error(`[Supabase] ${context}:`, error);
    setError('Something went wrong. Please try again.');
    setTimeout(() => setError(null), 5000);
  };

  const loadData = async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const supabase = getSupabaseClient();
      // Load shopping items
      const { data: items, error: itemsError } = await supabase
        .from('shopping_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (itemsError) return handleSupabaseError('fetching shopping_items', itemsError);
      setShoppingItems(items || []);
      // Load cooking notes
      const { data: notes, error: notesError } = await supabase
        .from('cooking_notes')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      if (notesError) return handleSupabaseError('fetching cooking_notes', notesError);
      setCookingNotes(notes || []);
    } catch (error) {
      handleSupabaseError('loading data', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addShoppingItem = async () => {
    if (!user || !newItemName.trim()) return;
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('shopping_items')
        .insert([{
          user_id: user.id,
          name: newItemName.trim(),
          quantity: newItemQuantity.trim(),
          category: newItemCategory,
          notes: newItemNotes.trim(),
          completed: false
        }])
        .select()
        .single();
      if (error) return handleSupabaseError('adding shopping_item', error);
      setShoppingItems(prev => [data, ...prev]);
      setNewItemName('');
      setNewItemQuantity('');
      setNewItemCategory('other');
      setNewItemNotes('');
    } catch (error) {
      handleSupabaseError('adding shopping_item', error);
    }
  };

  const toggleItemComplete = async (itemId: string) => {
    try {
      const supabase = getSupabaseClient();
      const item = shoppingItems.find(i => i.id === itemId);
      if (!item) return;
      const { error } = await supabase
        .from('shopping_items')
        .update({ completed: !item.completed })
        .eq('id', itemId);
      if (error) return handleSupabaseError('toggling item complete', error);
      setShoppingItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, completed: !item.completed } : item
      ));
    } catch (error) {
      handleSupabaseError('toggling item complete', error);
    }
  };

  const deleteShoppingItem = async (itemId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('shopping_items')
        .delete()
        .eq('id', itemId);
      if (error) return handleSupabaseError('deleting shopping_item', error);
      setShoppingItems(prev => prev.filter(item => item.id !== itemId));
    } catch (error) {
      handleSupabaseError('deleting shopping_item', error);
    }
  };

  const startEditItem = (item: ShoppingItem) => {
    setEditingItem(item.id);
    setEditItemName(item.name);
    setEditItemQuantity(item.quantity);
    setEditItemCategory(item.category);
    setEditItemNotes(item.notes);
  };

  const saveEditItem = async () => {
    if (!editingItem || !editItemName.trim()) return;
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('shopping_items')
        .update({
          name: editItemName.trim(),
          quantity: editItemQuantity.trim(),
          category: editItemCategory,
          notes: editItemNotes.trim()
        })
        .eq('id', editingItem);
      if (error) return handleSupabaseError('updating shopping_item', error);
      setShoppingItems(prev => prev.map(item => 
        item.id === editingItem 
          ? { 
              ...item, 
              name: editItemName.trim(),
              quantity: editItemQuantity.trim(),
              category: editItemCategory,
              notes: editItemNotes.trim()
            }
          : item
      ));
      setEditingItem(null);
    } catch (error) {
      handleSupabaseError('updating shopping_item', error);
    }
  };

  const cancelEditItem = () => {
    setEditingItem(null);
  };

  const addCookingNote = async () => {
    if (!user || !newNoteTitle.trim() || !newNoteContent.trim()) return;
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('cooking_notes')
        .insert([{
          user_id: user.id,
          title: newNoteTitle.trim(),
          content: newNoteContent.trim()
        }])
        .select()
        .single();
      if (error) return handleSupabaseError('adding cooking_note', error);
      setCookingNotes(prev => [data, ...prev]);
      setNewNoteTitle('');
      setNewNoteContent('');
    } catch (error) {
      handleSupabaseError('adding cooking_note', error);
    }
  };

  const deleteCookingNote = async (noteId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('cooking_notes')
        .delete()
        .eq('id', noteId);
      if (error) return handleSupabaseError('deleting cooking_note', error);
      setCookingNotes(prev => prev.filter(note => note.id !== noteId));
    } catch (error) {
      handleSupabaseError('deleting cooking_note', error);
    }
  };

  const startEditNote = (note: CookingNote) => {
    setEditingNote(note.id);
    setEditNoteTitle(note.title);
    setEditNoteContent(note.content);
  };

  const saveEditNote = async () => {
    if (!editingNote || !editNoteTitle.trim() || !editNoteContent.trim()) return;
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('cooking_notes')
        .update({
          title: editNoteTitle.trim(),
          content: editNoteContent.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', editingNote);
      if (error) return handleSupabaseError('updating cooking_note', error);
      setCookingNotes(prev => prev.map(note => 
        note.id === editingNote 
          ? { 
              ...note, 
              title: editNoteTitle.trim(),
              content: editNoteContent.trim(),
              updated_at: new Date().toISOString()
            }
          : note
      ));
      setEditingNote(null);
    } catch (error) {
      handleSupabaseError('updating cooking_note', error);
    }
  };

  const cancelEditNote = () => {
    setEditingNote(null);
  };

  const clearCompletedItems = async () => {
    if (!user) return;
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('shopping_items')
        .delete()
        .eq('user_id', user.id)
        .eq('completed', true);
      if (error) return handleSupabaseError('clearing completed shopping_items', error);
      setShoppingItems(prev => prev.filter(item => !item.completed));
    } catch (error) {
      handleSupabaseError('clearing completed shopping_items', error);
    }
  };

  const completedCount = shoppingItems.filter(item => item.completed).length;
  const totalCount = shoppingItems.length;

  if (sessionLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-8">
          {/* Skeleton for add new item form */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-4 items-end">
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          </div>
          {/* Skeleton for notes textarea */}
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          {/* Skeleton for section title */}
          <div className="h-8 w-1/3 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
          {/* Skeleton for shopping list items */}
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4 border border-outline rounded-xl">
                <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="flex-1 flex items-center gap-2">
                  <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-5 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-5 w-12 bg-gray-300 dark:bg-gray-800 rounded-full" />
                </div>
                <div className="flex gap-2">
                  <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                  <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show nothing while redirecting to login
  if (!session) {
    return null;
  }

  // Empty State Component
  const EmptyState = ({ type }: { type: 'shopping' | 'notes' }) => (
    <div className="text-center py-8">
      <div className="mb-4">
        <div className="text-4xl mb-2">
          {type === 'shopping' ? '🛒' : '📝'}
        </div>
        <h3 className="text-lg font-semibold mb-1">
          {type === 'shopping' ? 'your shopping list is empty' : 'no cooking notes yet'}
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          {type === 'shopping' 
            ? 'add items to get started with your grocery shopping'
            : 'add notes to keep track of your cooking experiments and tips'
          }
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {type === 'shopping' ? (
          <button
            onClick={() => setNewItemName('milk')}
            className="px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            add sample item
          </button>
        ) : (
          <button
            onClick={() => {
              setNewNoteTitle('Perfect Pasta Tip');
              setNewNoteContent('Always salt the water generously - it should taste like seawater!');
            }}
            className="px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            add sample note
          </button>
        )}
      </div>
    </div>
  );

  // Hero Section from commit 3213128ff4759e7a47cc0899ae7ad3cb9f567bf5
  const HeroSection = () => (
    <div className="mb-8">
      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16 rounded-full overflow-hidden flex items-center justify-center bg-[var(--background)]">
          <FaShoppingCart className="w-8 h-8 text-[var(--foreground)]" />
        </div>
        <div>
          <h1 className="text-2xl dark:text-white">
            shopping list & notes
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            manage your grocery list and keep track of your cooking experiments
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Head>
        <title>The Shopping List | [recipes]</title>
      </Head>

      <main className="max-w-2xl mx-auto px-4 py-8 rounded-2xl" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <HeroSection />
        <div className="space-y-8">
          {error && (
            <div className="p-4 border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex gap-4 pt-8 border-t border-outline">
            <button
              onClick={() => setActiveTab('shopping')}
              className={`text-lg ${activeTab === 'shopping' ? 'text-accent dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
              aria-pressed={activeTab === 'shopping'}
              tabIndex={0}
            >
              <FaShoppingCart className="inline w-4 h-4 mr-2" />
              shopping list
              <span className={`ml-2 px-2 py-1 text-xs rounded-full ${totalCount > 0 ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'bg-gray-800/40 text-gray-300 dark:bg-gray-700/40 dark:text-gray-500'}`}>
                {totalCount}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`text-lg ${activeTab === 'notes' ? 'text-accent dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
              aria-pressed={activeTab === 'notes'}
              tabIndex={0}
            >
              <FaStickyNote className="inline w-4 h-4 mr-2" />
              cooking notes
              <span className={`ml-2 px-2 py-1 text-xs rounded-full ${cookingNotes.length > 0 ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'bg-gray-800/40 text-gray-300 dark:bg-gray-700/40 dark:text-gray-500'}`}>
                {cookingNotes.length}
              </span>
            </button>
          </div>

          {/* Shopping List Tab */}
          {activeTab === 'shopping' && (
            <div className="pt-6 border-t border-gray-200 dark:border-gray-800 space-y-6">
              {/* Add New Item Form */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">add new item</h2>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-4 items-end">
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="item name"
                    className="w-full px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    value={newItemQuantity}
                    onChange={(e) => setNewItemQuantity(e.target.value)}
                    placeholder="quantity (e.g., 2 lbs)"
                    className="w-full px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="relative w-full">
                    <select
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value)}
                      className="w-full px-6 py-3 pr-10 border border-outline bg-transparent text-[var(--foreground)] appearance-none hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {CATEGORIES.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" /></svg>
                    </span>
                  </div>
                  <button
                    onClick={addShoppingItem}
                    disabled={!newItemName.trim()}
                    className="px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 transition-opacity rounded-xl text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    aria-label="Add item"
                  >
                    <FaPlus className="w-5 h-5 m-0" />
                  </button>
                </div>
                <textarea
                  value={newItemNotes}
                  onChange={(e) => setNewItemNotes(e.target.value)}
                  placeholder="notes (optional)"
                  className="w-full px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                />
              </div>

              {/* Shopping List Items */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-semibold">The Shopping List</h2>
                  {completedCount > 0 && (
                    <button
                      onClick={clearCompletedItems}
                      className="px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-base disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      clear completed
                    </button>
                  )}
                </div>

                {shoppingItems.length === 0 ? (
                  <EmptyState type="shopping" />
                ) : (
                  <div className="space-y-2">
                    {shoppingItems.map((item) => (
                      <div
                        key={item.id}
                        className={`p-4 border border-outline rounded-xl transition-all duration-200 ${
                          item.completed 
                            ? 'opacity-75' 
                            : ''
                        }`}
                      >
                        {editingItem === item.id ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <input
                                type="text"
                                value={editItemName}
                                onChange={(e) => setEditItemName(e.target.value)}
                                className="px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <input
                                type="text"
                                value={editItemQuantity}
                                onChange={(e) => setEditItemQuantity(e.target.value)}
                                className="px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <div className="relative w-full">
                                <select
                                  value={editItemCategory}
                                  onChange={(e) => setEditItemCategory(e.target.value)}
                                  className="px-6 py-3 pr-10 border border-outline bg-transparent text-[var(--foreground)] appearance-none hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
                                >
                                  {CATEGORIES.map(category => (
                                    <option key={category} value={category}>{category}</option>
                                  ))}
                                </select>
                                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
                                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" /></svg>
                                </span>
                              </div>
                            </div>
                            <textarea
                              value={editItemNotes}
                              onChange={(e) => setEditItemNotes(e.target.value)}
                              className="w-full px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={saveEditItem}
                                className="px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-base disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <FaSave className="w-3 h-3" />
                                save
                              </button>
                              <button
                                onClick={cancelEditItem}
                                className="px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-base disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <FaTimes className="w-3 h-3" />
                                cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <button
                                onClick={() => toggleItemComplete(item.id)}
                                className={`w-5 h-5 rounded border-2 transition-all duration-200 flex items-center justify-center hover:scale-110 ${
                                  item.completed
                                    ? 'bg-green-500 border-green-500 text-white'
                                    : 'border-gray-300 dark:border-gray-600 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'
                                }`}
                              >
                                {item.completed && <FaCheck className="w-3 h-3" />}
                              </button>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className={`font-medium ${item.completed ? 'line-through' : ''}`}>
                                    {item.name}
                                  </span>
                                  {item.quantity && (
                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                      ({item.quantity})
                                    </span>
                                  )}
                                  <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-full">
                                    {item.category}
                                  </span>
                                </div>
                                {item.notes && (
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    {item.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => startEditItem(item)}
                                className="w-10 h-10 flex items-center justify-center bg-transparent text-yellow-500 hover:scale-125 hover:opacity-80 active:scale-95 transition-all duration-150 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label="Edit item"
                                title="Edit item"
                              >
                                <MdEdit className="w-6 h-6" />
                              </button>
                              <button
                                onClick={() => deleteShoppingItem(item.id)}
                                className="w-10 h-10 flex items-center justify-center bg-transparent text-red-500 hover:scale-125 hover:opacity-80 active:scale-95 transition-all duration-150 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label="Delete item"
                                title="Delete item"
                              >
                                <MdDelete className="w-6 h-6" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cooking Notes Tab */}
          {activeTab === 'notes' && (
            <div className="pt-6 border-t border-gray-200 dark:border-gray-800 space-y-6">
              {/* Add New Note Form */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">add new note</h2>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
                  <input
                    type="text"
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    placeholder="note title"
                    className="w-full px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={addCookingNote}
                    disabled={!newNoteTitle.trim() || !newNoteContent.trim()}
                    className="px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 transition-opacity rounded-xl text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    aria-label="Add note"
                  >
                    <FaPlus className="w-5 h-5 m-0" />
                  </button>
                </div>
                <textarea
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="note content"
                  className="w-full px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={2}
                />
              </div>

              {/* Cooking Notes List */}
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold">cooking notes</h2>

                {cookingNotes.length === 0 ? (
                  <EmptyState type="notes" />
                ) : (
                  <div className="space-y-4">
                    {cookingNotes.map((note) => (
                      <div
                        key={note.id}
                        className="p-4 border border-outline rounded-xl transition-all duration-200"
                      >
                        {editingNote === note.id ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                              <input
                                type="text"
                                value={editNoteTitle}
                                onChange={(e) => setEditNoteTitle(e.target.value)}
                                className="w-full px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <div className="flex gap-2 items-center">
                                <button
                                  onClick={saveEditNote}
                                  className="w-10 h-10 flex items-center justify-center bg-transparent text-yellow-500 hover:scale-125 hover:opacity-80 active:scale-95 transition-all duration-150 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                                  aria-label="Save note"
                                  title="Save note"
                                >
                                  <MdEdit className="w-6 h-6" />
                                </button>
                                <button
                                  onClick={cancelEditNote}
                                  className="w-10 h-10 flex items-center justify-center bg-transparent text-red-500 hover:scale-125 hover:opacity-80 active:scale-95 transition-all duration-150 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                                  aria-label="Cancel edit"
                                  title="Cancel edit"
                                >
                                  <MdDelete className="w-6 h-6" />
                                </button>
                              </div>
                            </div>
                            <textarea
                              value={editNoteContent}
                              onChange={(e) => setEditNoteContent(e.target.value)}
                              placeholder="note content"
                              className="w-full px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                              rows={2}
                            />
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="font-semibold text-lg">{note.title}</h3>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => startEditNote(note)}
                                  className="w-10 h-10 flex items-center justify-center bg-transparent text-yellow-500 hover:scale-125 hover:opacity-80 active:scale-95 transition-all duration-150 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                                  aria-label="Edit note"
                                  title="Edit note"
                                >
                                  <MdEdit className="w-6 h-6" />
                                </button>
                                <button
                                  onClick={() => deleteCookingNote(note.id)}
                                  className="w-10 h-10 flex items-center justify-center bg-transparent text-red-500 hover:scale-125 hover:opacity-80 active:scale-95 transition-all duration-150 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                                  aria-label="Delete note"
                                  title="Delete note"
                                >
                                  <MdDelete className="w-6 h-6" />
                                </button>
                              </div>
                            </div>
                            <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap mb-2">
                              {note.content}
                            </p>
                            <div className="text-xs text-gray-500 dark:text-gray-500">
                              {new Date(note.updated_at).toLocaleDateString()} at {new Date(note.updated_at).toLocaleTimeString()}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
} 