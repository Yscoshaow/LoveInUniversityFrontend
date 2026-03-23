import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Plus,
  Search,
  BookOpen,
  Edit2,
  Trash2,
  Loader2,
  Save,
  X,
  Eye,
  EyeOff,
  Image,
  Tag,
  Coins,
  ChevronDown,
  ChevronUp,
  Pencil,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Shield,
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookSummary, BookCategory, CreateBookRequest, UpdateBookRequest } from '../../types';
import { adminBooksApi } from '../../lib/api';
import { useConfirm } from '@/hooks/useConfirm';

type EditorTab = 'books' | 'reviews';

interface BookEditorPageProps {
  onBack: () => void;
}

interface BookFormData {
  title: string;
  description: string;
  categoryId: number | null;
  content: string;
  priceCampusPoints: number;
  isPublished: boolean;
  coverImageUrl: string;
}

const initialFormData: BookFormData = {
  title: '',
  description: '',
  categoryId: null,
  content: '',
  priceCampusPoints: 0,
  isPublished: false,
  coverImageUrl: '',
};

export const BookEditorPage: React.FC<BookEditorPageProps> = ({ onBack }) => {
  const confirm = useConfirm();

  // Tab state
  const [activeTab, setActiveTab] = useState<EditorTab>('books');

  // List state
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Review state
  const [pendingBooks, setPendingBooks] = useState<BookSummary[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [reviewingBookId, setReviewingBookId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [previewingContent, setPreviewingContent] = useState<{ title: string; content: string } | null>(null);

  // Form state
  const [editingBook, setEditingBook] = useState<BookSummary | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<BookFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  // Category state
  const [categories, setCategories] = useState<BookCategory[]>([]);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  const fetchBooks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminBooksApi.getBooks({
        search: searchQuery || undefined,
        page,
      });
      setBooks(data.books);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to fetch books:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, page]);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await adminBooksApi.getCategories();
      setCategories(data);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const fetchPendingReviews = useCallback(async () => {
    try {
      setPendingLoading(true);
      const data = await adminBooksApi.getPendingReviews({ page: pendingPage });
      setPendingBooks(data.books);
      setPendingTotal(data.total);
    } catch (err) {
      console.error('Failed to fetch pending reviews:', err);
    } finally {
      setPendingLoading(false);
    }
  }, [pendingPage]);

  useEffect(() => {
    if (activeTab === 'reviews') {
      fetchPendingReviews();
    }
  }, [activeTab, fetchPendingReviews]);

  const handleApproveBook = async (bookId: number) => {
    setReviewSaving(true);
    try {
      await adminBooksApi.reviewBook(bookId, { approved: true });
      fetchPendingReviews();
    } catch (err) {
      console.error('Failed to approve book:', err);
    } finally {
      setReviewSaving(false);
    }
  };

  const handleRejectBook = async () => {
    if (!reviewingBookId) return;
    setReviewSaving(true);
    try {
      await adminBooksApi.reviewBook(reviewingBookId, {
        approved: false,
        rejectionReason: rejectionReason.trim() || undefined,
      });
      setShowRejectDialog(false);
      setReviewingBookId(null);
      setRejectionReason('');
      fetchPendingReviews();
    } catch (err) {
      console.error('Failed to reject book:', err);
    } finally {
      setReviewSaving(false);
    }
  };

  const handlePreviewPendingBook = async (book: BookSummary) => {
    try {
      const full = await adminBooksApi.getBook(book.id);
      setPreviewingContent({ title: full.title, content: (full as any).content || '' });
    } catch (err) {
      console.error('Failed to fetch book for preview:', err);
    }
  };

  const handleEdit = async (book: BookSummary) => {
    try {
      // Fetch full book detail (with content)
      const full = await adminBooksApi.getBook(book.id);
      setEditingBook(book);
      setFormData({
        title: full.title,
        description: full.description || '',
        categoryId: full.categoryId ?? null,
        content: (full as any).content || '',
        priceCampusPoints: full.priceCampusPoints,
        isPublished: full.isPublished,
        coverImageUrl: full.coverImageUrl || '',
      });
      setIsCreating(false);
      setPreviewMode(false);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch book detail:', err);
    }
  };

  const handleCreate = () => {
    setEditingBook(null);
    setFormData(initialFormData);
    setIsCreating(true);
    setPreviewMode(false);
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingBook(null);
    setIsCreating(false);
    setFormData(initialFormData);
    setError(null);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      setError('请输入图书标题');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isCreating) {
        const req: CreateBookRequest = {
          title: formData.title,
          description: formData.description || undefined,
          categoryId: formData.categoryId ?? undefined,
          content: formData.content,
          priceCampusPoints: formData.priceCampusPoints,
          isPublished: formData.isPublished,
          coverImageUrl: formData.coverImageUrl || undefined,
        };
        await adminBooksApi.createBook(req);
      } else if (editingBook) {
        const req: UpdateBookRequest = {
          title: formData.title,
          description: formData.description || undefined,
          categoryId: formData.categoryId,
          content: formData.content,
          priceCampusPoints: formData.priceCampusPoints,
          isPublished: formData.isPublished,
          coverImageUrl: formData.coverImageUrl || undefined,
        };
        await adminBooksApi.updateBook(editingBook.id, req);
      }
      handleCancelEdit();
      fetchBooks();
    } catch (err: any) {
      setError(err?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (bookId: number) => {
    if (!(await confirm({ title: '确认删除', description: '确定要删除这本图书吗？', destructive: true }))) return;
    try {
      await adminBooksApi.deleteBook(bookId);
      fetchBooks();
    } catch (err) {
      console.error('Failed to delete book:', err);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('封面图片不能超过5MB');
      return;
    }

    // Need a book ID to upload cover — save first if creating
    if (isCreating && !editingBook) {
      setError('请先保存图书，然后再上传封面');
      return;
    }

    if (!editingBook) return;

    setCoverUploading(true);
    try {
      const result = await adminBooksApi.uploadBookCover(editingBook.id, file);
      setFormData((prev) => ({ ...prev, coverImageUrl: result.imageUrl }));
    } catch (err: any) {
      setError(err?.message || '封面上传失败');
    } finally {
      setCoverUploading(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    setSavingCategory(true);
    try {
      await adminBooksApi.createCategory({
        name: newCategoryName.trim(),
        description: newCategoryDesc.trim() || undefined,
      });
      setNewCategoryName('');
      setNewCategoryDesc('');
      fetchCategories();
    } catch (err) {
      console.error('Failed to create category:', err);
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!(await confirm({ title: '确认删除', description: '确定要删除该分类吗？', destructive: true }))) return;
    try {
      await adminBooksApi.deleteCategory(id);
      fetchCategories();
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  };

  // ========== Form View ==========
  if (isCreating || editingBook) {
    return (
      <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 lg:max-w-[900px] lg:mx-auto lg:w-full">
        {/* Form Header */}
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center gap-3">
          <button
            onClick={handleCancelEdit}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="flex-1 font-semibold text-slate-800 dark:text-slate-100 text-sm">
            {isCreating ? '创建图书' : '编辑图书'}
          </h2>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            保存
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-3 p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-xs rounded-xl">{error}</div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">标题 *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
              placeholder="输入图书标题"
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
              placeholder="简短描述"
              rows={2}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">分类</label>
            <select
              value={formData.categoryId ?? ''}
              onChange={(e) =>
                setFormData((f) => ({
                  ...f,
                  categoryId: e.target.value ? Number(e.target.value) : null,
                }))
              }
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="">无分类</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Cover image */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">封面图片</label>
            {formData.coverImageUrl ? (
              <div className="relative w-32 h-24 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                <img
                  src={formData.coverImageUrl}
                  alt="cover"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => setFormData((f) => ({ ...f, coverImageUrl: '' }))}
                  className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white"
                >
                  <X size={10} />
                </button>
              </div>
            ) : editingBook ? (
              <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                {coverUploading ? (
                  <Loader2 size={14} className="animate-spin text-slate-400 dark:text-slate-500" />
                ) : (
                  <Image size={14} className="text-slate-400 dark:text-slate-500" />
                )}
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {coverUploading ? '上传中...' : '点击上传封面（最大5MB）'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  className="hidden"
                  disabled={coverUploading}
                />
              </label>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500">保存图书后可上传封面</p>
            )}
          </div>

          {/* Price */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              价格（校园点）
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={formData.priceCampusPoints}
                onChange={(e) =>
                  setFormData((f) => ({
                    ...f,
                    priceCampusPoints: Math.max(0, parseInt(e.target.value) || 0),
                  }))
                }
                className="w-32 px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <span className="text-xs text-slate-400 dark:text-slate-500">0 = 免费</span>
            </div>
          </div>

          {/* Published toggle */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">发布状态</label>
            <button
              onClick={() => setFormData((f) => ({ ...f, isPublished: !f.isPublished }))}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                formData.isPublished
                  ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
              }`}
            >
              {formData.isPublished ? '已发布' : '草稿'}
            </button>
          </div>

          {/* Content editor */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">内容（Markdown）</label>
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:text-indigo-400 transition-colors"
              >
                {previewMode ? <Pencil size={12} /> : <Eye size={12} />}
                {previewMode ? '编辑' : '预览'}
              </button>
            </div>

            {previewMode ? (
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-800 min-h-[300px]">
                <div className="prose prose-sm prose-slate dark:prose-invert max-w-none prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-code:bg-slate-100 dark:prose-code:bg-slate-700 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-img:rounded-xl">
                  <Markdown remarkPlugins={[remarkGfm]}>
                    {formData.content || '*暂无内容*'}
                  </Markdown>
                </div>
              </div>
            ) : (
              <textarea
                value={formData.content}
                onChange={(e) => setFormData((f) => ({ ...f, content: e.target.value }))}
                placeholder="使用 Markdown 编写图书内容..."
                rows={15}
                className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-y min-h-[300px]"
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ========== List View ==========
  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white px-4 pt-12 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/10 dark:bg-slate-800/10 rounded-full transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">图书管理</h1>
            <p className="text-xs text-white/60 mt-0.5">管理图书馆中的图书和分类</p>
          </div>
          {activeTab === 'books' && (
            <button
              onClick={handleCreate}
              className="p-2.5 bg-indigo-500 rounded-xl hover:bg-indigo-600 transition-colors"
            >
              <Plus size={18} />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex bg-white/10 dark:bg-slate-800/10 rounded-xl p-1 mb-3">
          <button
            onClick={() => setActiveTab('books')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'books'
                ? 'bg-white/20 dark:bg-slate-800/20 text-white'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            <BookOpen size={13} />
            图书管理
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'reviews'
                ? 'bg-white/20 dark:bg-slate-800/20 text-white'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            <Shield size={13} />
            审核管理
            {pendingTotal > 0 && (
              <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {pendingTotal}
              </span>
            )}
          </button>
        </div>

        {/* Search (books tab only) */}
        {activeTab === 'books' && (
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="搜索图书..."
              className="w-full pl-8 pr-4 py-2 bg-white/10 dark:bg-slate-800/10 rounded-xl text-sm text-white placeholder-white/40 border border-white/10 focus:outline-none focus:bg-white/15 dark:bg-slate-800/15"
            />
          </div>
        )}
      </div>

      {/* ========== Books Tab ========== */}
      {activeTab === 'books' && (
        <>
          {/* Category Manager Toggle */}
          <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
            <button
              onClick={() => setShowCategoryManager(!showCategoryManager)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Tag size={14} className="text-indigo-500 dark:text-indigo-400" />
                分类管理
              </span>
              {showCategoryManager ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showCategoryManager && (
              <div className="px-4 pb-3 space-y-2">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 rounded-lg px-3 py-2"
                  >
                    <div>
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{cat.name}</span>
                      {cat.description && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-2">{cat.description}</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-1 text-red-400 hover:text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 rounded transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="分类名称"
                    className="flex-1 px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    value={newCategoryDesc}
                    onChange={(e) => setNewCategoryDesc(e.target.value)}
                    placeholder="描述（可选）"
                    className="flex-1 px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleAddCategory}
                    disabled={savingCategory || !newCategoryName.trim()}
                    className="px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-xs font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50"
                  >
                    {savingCategory ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Book list */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={24} className="animate-spin text-indigo-400" />
              </div>
            ) : books.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
                <BookOpen size={36} className="mb-3 opacity-50" />
                <p className="text-sm">暂无图书</p>
                <button
                  onClick={handleCreate}
                  className="mt-3 px-4 py-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-xs font-medium rounded-xl hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 transition-colors"
                >
                  创建第一本图书
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {books.map((book) => (
                  <div
                    key={book.id}
                    className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm"
                  >
                    <div className="flex gap-3 p-3">
                      <div className="w-16 h-20 rounded-lg overflow-hidden shrink-0">
                        {book.coverImageUrl ? (
                          <img src={book.coverImageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center">
                            <BookOpen size={16} className="text-white/70" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{book.title}</h3>
                        {book.categoryName && (
                          <span className="text-[10px] text-indigo-500 dark:text-indigo-400">{book.categoryName}</span>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              book.isPublished
                                ? 'bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {book.isPublished ? '已发布' : '草稿'}
                          </span>
                          {book.priceCampusPoints <= 0 ? (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                              免费
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                              <Coins size={8} />
                              {book.priceCampusPoints}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-0.5">
                            <Eye size={8} />
                            {book.viewCount}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <button
                          onClick={() => handleEdit(book)}
                          className="p-2 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:bg-indigo-950 rounded-lg transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(book.id)}
                          className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {total > 20 && (
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs disabled:opacity-50"
                    >
                      上一页
                    </button>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {page} / {Math.ceil(total / 20)}
                    </span>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page * 20 >= total}
                      className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs disabled:opacity-50"
                    >
                      下一页
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ========== Reviews Tab ========== */}
      {activeTab === 'reviews' && (
        <div className="flex-1 overflow-y-auto p-4">
          {pendingLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-indigo-400" />
            </div>
          ) : pendingBooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
              <CheckCircle size={36} className="mb-3 opacity-50" />
              <p className="text-sm">暂无待审核的图书</p>
              <p className="text-xs mt-1">所有用户上传都已处理完毕</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
                共 {pendingTotal} 本待审核
              </p>

              {pendingBooks.map((book) => (
                <div
                  key={book.id}
                  className="bg-white dark:bg-slate-800 rounded-xl border border-amber-100 dark:border-amber-900 overflow-hidden shadow-sm"
                >
                  <div className="flex gap-3 p-3">
                    {/* Thumbnail */}
                    <div className="w-14 h-18 rounded-lg overflow-hidden shrink-0">
                      {book.coverImageUrl ? (
                        <img src={book.coverImageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                          <BookOpen size={14} className="text-white/70" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{book.title}</h3>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {book.authorName && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                            <User size={8} />
                            {book.authorName}
                          </span>
                        )}
                        {book.categoryName && (
                          <span className="text-[10px] text-indigo-500 dark:text-indigo-400">{book.categoryName}</span>
                        )}
                        {book.seriesName && (
                          <span className="text-[10px] text-violet-500 dark:text-violet-400">{book.seriesName}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                          <Clock size={8} />
                          待审核
                        </span>
                        {book.priceCampusPoints > 0 && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                            <Coins size={8} />
                            {book.priceCampusPoints}
                          </span>
                        )}
                      </div>
                      {book.description && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 truncate">{book.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 px-3 pb-3">
                    <button
                      onClick={() => handlePreviewPendingBook(book)}
                      className="flex-1 py-2 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1"
                    >
                      <Eye size={12} />
                      预览
                    </button>
                    <button
                      onClick={() => handleApproveBook(book.id)}
                      disabled={reviewSaving}
                      className="flex-1 py-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 dark:bg-emerald-950 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      {reviewSaving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                      通过
                    </button>
                    <button
                      onClick={() => {
                        setReviewingBookId(book.id);
                        setRejectionReason('');
                        setShowRejectDialog(true);
                      }}
                      disabled={reviewSaving}
                      className="flex-1 py-2 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <XCircle size={12} />
                      拒绝
                    </button>
                  </div>
                </div>
              ))}

              {pendingTotal > 20 && (
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => setPendingPage((p) => Math.max(1, p - 1))}
                    disabled={pendingPage <= 1}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs disabled:opacity-50"
                  >
                    上一页
                  </button>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {pendingPage} / {Math.ceil(pendingTotal / 20)}
                  </span>
                  <button
                    onClick={() => setPendingPage((p) => p + 1)}
                    disabled={pendingPage * 20 >= pendingTotal}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs disabled:opacity-50"
                  >
                    下一页
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Rejection reason dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">拒绝原因</h3>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="请输入拒绝原因（将通知作者）..."
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowRejectDialog(false); setReviewingBookId(null); }}
                className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                取消
              </button>
              <button
                onClick={handleRejectBook}
                disabled={reviewSaving}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {reviewSaving ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                确认拒绝
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content preview modal */}
      {previewingContent && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-800">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <button
              onClick={() => setPreviewingContent(null)}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"
            >
              <ArrowLeft size={16} />
            </button>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate flex-1">{previewingContent.title}</h3>
            <button
              onClick={() => setPreviewingContent(null)}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
              <Markdown remarkPlugins={[remarkGfm]}>
                {previewingContent.content || '*暂无内容*'}
              </Markdown>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
