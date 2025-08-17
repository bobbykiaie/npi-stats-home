// src/components/admin/AdminPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import axios from 'axios';
import API_BASE_URL from '../api';
import AdminSidebar from './AdminSidebar';
import ProductList from './ProductList';
import ProductDetail from './ProductDetail';
import LotList from './LotList';
import RejectManagement from './RejectManagement';
import EquipmentManagement from './EquipmentManagement';
import ProcessRecipes from './ProcessRecipes';
import AISettings from './AISettings'; // This was already correctly imported

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const location = useLocation();

  useEffect(() => {
    if (location.state?.selectedLotNumber) {
      setActiveTab('lots');
    }
  }, [location.state]);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_BASE_URL}/products`, { withCredentials: true });
      setProducts(response.data);
    } catch (err) {
      setError('Failed to fetch products. Please ensure the backend is running.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'products') {
      fetchProducts();
    }
  }, [activeTab, fetchProducts]);

  const handleProductCreated = () => {
    fetchProducts();
  };
  
  const handleProductUpdated = (updatedProduct) => {
    setProducts(currentProducts =>
      currentProducts.map(p =>
        p.mvd_number === updatedProduct.mvd_number ? updatedProduct : p
      )
    );
  };
  
  const renderContent = () => {
    if (activeTab === 'lots')      return <LotList />;
    if (activeTab === 'mps')       return <h1 className="p-8 text-4xl font-bold">Manufacturing (Coming Soon)</h1>;
    if (activeTab === 'rejects')   return <RejectManagement />;
    if (activeTab === 'equipment') return <EquipmentManagement />;
    if (activeTab === 'recipes')   return <ProcessRecipes />;
    // NEW: Added the case to render the AI Settings component
    if (activeTab === 'ai-settings') return <AISettings />;

    // Default to product view
    return (
      <AnimatePresence mode="wait">
        {selectedProduct ? (
          <ProductDetail
            key={selectedProduct.mvd_number}
            product={selectedProduct}
            onBack={() => setSelectedProduct(null)}
            onUpdate={handleProductUpdated}
          />
        ) : (
          <ProductList
            key="product-grid"
            products={products}
            isLoading={isLoading}
            error={error}
            onSelectProduct={setSelectedProduct}
            onProductCreated={handleProductCreated}
          />
        )}
      </AnimatePresence>
    );
  };

  return (
    <div className="flex h-[calc(100vh-64px)]">
      <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 bg-slate-50 overflow-y-auto">
        {renderContent()}
      </main>
    </div>
  );
}
