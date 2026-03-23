import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  Search,
  Package,
  Edit2,
  Trash2,
  Loader2,
  Save,
  X,
  Coins,
  Star,
  Gift,
  Wrench,
  Beaker,
  Sparkles,
} from 'lucide-react';
import { Item, ItemType, ItemRarity, BuffBackend } from '../../types';
import { adminApi } from '../../lib/api';
import { ImageUploadCompact } from '../ui/ImageUpload';
import { useConfirm } from '@/hooks/useConfirm';

interface ItemEditorPageProps {
  onBack: () => void;
}

interface ItemFormData {
  name: string;
  description: string;
  iconUrl: string;
  itemType: ItemType;
  rarity: ItemRarity;
  priceCampusPoints: number;
  priceCredits: number;
  maxStack: number;
  useCooldownMinutes: number;
  effectDurationMinutes: number;
  isTradeable: boolean;
  isAvailable: boolean;
  buffIds: number[];
}

const initialFormData: ItemFormData = {
  name: '',
  description: '',
  iconUrl: '',
  itemType: 'CONSUMABLE',
  rarity: 'COMMON',
  priceCampusPoints: 100,
  priceCredits: 0,
  maxStack: 99,
  useCooldownMinutes: 0,
  effectDurationMinutes: 0,
  isTradeable: true,
  isAvailable: true,
  buffIds: [],
};

const ITEM_TYPES: { value: ItemType; label: string; icon: React.ReactNode }[] = [
  { value: 'CONSUMABLE', label: '消耗品', icon: <Beaker size={16} /> },
  { value: 'EQUIPMENT', label: '装备', icon: <Wrench size={16} /> },
  { value: 'MATERIAL', label: '材料', icon: <Package size={16} /> },
  { value: 'GIFT', label: '礼物', icon: <Gift size={16} /> },
];

const RARITIES: { value: ItemRarity; label: string; color: string }[] = [
  { value: 'COMMON', label: '普通', color: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' },
  { value: 'UNCOMMON', label: '优良', color: 'bg-green-100 text-green-600 dark:text-green-400' },
  { value: 'RARE', label: '稀有', color: 'bg-blue-100 text-blue-600 dark:text-blue-400' },
  { value: 'EPIC', label: '史诗', color: 'bg-purple-100 text-purple-600 dark:text-purple-400' },
  { value: 'LEGENDARY', label: '传说', color: 'bg-amber-100 text-amber-600 dark:text-amber-400' },
];

export const ItemEditorPage: React.FC<ItemEditorPageProps> = ({ onBack }) => {
  const confirm = useConfirm();

  const [items, setItems] = useState<Item[]>([]);
  const [buffs, setBuffs] = useState<BuffBackend[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<ItemFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemsData, buffsData] = await Promise.all([
        adminApi.getItems(),
        adminApi.getBuffs(true),
      ]);
      setItems(itemsData);
      setBuffs(buffsData);
    } catch (err) {
      console.error('Failed to fetch items:', err);
      setError('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = () => {
    setFormData(initialFormData);
    setIsCreating(true);
    setEditingItem(null);
  };

  const handleEdit = (item: Item) => {
    setFormData({
      name: item.name,
      description: item.description || '',
      iconUrl: item.iconUrl || '',
      itemType: item.itemType,
      rarity: item.rarity,
      priceCampusPoints: item.priceCampusPoints,
      priceCredits: item.priceCredits,
      maxStack: item.maxStack,
      useCooldownMinutes: item.useCooldownMinutes,
      effectDurationMinutes: item.effectDurationMinutes,
      isTradeable: item.isTradeable,
      isAvailable: item.isAvailable,
      buffIds: item.buffs.map(b => b.id),
    });
    setEditingItem(item);
    setIsCreating(false);
  };

  const handleCancel = () => {
    setEditingItem(null);
    setIsCreating(false);
    setFormData(initialFormData);
    setError(null);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('请输入道具名称');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const request = {
        name: formData.name,
        description: formData.description || undefined,
        iconUrl: formData.iconUrl || undefined,
        itemType: formData.itemType,
        rarity: formData.rarity,
        priceCampusPoints: formData.priceCampusPoints,
        priceCredits: formData.priceCredits,
        maxStack: formData.maxStack,
        useCooldownMinutes: formData.useCooldownMinutes,
        effectDurationMinutes: formData.effectDurationMinutes,
        isTradeable: formData.isTradeable,
        isAvailable: formData.isAvailable,
        buffIds: formData.buffIds,
      };

      if (isCreating) {
        await adminApi.createItem(request);
      } else if (editingItem) {
        await adminApi.updateItem(editingItem.id, request);
      }

      handleCancel();
      await fetchData();
    } catch (err: any) {
      setError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (itemId: number) => {
    if (!(await confirm({ title: '确认删除', description: '确定要删除这个道具吗？', destructive: true }))) {
      return;
    }

    try {
      await adminApi.deleteItem(itemId);
      await fetchData();
    } catch (err: any) {
      setError(err.message || '删除失败');
    }
  };

  const getItemTypeIcon = (type: ItemType) => {
    const found = ITEM_TYPES.find(t => t.value === type);
    return found?.icon || <Package size={16} />;
  };

  const getRarityStyle = (rarity: ItemRarity) => {
    const found = RARITIES.find(r => r.value === rarity);
    return found?.color || 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
  };

  const getRarityLabel = (rarity: ItemRarity) => {
    const found = RARITIES.find(r => r.value === rarity);
    return found?.label || rarity;
  };

  const toggleBuff = (buffId: number) => {
    setFormData(prev => ({
      ...prev,
      buffIds: prev.buffIds.includes(buffId)
        ? prev.buffIds.filter(id => id !== buffId)
        : [...prev.buffIds, buffId]
    }));
  };

  // Form view
  if (isCreating || editingItem) {
    return (
      <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col lg:max-w-[900px] lg:mx-auto lg:w-full">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 p-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleCancel}
              className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              <X size={20} className="text-slate-600 dark:text-slate-300" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {isCreating ? '创建道具' : '编辑道具'}
              </h1>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-primary text-white rounded-xl font-medium flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              保存
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                道具名称 <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                placeholder="输入道具名称"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                道具描述
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none resize-none"
                rows={3}
                placeholder="输入道具描述"
              />
            </div>

            {/* Icon Upload */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                道具图标
              </label>
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <ImageUploadCompact
                  value={formData.iconUrl}
                  onChange={(url) => setFormData(prev => ({ ...prev, iconUrl: url }))}
                  folder="items"
                />
              </div>
            </div>

            {/* Item Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                道具类型
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ITEM_TYPES.map(type => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, itemType: type.value }))}
                    className={`p-3 rounded-xl border-2 flex items-center gap-2 transition-all ${
                      formData.itemType === type.value
                        ? 'border-primary bg-primary/5'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    <span className={formData.itemType === type.value ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}>
                      {type.icon}
                    </span>
                    <span className={`text-sm font-medium ${
                      formData.itemType === type.value ? 'text-primary' : 'text-slate-600 dark:text-slate-300'
                    }`}>
                      {type.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Rarity */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                稀有度
              </label>
              <div className="flex flex-wrap gap-2">
                {RARITIES.map(rarity => (
                  <button
                    key={rarity.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, rarity: rarity.value }))}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      formData.rarity === rarity.value
                        ? rarity.color + ' ring-2 ring-offset-2 ring-primary'
                        : rarity.color + ' opacity-60 hover:opacity-100'
                    }`}
                  >
                    {rarity.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Prices */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  校园点数价格
                </label>
                <input
                  type="number"
                  value={formData.priceCampusPoints}
                  onChange={(e) => setFormData(prev => ({ ...prev, priceCampusPoints: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                  min={0}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  学分价格
                </label>
                <input
                  type="number"
                  value={formData.priceCredits}
                  onChange={(e) => setFormData(prev => ({ ...prev, priceCredits: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                  min={0}
                />
              </div>
            </div>

            {/* Stack & Cooldown */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  最大堆叠数
                </label>
                <input
                  type="number"
                  value={formData.maxStack}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxStack: parseInt(e.target.value) || 1 }))}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                  min={1}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  使用冷却（分钟）
                </label>
                <input
                  type="number"
                  value={formData.useCooldownMinutes}
                  onChange={(e) => setFormData(prev => ({ ...prev, useCooldownMinutes: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                  min={0}
                />
              </div>
            </div>

            {/* Effect Duration */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                效果持续时间（分钟）
              </label>
              <input
                type="number"
                value={formData.effectDurationMinutes}
                onChange={(e) => setFormData(prev => ({ ...prev, effectDurationMinutes: parseInt(e.target.value) || 0 }))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                min={0}
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">0 表示永久或一次性</p>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-200">可交易</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">允许赠送给其他用户</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, isTradeable: !prev.isTradeable }))}
                  className={`w-12 h-7 rounded-full transition-colors ${
                    formData.isTradeable ? 'bg-primary' : 'bg-slate-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white dark:bg-slate-800 rounded-full shadow-sm transform transition-transform ${
                    formData.isTradeable ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-200">商店上架</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">在商店中显示并可购买</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, isAvailable: !prev.isAvailable }))}
                  className={`w-12 h-7 rounded-full transition-colors ${
                    formData.isAvailable ? 'bg-primary' : 'bg-slate-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white dark:bg-slate-800 rounded-full shadow-sm transform transition-transform ${
                    formData.isAvailable ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>

            {/* Buff Binding */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                绑定Buff
              </label>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">使用此道具时将激活选中的Buff效果</p>
              {buffs.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
                  <Sparkles size={24} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm text-slate-400 dark:text-slate-500">暂无可用Buff</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">请先在Buff管理中创建Buff</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto">
                  {buffs.filter(b => b.isActive).map(buff => (
                    <label
                      key={buff.id}
                      className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={formData.buffIds.includes(buff.id)}
                        onChange={() => toggleBuff(buff.id)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary/30"
                      />
                      <div className="flex-1">
                        <span className="text-sm text-slate-700 dark:text-slate-200">{buff.name}</span>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {buff.buffType === 'TIME_REDUCTION_PERCENT' ? '时间减少' :
                           buff.buffType === 'VALUE_REDUCTION_PERCENT' ? '目标值减少' : '目标值加成'}
                          : {buff.value}{buff.buffType.includes('PERCENT') ? '%' : ''}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {formData.buffIds.length > 0 && (
                <p className="text-xs text-primary mt-1">已选择 {formData.buffIds.length} 个Buff</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 p-4">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">道具管理</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500">{items.length} 个道具</p>
          </div>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-primary text-white rounded-xl font-medium flex items-center gap-2 hover:bg-primary/90"
          >
            <Plus size={18} />
            新建
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="搜索道具..."
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <Package size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 dark:text-slate-400">暂无道具</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">点击新建按钮创建道具</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center shrink-0">
                    {item.iconUrl ? (
                      <img src={item.iconUrl} alt="" className="w-8 h-8 object-contain" />
                    ) : (
                      <span className="text-amber-500 dark:text-amber-400">
                        {getItemTypeIcon(item.itemType)}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate">{item.name}</h3>
                      <span className={`px-2 py-0.5 text-[10px] rounded-full ${getRarityStyle(item.rarity)}`}>
                        {getRarityLabel(item.rarity)}
                      </span>
                      {!item.isAvailable && (
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] rounded-full">
                          未上架
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <Coins size={12} />
                        <span>{item.priceCampusPoints}</span>
                      </div>
                      {item.priceCredits > 0 && (
                        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                          <Star size={12} />
                          <span>{item.priceCredits}</span>
                        </div>
                      )}
                      {item.buffs.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-purple-500 dark:text-purple-400">
                          <Sparkles size={12} />
                          <span>{item.buffs.length}个Buff</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(item)}
                      className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                      <Edit2 size={16} className="text-slate-600 dark:text-slate-300" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                    >
                      <Trash2 size={16} className="text-red-500 dark:text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ItemEditorPage;
