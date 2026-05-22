import React, { useEffect, useMemo, useState } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAlUX5H4gWiuHPXuR_26haY7DFFu_QI9lQ',
  authDomain: 'foodcuddles-os.firebaseapp.com',
  projectId: 'foodcuddles-os',
  storageBucket: 'foodcuddles-os.firebasestorage.app',
  messagingSenderId: '776746473429',
  appId: '1:776746473429:web:1af099846c682c2c914f5c',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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

export default function FoodCuddlesInventoryManager() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [notificationCenter, setNotificationCenter] = useState([]);
  const [whatsappLogs, setWhatsappLogs] = useState([]);
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [adjustmentQty, setAdjustmentQty] = useState('1');
  const [actionType, setActionType] = useState('restock');

  const recipes = [
    {
      id: 1,
      name: 'Shahi Paneer Bowl',
      sellingPrice: 249,
      ingredients: [
        { item: 'Paneer', qty: 0.2 },
        { item: 'Food Containers', qty: 1 },
      ],
    },
  ];
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

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

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'inventory'), async (snapshot) => {
      if (snapshot.empty) {
        for (const item of initialInventory) {
          await addDoc(collection(db, 'inventory'), item);
        }
        return;
      }

      const firebaseItems = snapshot.docs.map((docItem) => ({
        firestoreId: docItem.id,
        ...docItem.data(),
      }));

      setItems(firebaseItems);
    });

    return () => unsubscribe();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) =>
      item.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [items, search]);

  const totalInventoryValue = useMemo(() => {
    return items.reduce((sum, item) => {
      return sum + item.quantity * item.costPerUnit;
    }, 0);
  }, [items]);

  const lowStockItems = useMemo(() => {
    return items.filter((item) => item.quantity <= item.minStock);
  }, [items]);

  const inventoryHealth = useMemo(() => {
    if (!items.length) return 100;

    const healthyItems = items.filter(
      (item) => item.quantity > item.minStock
    ).length;

    return Math.round((healthyItems / items.length) * 100);
  }, [items]);

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

  const sendOperationalAlert = (title, message, priority = 'INFO') => {
    const alert = {
      id: Date.now(),
      title,
      message,
      priority,
      timestamp: new Date().toLocaleString(),
    };

    setNotificationCenter((prev) => [alert, ...prev]);

    if (whatsappEnabled) {
      setWhatsappLogs((prev) => [alert, ...prev]);
    }
  };

  const saveItem = async () => {
    if (!form.name || !form.category || !form.quantity) return;

    const payload = {
      id: Date.now(),
      name: form.name,
      category: form.category,
      quantity: Number(form.quantity),
      unit: form.unit,
      minStock: Number(form.minStock || 0),
      costPerUnit: Number(form.costPerUnit || 0),
      supplier: form.supplier,
      expiryDate: form.expiryDate,
      wastage: 0,
    };

    await addDoc(collection(db, 'inventory'), payload);

    addTransaction('ADDED', payload.name, payload.quantity);

    sendOperationalAlert(
      'New Inventory Added',
      `${payload.name} added to inventory.`
    );

    setForm(initialForm);
    setShowAddModal(false);
  };

  const adjustInventory = async () => {
    if (!selectedItem) return;

    const itemRef = doc(db, 'inventory', selectedItem.firestoreId);

    let updatedQty = selectedItem.quantity;

    if (actionType === 'restock') {
      updatedQty += Number(adjustmentQty);

      addTransaction('RESTOCK', selectedItem.name, adjustmentQty);

      sendOperationalAlert(
        'Inventory Restocked',
        `📦 ${selectedItem.name} restocked by ${adjustmentQty} ${selectedItem.unit}`
      );
    }

    if (actionType === 'usage') {
      updatedQty = Math.max(0, selectedItem.quantity - Number(adjustmentQty));

      addTransaction('USAGE', selectedItem.name, adjustmentQty);

      sendOperationalAlert(
        'Kitchen Usage',
        `🍳 ${adjustmentQty} ${selectedItem.unit} of ${selectedItem.name} used`
      );
    }

    if (actionType === 'wastage') {
      updatedQty = Math.max(0, selectedItem.quantity - Number(adjustmentQty));

      addTransaction('WASTAGE', selectedItem.name, adjustmentQty);

      sendOperationalAlert(
        'Wastage Alert',
        `🥲 ${adjustmentQty} ${selectedItem.unit} of ${selectedItem.name} wasted`,
        'CRITICAL'
      );
    }

    await updateDoc(itemRef, {
      quantity: updatedQty,
    });

    setSelectedItem(null);
  };

  const completeRecipeOrder = async (recipe) => {
    for (const ingredient of recipe.ingredients) {
      const inventoryItem = items.find(
        (item) => item.name === ingredient.item
      );

      if (!inventoryItem) continue;

      const itemRef = doc(db, 'inventory', inventoryItem.firestoreId);

      await updateDoc(itemRef, {
        quantity: Math.max(0, inventoryItem.quantity - ingredient.qty),
      });
    }

    addTransaction('ORDER', recipe.name, 1);

    sendOperationalAlert(
      'Recipe Completed',
      `✅ ${recipe.name} order completed.`
    );
  };

  const restockItem = async (item) => {
    const itemRef = doc(db, 'inventory', item.firestoreId);

    await updateDoc(itemRef, {
      quantity: item.quantity + 1,
    });
  };

  const useItem = async (item) => {
    const itemRef = doc(db, 'inventory', item.firestoreId);

    await updateDoc(itemRef, {
      quantity: Math.max(0, item.quantity - 1),
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-3xl p-4 shadow-lg flex gap-3 overflow-auto">
          {['dashboard', 'inventory', 'recipes', 'notifications', 'whatsapp', 'transactions'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 rounded-2xl capitalize font-bold whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
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
              <p>Total Items</p>
              <h2 className="text-2xl font-black mt-2">
                {items.length}
              </h2>
            </div>
          </div>
        </div>

        {activeTab === 'inventory' && (
        <div className="bg-white rounded-3xl p-6 shadow-xl">
          <div className="flex justify-between items-center mb-5 flex-wrap gap-4">
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
                key={item.firestoreId || item.id}
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

                <div className="grid grid-cols-2 gap-3 mt-5">
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
                    Use
                  </button>

                  <button
                    onClick={() => {
                      setSelectedItem(item);
                      setActionType('wastage');
                    }}
                    className="bg-red-100 text-red-700 py-2 rounded-2xl"
                  >
                    Wastage
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}

        {activeTab === 'recipes' && (
          <div className="bg-white rounded-3xl p-6 shadow-xl">
            <h2 className="text-3xl font-black mb-5">Recipe Engine 🍛</h2>

            <div className="space-y-4">
              {recipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className="border border-gray-200 rounded-3xl p-5"
                >
                  <div className="flex justify-between items-center flex-wrap gap-4">
                    <div>
                      <h3 className="text-2xl font-black">{recipe.name}</h3>
                      <p className="text-gray-500 mt-2">
                        Selling Price: ₹{recipe.sellingPrice}
                      </p>
                    </div>

                    <button
                      onClick={() => completeRecipeOrder(recipe)}
                      className="bg-black text-white px-5 py-3 rounded-2xl"
                    >
                      Complete Order
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="bg-white rounded-3xl p-6 shadow-xl">
            <h2 className="text-3xl font-black mb-5">Notification Center 🔔</h2>

            <div className="space-y-4">
              {notificationCenter.map((alert) => (
                <div
                  key={alert.id}
                  className="border border-gray-200 rounded-2xl p-4"
                >
                  <div className="flex justify-between items-center">
                    <h3 className="font-black">{alert.title}</h3>
                    <span className="text-xs bg-black text-white px-3 py-1 rounded-full">
                      {alert.priority}
                    </span>
                  </div>

                  <p className="mt-3 text-gray-700">{alert.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'whatsapp' && (
          <div className="bg-white rounded-3xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-5 flex-wrap gap-4">
              <h2 className="text-3xl font-black">WhatsApp Hub 📲</h2>

              <button
                onClick={() => setWhatsappEnabled(!whatsappEnabled)}
                className={`px-5 py-3 rounded-2xl font-bold ${
                  whatsappEnabled
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-300 text-gray-700'
                }`}
              >
                {whatsappEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            <div className="space-y-4">
              {whatsappLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-green-50 border border-green-200 rounded-2xl p-4"
                >
                  <p>{log.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="bg-white rounded-3xl p-6 shadow-xl">
            <h2 className="text-3xl font-black mb-5">Transaction History 📜</h2>

            <div className="space-y-4">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="border border-gray-200 rounded-2xl p-4 flex justify-between"
                >
                  <div>
                    <h3 className="font-black">{tx.type}</h3>
                    <p className="text-gray-500">{tx.itemName}</p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold">{tx.qty}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {tx.timestamp}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedItem && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-lg">
              <h2 className="text-3xl font-black mb-6 capitalize">
                {actionType} Inventory
              </h2>

              <input
                type="number"
                value={adjustmentQty}
                onChange={(e) => setAdjustmentQty(e.target.value)}
                className="w-full p-4 rounded-2xl border border-gray-300"
              />

              <div className="grid grid-cols-2 gap-4 mt-6">
                <button
                  onClick={() => setSelectedItem(null)}
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
            </div>
          </div>
        )}

        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-xl">
              <h2 className="text-3xl font-black mb-6">Add Item</h2>

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
                  onClick={() => setShowAddModal(false)}
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
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl p-6 shadow-xl">
          <h2 className="text-2xl font-black mb-4">Validation Test Cases ✅</h2>

          <ul className="space-y-2 list-disc pl-6 text-gray-700">
            <li>Firebase inventory sync works across devices.</li>
            <li>Add inventory item successfully.</li>
            <li>Restock increases quantity in Firestore.</li>
            <li>Usage decreases quantity in Firestore.</li>
            <li>Inventory updates in real time.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
