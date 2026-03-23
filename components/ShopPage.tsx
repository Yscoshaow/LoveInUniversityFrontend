import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { useQueryClient } from '@tanstack/react-query';
import { ShopItem, UserItem, UserCurrency, RARITY_NAMES, ItemRarity, SpecialShopItem, UserSpecialItem, SpecialItemType, SignedAgreementItem } from '../types';
import { itemsApi, specialItemsApi, supervisionApi, ActiveEffectsResponse } from '../lib/api';
import { queryKeys } from '../lib/query-client';
import {
  ShoppingBag,
  Backpack,
  Coins,
  Zap,
  Gift,
  Sparkles,
  Check,
  PackageOpen,
  X,
  Loader2,
  RefreshCw,
  Key,
  FileText,
  ScrollText,
  Shield,
  Trash2,
  Box,
  Hourglass,
  Wine,
  Radio,
  Disc,
  Diamond
} from 'lucide-react';
import { SupervisionPermitUseModal, KeyBoxUseModal } from './features';

// Default item icon when no iconUrl is provided
const DEFAULT_ITEM_ICON = 'https://cdn-icons-png.flaticon.com/512/685/685388.png';

interface ShopPageProps {
  onItemModalChange?: (isOpen: boolean) => void;
}

// Helper to check if item is a UserItem
const isUserItem = (item: ShopItem | UserItem): item is UserItem => {
  return 'userId' in item;
};

// Helper to format remaining time
const formatRemainingTime = (expiresAt: string): string => {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffMs = expires.getTime() - now.getTime();

  if (diffMs <= 0) return 'Expired';

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export const ShopPage: React.FC<ShopPageProps> = ({ onItemModalChange }) => {
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollDirection(scrollRef);
  const [activeTab, setActiveTab] = useState<'shop' | 'inventory'>('shop');
  const [selectedItem, setSelectedItem] = useState<ShopItem | UserItem | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currency, setCurrency] = useState<UserCurrency>({ credits: 0, campusPoints: 0 });

  // API data states
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [inventory, setInventory] = useState<UserItem[]>([]);
  const [activeEffects, setActiveEffects] = useState<ActiveEffectsResponse | null>(null);
  const [specialShopItems, setSpecialShopItems] = useState<SpecialShopItem[]>([]);
  const [specialInventory, setSpecialInventory] = useState<UserSpecialItem[]>([]);
  const [signedAgreements, setSignedAgreements] = useState<SignedAgreementItem[]>([]);

  // Loading states
  const [isLoadingShop, setIsLoadingShop] = useState(true);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [isLoadingCurrency, setIsLoadingCurrency] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isUsing, setIsUsing] = useState(false);
  const [isLoadingSpecialShop, setIsLoadingSpecialShop] = useState(true);
  const [isCancellingAgreement, setIsCancellingAgreement] = useState<number | null>(null);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Supervision permit modal state
  const [showSupervisionModal, setShowSupervisionModal] = useState(false);

  // Key box modal state
  const [showKeyBoxModal, setShowKeyBoxModal] = useState(false);

  // Selected special item for detail drawer
  const [selectedSpecialItem, setSelectedSpecialItem] = useState<SpecialShopItem | UserSpecialItem | null>(null);
  const [isSpecialModalVisible, setIsSpecialModalVisible] = useState(false);

  // Selected signed agreement for detail drawer
  const [selectedAgreement, setSelectedAgreement] = useState<SignedAgreementItem | null>(null);
  const [isAgreementModalVisible, setIsAgreementModalVisible] = useState(false);

  // Fetch shop items
  const fetchShopItems = useCallback(async () => {
    setIsLoadingShop(true);
    try {
      const items = await itemsApi.getShopItems();
      setShopItems(items);
      setError(null);
    } catch (err) {
      setError('Failed to load shop items');
      console.error('Failed to load shop items:', err);
    } finally {
      setIsLoadingShop(false);
    }
  }, []);

  // Fetch inventory
  const fetchInventory = useCallback(async () => {
    setIsLoadingInventory(true);
    try {
      const items = await itemsApi.getInventory();
      setInventory(items);
      setError(null);
    } catch (err) {
      setError('Failed to load inventory');
      console.error('Failed to load inventory:', err);
    } finally {
      setIsLoadingInventory(false);
    }
  }, []);

  // Fetch currency
  const fetchCurrency = useCallback(async () => {
    setIsLoadingCurrency(true);
    try {
      const currencyData = await itemsApi.getCurrency();
      setCurrency(currencyData);
    } catch (err) {
      console.error('Failed to load currency:', err);
    } finally {
      setIsLoadingCurrency(false);
    }
  }, []);

  // Fetch active effects
  const fetchActiveEffects = useCallback(async () => {
    try {
      const effects = await itemsApi.getActiveEffects();
      setActiveEffects(effects);
    } catch (err) {
      console.error('Failed to load active effects:', err);
    }
  }, []);

  // Fetch special shop items
  const fetchSpecialShopItems = useCallback(async () => {
    setIsLoadingSpecialShop(true);
    try {
      const items = await specialItemsApi.getShopItems();
      setSpecialShopItems(items);
    } catch (err) {
      console.error('Failed to load special shop items:', err);
    } finally {
      setIsLoadingSpecialShop(false);
    }
  }, []);

  // Fetch special inventory
  const fetchSpecialInventory = useCallback(async () => {
    try {
      const items = await specialItemsApi.getInventory();
      setSpecialInventory(items);
    } catch (err) {
      console.error('Failed to load special inventory:', err);
    }
  }, []);

  // Fetch signed agreements (supervision contracts held by supervisor)
  const fetchSignedAgreements = useCallback(async () => {
    try {
      const agreements = await supervisionApi.getSignedAgreements();
      setSignedAgreements(agreements);
    } catch (err) {
      console.error('Failed to load signed agreements:', err);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchShopItems();
    fetchSpecialShopItems();
    fetchCurrency();
    fetchActiveEffects();
  }, [fetchShopItems, fetchSpecialShopItems, fetchCurrency, fetchActiveEffects]);

  // Fetch inventory when tab changes to inventory
  useEffect(() => {
    if (activeTab === 'inventory') {
      if (inventory.length === 0) {
        fetchInventory();
      }
      fetchSpecialInventory();
      fetchSignedAgreements();
    }
  }, [activeTab, inventory.length, fetchInventory, fetchSpecialInventory, fetchSignedAgreements]);

  const openItemModal = (item: ShopItem | UserItem) => {
    setSelectedItem(item);
    setIsModalVisible(true);
    onItemModalChange?.(true);
  };

  const closeItemModal = () => {
    setIsModalVisible(false);
    onItemModalChange?.(false);
    setTimeout(() => {
      setSelectedItem(null);
    }, 300);
  };

  const openSpecialItemModal = (item: SpecialShopItem | UserSpecialItem) => {
    setSelectedSpecialItem(item);
    setIsSpecialModalVisible(true);
    onItemModalChange?.(true);
  };

  const closeSpecialItemModal = () => {
    setIsSpecialModalVisible(false);
    onItemModalChange?.(false);
    setTimeout(() => {
      setSelectedSpecialItem(null);
    }, 300);
  };

  // Handle supervision modal open - also hides navbar
  const openSupervisionModal = () => {
    setShowSupervisionModal(true);
    onItemModalChange?.(true);
  };

  const closeSupervisionModal = () => {
    setShowSupervisionModal(false);
    onItemModalChange?.(false);
  };

  const openKeyBoxModal = () => {
    setShowKeyBoxModal(true);
    onItemModalChange?.(true);
  };

  const closeKeyBoxModal = () => {
    setShowKeyBoxModal(false);
    onItemModalChange?.(false);
  };

  const openAgreementModal = (agreement: SignedAgreementItem) => {
    setSelectedAgreement(agreement);
    setIsAgreementModalVisible(true);
    onItemModalChange?.(true);
  };

  const closeAgreementModal = () => {
    setIsAgreementModalVisible(false);
    onItemModalChange?.(false);
    setTimeout(() => {
      setSelectedAgreement(null);
    }, 300);
  };

  const handleCancelAgreement = async (agreementId: number) => {
    setIsCancellingAgreement(agreementId);
    try {
      await supervisionApi.cancel(agreementId);
      closeAgreementModal();
      await fetchSignedAgreements();
    } catch (err: any) {
      setError(err.message || '解除合约失败');
    } finally {
      setIsCancellingAgreement(null);
    }
  };

  // Purchase item
  const handlePurchase = async () => {
    if (!selectedItem || isUserItem(selectedItem)) return;

    setIsPurchasing(true);
    try {
      await itemsApi.purchaseItem({
        itemId: selectedItem.item.id,
        quantity: 1,
        useCredits: false
      });

      // Refresh data
      await Promise.all([fetchShopItems(), fetchCurrency(), fetchInventory()]);
      closeItemModal();
    } catch (err: any) {
      setError(err.message || 'Failed to purchase item');
    } finally {
      setIsPurchasing(false);
    }
  };

  // Use item
  const handleUseItem = async () => {
    if (!selectedItem || !isUserItem(selectedItem)) return;

    setIsUsing(true);
    try {
      await itemsApi.useItem(selectedItem.item.id);

      // Refresh data
      await Promise.all([fetchInventory(), fetchActiveEffects()]);
      // Invalidate equipped items query so ProfilePage updates without refresh
      queryClient.invalidateQueries({ queryKey: queryKeys.items.equipped() });
      closeItemModal();
    } catch (err: any) {
      setError(err.message || 'Failed to use item');
    } finally {
      setIsUsing(false);
    }
  };

  // --- Render Helpers ---

  const renderRarity = (rarity: ItemRarity) => {
    const colorClasses: Record<ItemRarity, string> = {
      COMMON: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
      UNCOMMON: 'bg-green-100 text-green-600 dark:text-green-400',
      RARE: 'bg-blue-100 text-blue-600 dark:text-blue-400',
      EPIC: 'bg-purple-100 text-purple-600 dark:text-purple-400',
      LEGENDARY: 'bg-amber-100 text-amber-600 dark:text-amber-400'
    };
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${colorClasses[rarity] || colorClasses.COMMON}`}>
        {RARITY_NAMES[rarity] || rarity}
      </span>
    );
  };

  const renderShopItemCard = (shopItem: ShopItem) => {
    const item = shopItem.item;
    return (
      <div
        key={item.id}
        onClick={() => openItemModal(shopItem)}
        className="bg-white dark:bg-slate-800 rounded-2xl p-2.5 shadow-soft border border-slate-50 dark:border-slate-700 relative group cursor-pointer active:scale-95 transition-transform"
      >
        {/* Owned Badge */}
        {shopItem.ownedQuantity > 0 && (
          <div className="absolute top-2 right-2 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-md z-10">
            拥有 {shopItem.ownedQuantity}
          </div>
        )}

        <div className="rounded-xl bg-slate-50 dark:bg-slate-900 mb-2 flex items-center justify-center p-3 relative overflow-hidden h-20">
          <img
            src={item.iconUrl || DEFAULT_ITEM_ICON}
            alt={item.name}
            className="h-full object-contain drop-shadow-md group-hover:scale-110 transition-transform duration-300"
          />
        </div>

        <div>
          <h3 className="text-[11px] font-bold text-slate-800 dark:text-slate-100 mb-0.5 truncate">{item.name}</h3>
          <div className="flex items-center gap-1">
            <Coins size={10} className="text-amber-500 dark:text-amber-400"/>
            <span className="text-[11px] font-bold text-amber-500 dark:text-amber-400">
              {item.priceCampusPoints}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderInventoryItemCard = (userItem: UserItem) => {
    const item = userItem.item;
    return (
      <div
        key={userItem.id}
        onClick={() => openItemModal(userItem)}
        className="bg-white dark:bg-slate-800 rounded-2xl p-2.5 shadow-soft border border-slate-50 dark:border-slate-700 relative group cursor-pointer active:scale-95 transition-transform"
      >
        {/* Quantity Badge */}
        <div className="absolute top-2 right-2 bg-slate-900 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md z-10">
          {userItem.quantity}
        </div>

        {/* Equipped Badge */}
        {userItem.isEquipped && (
          <div className="absolute top-2 left-2 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-md z-10 flex items-center gap-0.5">
            <Check size={7} /> 装备中
          </div>
        )}

        <div className="rounded-xl bg-slate-50 dark:bg-slate-900 mb-2 flex items-center justify-center p-3 relative overflow-hidden h-20">
          <img
            src={item.iconUrl || DEFAULT_ITEM_ICON}
            alt={item.name}
            className="h-full object-contain drop-shadow-md group-hover:scale-110 transition-transform duration-300"
          />
        </div>

        <div>
          <h3 className="text-[11px] font-bold text-slate-800 dark:text-slate-100 mb-0.5 truncate">{item.name}</h3>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{item.itemType}</div>
        </div>
      </div>
    );
  };

  // Purchase special item
  const handlePurchaseSpecialItem = async (item: SpecialShopItem) => {
    setIsPurchasing(true);
    try {
      await specialItemsApi.purchaseItem({
        itemType: item.item.type,
        quantity: 1
      });
      // Refresh data
      await Promise.all([fetchSpecialShopItems(), fetchCurrency(), fetchSpecialInventory()]);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to purchase item');
    } finally {
      setIsPurchasing(false);
    }
  };

  const renderSpecialItemCard = (shopItem: SpecialShopItem) => {
    const item = shopItem.item;
    const iconMap: Record<string, React.ReactNode> = {
      'MASTER_KEY': <Key size={24} className="text-white" />,
      'SUPERVISION_PERMIT': <FileText size={24} className="text-white" />,
      'KEY_BOX': <Box size={24} className="text-white" />,
      'STICKY_NOTE': <ScrollText size={24} className="text-white" />,
      'PHOTO_PAPER': <Gift size={24} className="text-white" />,
      'TIME_CAPSULE': <Hourglass size={24} className="text-white" />,
      'DRIFT_BOTTLE': <Wine size={24} className="text-white" />,
      'BEACON': <Radio size={24} className="text-white" />,
      'BEACON_BASE_IRON': <Disc size={24} className="text-white" />,
      'BEACON_BASE_GOLD': <Disc size={24} className="text-white" />,
      'BEACON_BASE_DIAMOND': <Diamond size={24} className="text-white" />,
      'POST_PIN': <span className="text-2xl">📌</span>,
      'ANONYMOUS_TOKEN': <span className="text-2xl">🎭</span>
    };
    const icon = iconMap[item.type] || <Key size={24} className="text-white" />;

    return (
      <div
        key={item.type}
        onClick={() => openSpecialItemModal(shopItem)}
        className="bg-gradient-to-br from-purple-50 dark:from-purple-950 to-violet-100 dark:to-violet-900 rounded-2xl p-2.5 shadow-soft border border-purple-200 dark:border-purple-800 relative group cursor-pointer active:scale-95 transition-transform"
      >
        {/* Owned Badge */}
        {shopItem.ownedQuantity > 0 && (
          <div className="absolute top-2 right-2 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-md z-10">
            拥有 {shopItem.ownedQuantity}
          </div>
        )}

        <div className="rounded-xl bg-white/60 dark:bg-slate-800/60 mb-2 flex items-center justify-center p-2 relative overflow-hidden h-20">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
            {icon}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1 mb-0.5">
            <h3 className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate flex-1">{item.name}</h3>
            {renderRarity(item.rarity)}
          </div>
          <div className="flex items-center gap-1">
            <Coins size={10} className="text-amber-500 dark:text-amber-400"/>
            <span className="text-[11px] font-bold text-amber-500 dark:text-amber-400">
              {item.priceCampusPoints}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Helper to get special item info
  const getSpecialItemInfo = (itemType: string) => {
    const itemInfoMap: Record<string, { name: string; description: string; rarity: ItemRarity; icon: React.ReactNode; canUse: boolean }> = {
      'MASTER_KEY': {
        name: '万能钥匙',
        description: '可在锁定详情页中使用进行紧急解锁',
        rarity: 'EPIC' as ItemRarity,
        icon: <Key size={24} className="text-white" />,
        canUse: false  // 在锁定详情页使用
      },
      'SUPERVISION_PERMIT': {
        name: '监督协议书',
        description: '用于与他人建立监督关系。使用后选择身份（监督人/被监督人），搜索对方并发起签署请求。双方指纹确认后生效。',
        rarity: 'EPIC' as ItemRarity,
        icon: <FileText size={24} className="text-white" />,
        canUse: true
      },
      'KEY_BOX': {
        name: '钥匙盒',
        description: '将你的自锁转为私有锁，选择一个用户成为主管理者（完全控制权限）。使用前必须拥有活跃的自锁。',
        rarity: 'RARE' as ItemRarity,
        icon: <Box size={24} className="text-white" />,
        canUse: true
      },
      'STICKY_NOTE': {
        name: '便签',
        description: '在校园漫步地图上放置一张便签，写下你想说的话，等待路过的人发现。',
        rarity: 'COMMON' as ItemRarity,
        icon: <ScrollText size={24} className="text-white" />,
        canUse: false
      },
      'PHOTO_PAPER': {
        name: '相纸',
        description: '在校园漫步地图上放置一张相纸，附上照片和留言，分享你的校园记忆。',
        rarity: 'COMMON' as ItemRarity,
        icon: <Gift size={24} className="text-white" />,
        canUse: false
      },
      'TIME_CAPSULE': {
        name: '时间胶囊',
        description: '在校园地图上埋下一颗时间胶囊，设定未来的开启日期。到期前无人能打开。',
        rarity: 'RARE' as ItemRarity,
        icon: <Hourglass size={24} className="text-white" />,
        canUse: false
      },
      'DRIFT_BOTTLE': {
        name: '漂流瓶',
        description: '在校园地图上放置一个漂流瓶，它会每天随机漂移，等待有缘人拾取。',
        rarity: 'COMMON' as ItemRarity,
        icon: <Wine size={24} className="text-white" />,
        canUse: false
      },
      'BEACON': {
        name: '信标',
        description: '放置在校园地图上，配合底座使用。信标主人和接触者可以看到覆盖范围内所有物品。其他人进入范围可看到信标，50m内交互成为接触者。收回时信标和底座都会归还。',
        rarity: 'RARE' as ItemRarity,
        icon: <Radio size={24} className="text-white" />,
        canUse: false
      },
      'BEACON_BASE_IRON': {
        name: '铁质信标底座',
        description: '为信标提供 5km 覆盖半径。放置信标时消耗，可更换底座（旧底座归还）。',
        rarity: 'UNCOMMON' as ItemRarity,
        icon: <Disc size={24} className="text-white" />,
        canUse: false
      },
      'BEACON_BASE_GOLD': {
        name: '金制信标底座',
        description: '为信标提供 10km 覆盖半径。放置信标时消耗，可更换底座（旧底座归还）。',
        rarity: 'RARE' as ItemRarity,
        icon: <Disc size={24} className="text-white" />,
        canUse: false
      },
      'BEACON_BASE_DIAMOND': {
        name: '钻石信标底座',
        description: '为信标提供 15km 覆盖半径。放置信标时消耗，可更换底座（旧底座归还）。',
        rarity: 'EPIC' as ItemRarity,
        icon: <Diamond size={24} className="text-white" />,
        canUse: false
      },
      'POST_PIN': {
        name: '置顶卡',
        description: '使用后将你的帖子置顶 24 小时。可多次使用同一帖子，每次延长 24 小时。',
        rarity: 'UNCOMMON' as ItemRarity,
        icon: <span className="text-2xl">📌</span>,
        canUse: false
      },
      'ANONYMOUS_TOKEN': {
        name: '匿名令牌',
        description: '匿名发帖时自动消耗一枚。让其他用户无法看到你的身份。',
        rarity: 'COMMON' as ItemRarity,
        icon: <span className="text-2xl">🎭</span>,
        canUse: false
      }
    };

    return itemInfoMap[itemType] || {
      name: itemType,
      description: '',
      rarity: 'COMMON' as ItemRarity,
      icon: <Key size={24} className="text-white" />,
      canUse: false
    };
  };

  const renderSpecialInventoryCard = (userItem: UserSpecialItem) => {
    const itemInfo = getSpecialItemInfo(userItem.itemType);

    return (
      <div
        key={userItem.id}
        onClick={() => openSpecialItemModal(userItem)}
        className="bg-gradient-to-br from-purple-50 dark:from-purple-950 to-violet-100 dark:to-violet-900 rounded-2xl p-2.5 shadow-soft border border-purple-200 dark:border-purple-800 relative group cursor-pointer active:scale-95 transition-transform"
      >
        {/* Quantity Badge */}
        <div className="absolute top-2 right-2 bg-purple-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md z-10">
          {userItem.quantity}
        </div>

        <div className="rounded-xl bg-white/60 dark:bg-slate-800/60 mb-2 flex items-center justify-center p-2 h-20">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
            {itemInfo.icon}
          </div>
        </div>

        <div>
          <h3 className="text-[11px] font-bold text-slate-800 dark:text-slate-100 mb-0.5 truncate">{itemInfo.name}</h3>
          <div className="text-[10px] text-slate-400 dark:text-slate-500">数量: {userItem.quantity}</div>
        </div>
      </div>
    );
  };

  const renderSignedAgreementCard = (item: SignedAgreementItem) => {
    const agreement = item.agreement;
    // The supervisor holds this item, so display the supervisee's info
    const targetName = agreement.superviseeName;
    const targetAvatar = agreement.superviseeAvatar;

    return (
      <div
        key={`agreement-${item.id}`}
        onClick={() => openAgreementModal(item)}
        className="bg-gradient-to-br from-emerald-50 dark:from-emerald-950 to-teal-100 dark:to-teal-900 rounded-2xl p-2.5 shadow-soft border border-emerald-200 relative group cursor-pointer active:scale-95 transition-transform"
      >
        {/* Status Badge */}
        <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-md z-10">
          生效中
        </div>

        <div className="rounded-xl bg-white/60 dark:bg-slate-800/60 mb-2 flex items-center justify-center p-2 relative overflow-hidden h-20">
          {targetAvatar ? (
            <img
              src={targetAvatar}
              alt={targetName}
              className="w-12 h-12 rounded-full object-cover border-2 border-emerald-200 dark:border-emerald-800 group-hover:scale-110 transition-transform duration-300"
            />
          ) : (
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
              <Shield size={22} className="text-white" />
            </div>
          )}
        </div>

        <div>
          <h3 className="text-[11px] font-bold text-slate-800 dark:text-slate-100 mb-0.5 truncate">监督合约</h3>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">被监督人: {targetName}</div>
        </div>
      </div>
    );
  };

  const renderLoading = () => (
    <div className="grid grid-cols-3 gap-2.5 md:grid-cols-4 lg:grid-cols-5">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-3 flex flex-col items-center">
          {/* Item icon skeleton */}
          <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl w-14 h-14 mb-2" />
          {/* Item name skeleton */}
          <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-3 w-16 mb-1" />
          {/* Item price skeleton */}
          <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-3 w-10" />
        </div>
      ))}
    </div>
  );

  const renderEmpty = (message: string) => (
    <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
      <PackageOpen size={48} className="mb-4" />
      <p className="text-sm">{message}</p>
    </div>
  );

  // Get selected item data for modal
  const getSelectedItemInfo = () => {
    if (!selectedItem) return null;

    if (isUserItem(selectedItem)) {
      return {
        item: selectedItem.item,
        isInventory: true,
        userItem: selectedItem
      };
    } else {
      return {
        item: selectedItem.item,
        isInventory: false,
        shopItem: selectedItem
      };
    }
  };

  const selectedInfo = getSelectedItemInfo();

  return (
    <div ref={scrollRef} className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col relative overflow-y-auto no-scrollbar">
      <div className="p-6 pb-32 lg:pb-8 lg:max-w-[1200px] lg:mx-auto lg:w-full">
        {/* --- Top Header (Wallet & Buffs) --- */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">道具 <span className="text-secondary">商店</span></h1>
            <div className="flex gap-3">
              {/* Currency Badges */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-3 py-1.5 rounded-full shadow-sm">
                <Coins size={14} className="text-amber-500 dark:text-amber-400 fill-amber-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {isLoadingCurrency ? '...' : currency.campusPoints}
                </span>
              </div>
            </div>
          </div>

          {/* Active Effects / Buffs */}
          {activeEffects && activeEffects.activeItems.length > 0 && (
            <div className="mb-6 flex gap-3 overflow-x-auto no-scrollbar -mx-6 px-6">
              {activeEffects.activeItems.map(effect => (
                <div key={effect.id} className="flex-shrink-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white p-1 pr-3 rounded-full flex items-center gap-2 shadow-glow-secondary">
                  <div className="w-6 h-6 rounded-full bg-white/20 dark:bg-slate-800/20 flex items-center justify-center">
                    <Zap size={12} className="fill-white" />
                  </div>
                  <span className="text-[10px] font-bold">
                    {effect.item.name} ({effect.effectExpiresAt ? formatRemainingTime(effect.effectExpiresAt) : '永久'})
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className="bg-slate-100 dark:bg-slate-700 p-1 rounded-2xl flex relative">
            <button
              onClick={() => setActiveTab('shop')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all relative z-10 flex items-center justify-center gap-2 ${activeTab === 'shop' ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}
            >
              <ShoppingBag size={14} /> 商店
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all relative z-10 flex items-center justify-center gap-2 ${activeTab === 'inventory' ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}
            >
              <Backpack size={14} /> 背包
            </button>

            {/* Animated Slider */}
            <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white dark:bg-slate-800 rounded-xl shadow-sm transition-transform duration-300 ease-spring ${activeTab === 'shop' ? 'left-1 translate-x-0' : 'left-1 translate-x-[100%]'}`}></div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-xl text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="p-1">
              <X size={16} />
            </button>
          </div>
        )}

        {/* --- Grid Content --- */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            {activeTab === 'shop' ? '商店道具' : '我的道具'}
          </h2>
          <button
            onClick={() => activeTab === 'shop' ? fetchShopItems() : fetchInventory()}
            className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {activeTab === 'shop' ? (
          (isLoadingShop || isLoadingSpecialShop) ? renderLoading() :
          (shopItems.length === 0 && specialShopItems.length === 0) ? renderEmpty('商店暂无道具') :
          <div className="grid grid-cols-3 gap-2.5 md:grid-cols-4 lg:grid-cols-5">
            {/* 特殊道具和普通道具混合显示，特殊道具在前 */}
            {specialShopItems.map(item => renderSpecialItemCard(item))}
            {shopItems.map(item => renderShopItemCard(item))}
          </div>
        ) : (
          isLoadingInventory ? renderLoading() :
          (inventory.length === 0 && specialInventory.length === 0 && signedAgreements.length === 0) ? renderEmpty('背包空空如也') :
          <>
            {/* Signed agreements section */}
            {signedAgreements.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                  <ScrollText size={12} /> 监督合约
                </h3>
                <div className="grid grid-cols-3 gap-2.5 md:grid-cols-4 lg:grid-cols-5">
                  {signedAgreements.map(item => renderSignedAgreementCard(item))}
                </div>
              </div>
            )}
            {/* Regular and special items */}
            {(specialInventory.length > 0 || inventory.length > 0) && (
              <div>
                {signedAgreements.length > 0 && (
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                    <Backpack size={12} /> 道具
                  </h3>
                )}
                <div className="grid grid-cols-3 gap-2.5 md:grid-cols-4 lg:grid-cols-5">
                  {specialInventory.map(item => renderSpecialInventoryCard(item))}
                  {inventory.map(item => renderInventoryItemCard(item))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* --- Item Detail Modal --- */}
      {selectedItem && selectedInfo && (
        <div
          className={`fixed inset-0 z-50 flex flex-col justify-end transition-all duration-300 ${
            isModalVisible ? 'bg-black/20 backdrop-blur-sm' : 'bg-transparent'
          }`}
          onClick={closeItemModal}
        >
          <div
            className={`bg-white dark:bg-slate-800 w-full rounded-t-[40px] p-8 pb-10 shadow-2xl relative transition-transform duration-300 ease-out ${
              isModalVisible ? 'translate-y-0' : 'translate-y-full'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={closeItemModal}
              className="absolute top-6 right-6 p-2 bg-slate-50 dark:bg-slate-900 rounded-full text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X size={20} />
            </button>

            {/* Item Image */}
            <div className="flex justify-center mb-6 -mt-16">
              <div className="w-32 h-32 bg-white dark:bg-slate-800 rounded-3xl p-4 shadow-xl border-4 border-slate-50 dark:border-slate-700 flex items-center justify-center">
                <img
                  src={selectedInfo.item.iconUrl || DEFAULT_ITEM_ICON}
                  alt={selectedInfo.item.name}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* Item Info */}
            <div className="text-center mb-8">
              <div className="flex justify-center mb-3">
                {renderRarity(selectedInfo.item.rarity)}
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">{selectedInfo.item.name}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed px-4">
                {selectedInfo.item.description || '暂无描述'}
              </p>

              {/* Item details */}
              {selectedInfo.item.effectDurationMinutes > 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                  效果持续: {selectedInfo.item.effectDurationMinutes} 分钟
                </p>
              )}
            </div>

            {/* Actions based on context */}
            <div className="flex gap-4">
              {!selectedInfo.isInventory ? (
                <button
                  onClick={handlePurchase}
                  disabled={isPurchasing || !(selectedInfo.shopItem?.canAfford)}
                  className={`flex-1 font-bold h-14 rounded-2xl active:scale-95 transition-transform flex items-center justify-center gap-2 ${
                    selectedInfo.shopItem?.canAfford
                      ? 'bg-secondary text-white shadow-glow-secondary'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {isPurchasing ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      <span className="text-sm">
                        {selectedInfo.shopItem?.canAfford ? '购买' : '余额不足'}
                      </span>
                      <div className="flex items-center gap-1 bg-white/20 dark:bg-slate-800/20 px-2 py-0.5 rounded-lg">
                        <Coins size={14} className="fill-white"/>
                        {selectedInfo.item.priceCampusPoints}
                      </div>
                    </>
                  )}
                </button>
              ) : (
                <>
                  {selectedInfo.item.isTradeable && (
                    <button className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold h-14 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-colors flex items-center justify-center gap-2">
                      <Gift size={18} /> 赠送
                    </button>
                  )}
                  {selectedInfo.item.itemType === 'CONSUMABLE' && (
                    <button
                      onClick={handleUseItem}
                      disabled={isUsing}
                      className="flex-[2] bg-slate-900 text-white font-bold h-14 rounded-2xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-2"
                    >
                      {isUsing ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <>
                          <Sparkles size={18} /> 使用
                        </>
                      )}
                    </button>
                  )}
                  {selectedInfo.item.itemType === 'EQUIPMENT' && (
                    <button
                      onClick={handleUseItem}
                      disabled={isUsing}
                      className={`flex-2 font-bold h-14 rounded-2xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-2 ${
                        selectedInfo.userItem && 'isEquipped' in selectedInfo.userItem && selectedInfo.userItem.isEquipped
                          ? 'bg-red-500 text-white'
                          : 'bg-secondary text-white shadow-glow-secondary'
                      }`}
                    >
                      {isUsing ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : selectedInfo.userItem && 'isEquipped' in selectedInfo.userItem && selectedInfo.userItem.isEquipped ? (
                        <>
                          <X size={18} /> 卸下
                        </>
                      ) : (
                        <>
                          <Check size={18} /> 装备
                        </>
                      )}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Special Item Detail Modal */}
      {selectedSpecialItem && (
        <div
          className={`fixed inset-0 z-50 flex flex-col justify-end transition-all duration-300 ${
            isSpecialModalVisible ? 'bg-black/20 backdrop-blur-sm' : 'bg-transparent'
          }`}
          onClick={closeSpecialItemModal}
        >
          <div
            className={`bg-white dark:bg-slate-800 w-full rounded-t-[40px] p-8 pb-10 shadow-2xl relative transition-transform duration-300 ease-out ${
              isSpecialModalVisible ? 'translate-y-0' : 'translate-y-full'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={closeSpecialItemModal}
              className="absolute top-6 right-6 p-2 bg-slate-50 dark:bg-slate-900 rounded-full text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X size={20} />
            </button>

            {/* Item Image */}
            <div className="flex justify-center mb-6 -mt-16">
              <div className="w-28 h-28 bg-gradient-to-br from-purple-500 to-violet-600 rounded-3xl p-4 shadow-xl border-4 border-white dark:border-slate-800 flex items-center justify-center [&_svg]:w-10! [&_svg]:h-10!">
                {(() => {
                  const itemType = 'item' in selectedSpecialItem
                    ? selectedSpecialItem.item.type
                    : selectedSpecialItem.itemType;
                  const info = getSpecialItemInfo(itemType);
                  return info.icon;
                })()}
              </div>
            </div>

            {/* Item Info */}
            {(() => {
              const isShopItem = 'item' in selectedSpecialItem && 'canAfford' in selectedSpecialItem;
              const itemType = isShopItem
                ? (selectedSpecialItem as SpecialShopItem).item.type
                : (selectedSpecialItem as UserSpecialItem).itemType;
              const itemInfo = getSpecialItemInfo(itemType);
              const shopItem = isShopItem ? selectedSpecialItem as SpecialShopItem : null;
              const userItem = !isShopItem ? selectedSpecialItem as UserSpecialItem : null;

              return (
                <>
                  <div className="text-center mb-8">
                    <div className="flex justify-center mb-3">
                      {renderRarity(itemInfo.rarity)}
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">{itemInfo.name}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed px-4">
                      {itemInfo.description}
                    </p>
                    {shopItem && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                        最大持有数量: {shopItem.item.maxStack}
                      </p>
                    )}
                    {userItem && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                        当前持有: {userItem.quantity}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-4">
                    {shopItem ? (
                      <button
                        onClick={() => {
                          handlePurchaseSpecialItem(shopItem);
                          closeSpecialItemModal();
                        }}
                        disabled={isPurchasing || !shopItem.canAfford || shopItem.ownedQuantity >= shopItem.item.maxStack}
                        className={`flex-1 font-bold h-14 rounded-2xl active:scale-95 transition-transform flex items-center justify-center gap-2 ${
                          shopItem.canAfford && shopItem.ownedQuantity < shopItem.item.maxStack
                            ? 'bg-purple-600 text-white shadow-lg'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {isPurchasing ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : shopItem.ownedQuantity >= shopItem.item.maxStack ? (
                          <span className="text-sm">已达持有上限</span>
                        ) : (
                          <>
                            <span className="text-sm">
                              {shopItem.canAfford ? '购买' : '余额不足'}
                            </span>
                            <div className="flex items-center gap-1 bg-white/20 dark:bg-slate-800/20 px-2 py-0.5 rounded-lg">
                              <Coins size={14} />
                              {shopItem.item.priceCampusPoints}
                            </div>
                          </>
                        )}
                      </button>
                    ) : userItem && itemInfo.canUse && userItem.quantity > 0 ? (
                      <button
                        onClick={() => {
                          closeSpecialItemModal();
                          if (userItem.itemType === 'SUPERVISION_PERMIT') {
                            openSupervisionModal();
                          } else if (userItem.itemType === 'KEY_BOX') {
                            openKeyBoxModal();
                          }
                        }}
                        className="flex-1 font-bold h-14 rounded-2xl bg-purple-600 text-white shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
                      >
                        <Sparkles size={18} />
                        使用
                      </button>
                    ) : (
                      <div className="flex-1 text-center text-sm text-slate-400 dark:text-slate-500 py-4">
                        {userItem?.itemType === 'MASTER_KEY'
                          ? '请在锁定详情页使用'
                          : '无法使用此道具'}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Signed Agreement Detail Modal */}
      {selectedAgreement && (
        <div
          className={`fixed inset-0 z-50 flex flex-col justify-end transition-all duration-300 ${
            isAgreementModalVisible ? 'bg-black/20 backdrop-blur-sm' : 'bg-transparent'
          }`}
          onClick={closeAgreementModal}
        >
          <div
            className={`bg-white dark:bg-slate-800 w-full rounded-t-[40px] p-8 pb-10 shadow-2xl relative transition-transform duration-300 ease-out ${
              isAgreementModalVisible ? 'translate-y-0' : 'translate-y-full'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={closeAgreementModal}
              className="absolute top-6 right-6 p-2 bg-slate-50 dark:bg-slate-900 rounded-full text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X size={20} />
            </button>

            {/* Icon */}
            <div className="flex justify-center mb-6 -mt-16">
              <div className="w-32 h-32 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-4 shadow-xl border-4 border-white dark:border-slate-800 flex items-center justify-center">
                {selectedAgreement.agreement.superviseeAvatar ? (
                  <img
                    src={selectedAgreement.agreement.superviseeAvatar}
                    alt={selectedAgreement.agreement.superviseeName}
                    className="w-20 h-20 rounded-full object-cover border-2 border-white/30"
                  />
                ) : (
                  <Shield size={48} className="text-white" />
                )}
              </div>
            </div>

            {/* Agreement Info */}
            <div className="text-center mb-6">
              <div className="flex justify-center mb-3">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-emerald-100 text-emerald-600 dark:text-emerald-400">
                  监督合约
                </span>
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                {selectedAgreement.agreement.superviseeName}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed px-4">
                你正在监督此用户
              </p>
            </div>

            {/* Details */}
            <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 mb-6 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400 dark:text-slate-500">被监督人</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {selectedAgreement.agreement.superviseeName}
                  {selectedAgreement.agreement.superviseeUsername && (
                    <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">
                      @{selectedAgreement.agreement.superviseeUsername}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400 dark:text-slate-500">合约期限</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {selectedAgreement.agreement.durationDays
                    ? `${selectedAgreement.agreement.durationDays} 天`
                    : '永久'}
                </span>
              </div>
              {selectedAgreement.agreement.startsAt && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400 dark:text-slate-500">生效时间</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {new Date(selectedAgreement.agreement.startsAt).toLocaleDateString('zh-CN')}
                  </span>
                </div>
              )}
              {selectedAgreement.agreement.expiresAt && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400 dark:text-slate-500">到期时间</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {new Date(selectedAgreement.agreement.expiresAt).toLocaleDateString('zh-CN')}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400 dark:text-slate-500">签署时间</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {new Date(selectedAgreement.acquiredAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
            </div>

            {/* Terminate Button */}
            <button
              onClick={() => handleCancelAgreement(selectedAgreement.agreement.id)}
              disabled={isCancellingAgreement === selectedAgreement.agreement.id}
              className="w-full font-bold h-14 rounded-2xl bg-red-500 text-white shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2 hover:bg-red-600"
            >
              {isCancellingAgreement === selectedAgreement.agreement.id ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <Trash2 size={18} />
                  解除合约
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Supervision Permit Use Modal */}
      <SupervisionPermitUseModal
        isOpen={showSupervisionModal}
        onClose={closeSupervisionModal}
        onSuccess={() => {
          closeSupervisionModal();
          fetchSpecialInventory();
        }}
      />
      <KeyBoxUseModal
        isOpen={showKeyBoxModal}
        onClose={closeKeyBoxModal}
        onSuccess={() => {
          closeKeyBoxModal();
          fetchSpecialInventory();
        }}
      />
    </div>
  );
};
