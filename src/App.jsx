import React, { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'foodcuddles_complete_os';

const initialInventory = [
  {
    id: 1,
    name: 'Paneer',
    category: 'Dairy',
    quantity: 5,
    unit: 'kg',
    minStock: 3,
    costPerUnit: 340,
    supplier: 'Amul Vendor',
    expiryDate: '2026-05-28',
    wastage: 0,
  },
  {
    id: 2,
    name: 'Basmati Rice',
    category: 'Grains',
    quantity: 25,
    unit: 'kg',
    minStock: 10,
    costPerUnit: 90,
    supplier: 'Metro Wholesale',
    expiryDate: '',
    wastage: 0,
  },
  {
    id: 3,
    name: 'Food Containers',
    category: 'Packaging',
    quantity: 140,
    unit: 'pcs',
    minStock: 50,
    costPerUnit: 6,
    supplier: 'PackHub',
    expiryDate: '',
    wastage: 0,
  },
];

const recipesSeed = [
  {
    id: 1,
    name: 'Shahi Paneer Bowl',
    sellingPrice: 249,
    ingredients: [
      { item: 'Paneer', qty: 0.2, unit: 'kg', cost: 68 },
      { item: 'Food Containers', qty: 1, unit: 'pcs', cost: 6 },
    ],
  },
];

export default function FoodCuddlesInventoryManager() {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : initialInventory;
    } catch {
      return initialInventory;
    }
  });

  const [transactions, setTransactions] = useState([]);
  const [notificationCenter, setNotificationCenter] = useState([]);
  const [whatsappLogs, setWhatsappLogs] = useState([]);
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState('+91 9876543210');
  const [recipes] = useState(recipesSeed);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [actionType, setActionType] = useState('');
  const [adjustmentQty, setAdjustmentQty] = useState('');

  const initialForm = {
    name: '',
    category: '',
    quantity: '',
    unit: 'kg',
    minStock: '',
    costPerUnit: '',
    supplier: '',
    expiryDate: '',
  };

  const [form, setForm] = useState(initialForm);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) =>
      item.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [items, search]);

  const totalInventoryValue = useMemo(() => {
    return items.reduce(
      (sum, item) => sum + item.quantity * item.costPerUnit,
      0
    );
  }, [items]);

  const lowStockItems = useMemo(() => {
    return items.filter((item) => item.quantity <= item.minStock);
  }, [items]);

  const expiringItems = useMemo(() => {
    const today = new Date();

    return items.filter((item) => {
      if (!item.expiryDate) return false;

      const expiry = new Date(item.expiryDate);
      const diff = Math.ceil(
        (expiry - today) / (1000 * 60 * 60 * 24)
      );

      return diff <= 5;
    });
  }, [items]);

  const inventoryHealth = useMemo(() => {
    if (!items.length) return 100;

    const healthy = items.filter(
      (item) => item.quantity > item.minStock
    ).length;

    return Math.round((healthy / items.length) * 100);
  }, [items]);

  const notificationTemplates = {
    RESTOCK: {
      priority: 'INFO',
      channel: 'WHATSAPP',
    },
    USAGE: {
      priority: 'INFO',
      channel: 'WHATSAPP',
    },
    WASTAGE: {
      priority: 'CRITICAL',
      channel: 'WHATSAPP',
    },
    ORDER: {
      priority: 'INFO',
      channel: 'WHATSAPP',
    },
  };

  const sendOperationalAlert = ({ type, title, message }) => {
    const config = notificationTemplates[type] || {};

    const alert = {
      id: Date.now(),
      type,
      title,
      message,
      priority: config.priority || 'INFO',
      channel: config.channel || 'DASHBOARD',
      timestamp: new Date().toLocaleString(),
    };

    setNotificationCenter((prev) => [alert, ...prev]);

    if (whatsappEnabled && alert.channel === 'WHATSAPP') {
      setWhatsappLogs((prev) => [alert, ...prev]);
    }
  };

  const addTransaction = (type, itemName, qty) => {
    const transaction = {
      id: Date.now(),
      type,
      itemName,
      qty,
      timestamp: new Date().toLocaleString(),
    };

    setTransactions((prev) => [transaction, ...prev]);
  };

  const saveItem = () => {
    if (!form.name || !form.category || !form.quantity) return;

    if (editingItem) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === editingItem.id
            ? {
                ...item,
                ...form,
                quantity: Number(form.quantity),
                minStock: Number(form.minStock),
                costPerUnit: Number(form.costPerUnit),
              }
            : item
        )
      );
    } else {
      const newItem = {
        id: Date.now(),
        ...form,
        quantity: Number(form.quantity),
        minStock: Number(form.minStock),
        costPerUnit: Number(form.costPerUnit),
        wastage: 0,
      };

      setItems((prev) => [newItem, ...prev]);
    }

    setForm(initialForm);
    setShowAddModal(false);
    setEditingItem(null);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setForm(item);
    setShowAddModal(true);
  };

  const adjustInventory = () => {
    if (!adjustmentQty || !selectedItem) return;

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== selectedItem.id) return item;

        if (actionType === 'restock') {
          addTransaction('RESTOCK', item.name, adjustmentQty);

          sendOperationalAlert({
            type: 'RESTOCK',
            title: 'Inventory Restocked',
            message: `📦 ${item.name} restocked by ${adjustmentQty} ${item.unit}`,
          });

          return {
            ...item,
            quantity: item.quantity + Number(adjustmentQty),
          };
        }

        if (actionType === 'usage') {
          addTransaction('USED', item.name, adjustmentQty);

          sendOperationalAlert({
            type: 'USAGE',
            title: 'Kitchen Usage',
            message: `🍳 ${adjustmentQty} ${item.unit} of ${item.name} used`,
          });

          return {
            ...item,
            quantity: Math.max(0, item.quantity - Number(adjustmentQty)),
          };
        }

        if (actionType === 'wastage') {
          addTransaction('WASTAGE', item.name, adjustmentQty);

          sendOperationalAlert({
            type: 'WASTAGE',
            title: 'Wastage Recorded',
            message: `🥲 ${adjustmentQty} ${item.unit} of ${item.name} wasted`,
          });

          return {
            ...item,
            quantity: Math.max(0, item.quantity - Number(adjustmentQty)),
            wastage: item.wastage + Number(adjustmentQty),
          };
        }

        return item;
      })
    );

    setSelectedItem(null);
    setAdjustmentQty('');
    setActionType('');
  };

  const completeRecipeOrder = (recipe) => {
    setItems((prev) =>
      prev.map((item) => {
        const ingredient = recipe.ingredients.find(
          (ing) => ing.item === item.name
        );

        if (!ingredient) return item;

        return {
          ...item,
          quantity: Math.max(0, item.quantity - ingredient.qty),
        };
      })
    );

    addTransaction('ORDER COMPLETED', recipe.name, 1);

    sendOperationalAlert({
      type: 'ORDER',
      title: 'Recipe Completed',
      message: `✅ ${recipe.name} completed and inventory deducted`,
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-3xl shadow-2xl p-8 text-white">
          <h1 className="text-5xl font-black">FoodCuddles OS 🍲</h1>
          <p className="mt-3 text-lg">Cloud Kitchen Operating System</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-white/20 rounded-3xl p-5">
              <p>Inventory Value</p>
              <h2 className="text-2xl font-black mt-2">
                ₹{totalInventoryValue.toLocaleString('en-IN')}
              </h2>
            </div>

            <div className="bg-white/20 rounded-3xl p-5">
              <p>Health Score</p>
              <h2 className="text-2xl font-black mt-2">
                {inventoryHealth}%
              </h2>
            </div>

            <div className="bg-white/20 rounded-3xl p-5">
              <p>Low Stock</p>
              <h2 className="text-2xl font-black mt-2">
                {lowStockItems.length}
              </h2>
            </div>

            <div className="bg-white/20 rounded-3xl p-5">
              <p>Expiring Soon</p>
              <h2 className="text-2xl font-black mt-2">
                {expiringItems.length}
              </h2>
            </div>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          {['dashboard', 'inventory', 'recipes', 'notifications', 'whatsapp', 'transactions'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 rounded-2xl font-bold ${
                activeTab === tab
                  ? 'bg-black text-white'
                  : 'bg-white border border-gray-300'
              }`}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        {activeTab === 'dashboard' && (
          <div className="bg-white rounded-3xl p-6 shadow-xl">
            <h2 className="text-3xl font-black mb-5">Dashboard Overview 📊</h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-orange-50 rounded-3xl p-5 border border-orange-200">
                <h3 className="font-black text-orange-700">Kitchen Intelligence</h3>
                <p className="mt-3 text-gray-600">
                  Paneer inventory may require replenishment within 2 days.
                </p>
              </div>

              <div className="bg-green-50 rounded-3xl p-5 border border-green-200">
                <h3 className="font-black text-green-700">Operational Insight</h3>
                <p className="mt-3 text-gray-600">
                  Inventory system operating normally.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-3xl p-6 shadow-xl lg:col-span-2">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-3xl font-black">Inventory</h2>

                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-black text-white px-5 py-3 rounded-2xl"
                >
                  Add Item
                </button>
              </div>

              <input
                type="text"
                placeholder="Search inventory"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full p-4 rounded-2xl border border-gray-300 mb-6"
              />

              <div className="space-y-4">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="border border-gray-200 rounded-3xl p-5"
                  >
                    <div className="flex justify-between gap-4 flex-wrap">
                      <div>
                        <h3 className="text-xl font-black">{item.name}</h3>
                        <p className="text-gray-500 mt-1">{item.category}</p>
                      </div>

                      <div className="text-right">
                        <p className="font-black text-green-700 text-xl">
                          ₹{(item.quantity * item.costPerUnit).toLocaleString('en-IN')}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {item.quantity} {item.unit}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                      <button
                        onClick={() => {
                          setSelectedItem(item);
                          setActionType('restock');
                        }}
                        className="bg-black text-white py-2 rounded-2xl"
                      >
                        Restock
                      </button>

                      <button
                        onClick={() => {
                          setSelectedItem(item);
                          setActionType('usage');
                        }}
                        className="bg-yellow-100 text-yellow-700 py-2 rounded-2xl"
                      >
                        Usage
                      </button>

                      <button
                        onClick={() => {
                          setSelectedItem(item);
                          setActionType('wastage');
                        }}
                        className="bg-red-100 text-red-600 py-2 rounded-2xl"
                      >
                        Wastage
                      </button>

                      <button
                        onClick={() => openEdit(item)}
                        className="bg-blue-100 text-blue-700 py-2 rounded-2xl"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-xl">
              <h2 className="text-2xl font-black mb-5">Alerts 🚨</h2>

              <div className="space-y-4">
                {lowStockItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-red-50 border border-red-200 rounded-2xl p-4"
                  >
                    <h3 className="font-black">{item.name}</h3>
                    <p className="text-red-600 mt-2">
                      Current: {item.quantity} {item.unit}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'recipes' && (
          <div className="space-y-6">
            {recipes.map((recipe) => {
              const recipeCost = recipe.ingredients.reduce(
                (sum, ing) => sum + ing.cost,
                0
              );

              return (
                <div
                  key={recipe.id}
                  className="bg-white rounded-3xl p-6 shadow-xl"
                >
                  <h2 className="text-3xl font-black">{recipe.name}</h2>

                  <div className="grid md:grid-cols-3 gap-4 mt-6">
                    <div className="bg-orange-100 rounded-3xl p-5">
                      <p>Selling Price</p>
                      <h2 className="text-2xl font-black mt-2">
                        ₹{recipe.sellingPrice}
                      </h2>
                    </div>

                    <div className="bg-red-100 rounded-3xl p-5">
                      <p>Food Cost</p>
                      <h2 className="text-2xl font-black mt-2">
                        ₹{recipeCost}
                      </h2>
                    </div>

                    <div className="bg-green-100 rounded-3xl p-5">
                      <p>Profit</p>
                      <h2 className="text-2xl font-black mt-2">
                        ₹{recipe.sellingPrice - recipeCost}
                      </h2>
                    </div>
                  </div>

                  <button
                    onClick={() => completeRecipeOrder(recipe)}
                    className="w-full bg-black text-white py-4 rounded-3xl font-black mt-6"
                  >
                    Complete Order & Deduct Inventory
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="bg-white rounded-3xl p-6 shadow-xl">
            <h2 className="text-3xl font-black mb-6">Notification Center 🔔</h2>

            <div className="space-y-4">
              {notificationCenter.length === 0 ? (
                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200 text-gray-500">
                  No notifications yet.
                </div>
              ) : (
                notificationCenter.map((alert) => (
                  <div
                    key={alert.id}
                    className="border border-gray-200 rounded-2xl p-5"
                  >
                    <div className="flex justify-between gap-4 flex-wrap">
                      <div>
                        <h3 className="font-black">{alert.title}</h3>
                        <p className="mt-2 text-gray-600">{alert.message}</p>
                      </div>

                      <div className="text-sm text-gray-500">
                        {alert.timestamp}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'whatsapp' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl p-6 shadow-xl">
              <h2 className="text-3xl font-black mb-6">WhatsApp Hub 📲</h2>

              <input
                type="text"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                className="w-full p-4 rounded-2xl border border-gray-300 mb-5"
              />

              <button
                onClick={() => setWhatsappEnabled(!whatsappEnabled)}
                className={`px-5 py-3 rounded-2xl font-black ${
                  whatsappEnabled
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-300 text-gray-700'
                }`}
              >
                {whatsappEnabled ? 'WhatsApp Enabled' : 'WhatsApp Disabled'}
              </button>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-xl">
              <h2 className="text-3xl font-black mb-6">WhatsApp Logs 💬</h2>

              <div className="space-y-4">
                {whatsappLogs.map((log) => (
                  <div
                    key={log.id}
                    className="bg-green-50 border border-green-200 rounded-2xl p-4"
                  >
                    <p>{log.message}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {log.timestamp}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="bg-white rounded-3xl p-6 shadow-xl">
            <h2 className="text-3xl font-black mb-6">Transactions 📜</h2>

            <div className="space-y-4">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="border border-gray-200 rounded-2xl p-4 flex justify-between gap-4 flex-wrap"
                >
                  <div>
                    <h3 className="font-black">{tx.type}</h3>
                    <p className="text-gray-600 mt-1">{tx.itemName}</p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold">{tx.qty}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {tx.timestamp}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(selectedItem || showAddModal) && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-xl">
              {showAddModal ? (
                <>
                  <h2 className="text-3xl font-black mb-6">
                    {editingItem ? 'Edit Item' : 'Add Item'}
                  </h2>

                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Item Name"
                      className="w-full p-4 rounded-2xl border border-gray-300"
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                    />

                    <input
                      type="text"
                      placeholder="Category"
                      className="w-full p-4 rounded-2xl border border-gray-300"
                      value={form.category}
                      onChange={(e) =>
                        setForm({ ...form, category: e.target.value })
                      }
                    />

                    <input
                      type="number"
                      placeholder="Quantity"
                      className="w-full p-4 rounded-2xl border border-gray-300"
                      value={form.quantity}
                      onChange={(e) =>
                        setForm({ ...form, quantity: e.target.value })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <button
                      onClick={() => {
                        setShowAddModal(false);
                        setEditingItem(null);
                      }}
                      className="bg-gray-200 py-4 rounded-2xl font-bold"
                    >
                      Cancel
                    </button>

                    <button
                      onClick={saveItem}
                      className="bg-black text-white py-4 rounded-2xl font-black"
                    >
                      Save Item
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-3xl font-black mb-6 capitalize">
                    {actionType} Inventory
                  </h2>

                  <input
                    type="number"
                    placeholder="Enter quantity"
                    className="w-full p-4 rounded-2xl border border-gray-300"
                    value={adjustmentQty}
                    onChange={(e) => setAdjustmentQty(e.target.value)}
                  />

                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <button
                      onClick={() => {
                        setSelectedItem(null);
                        setActionType('');
                      }}
                      className="bg-gray-200 py-4 rounded-2xl font-bold"
                    >
                      Cancel
                    </button>

                    <button
                      onClick={adjustInventory}
                      className="bg-black text-white py-4 rounded-2xl font-black"
                    >
                      Confirm
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl p-6 shadow-xl">
          <h2 className="text-2xl font-black mb-4">Validation Test Cases ✅</h2>

          <ul className="space-y-2 list-disc pl-6 text-gray-700">
            <li>Add inventory item successfully.</li>
            <li>Edit existing inventory item.</li>
            <li>Restock inventory increases quantity.</li>
            <li>Usage decreases inventory quantity.</li>
            <li>Wastage updates wastage counter.</li>
            <li>Recipe order auto deducts inventory.</li>
            <li>Notifications appear in notification center.</li>
            <li>WhatsApp logs appear when alerts are enabled.</li>
            <li>Inventory persists after page refresh.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
