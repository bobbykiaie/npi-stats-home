// src/components/admin/ProductList.jsx (Updated with Archive Functionality)
import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import API_BASE_URL from '../api';
import { FiPlus, FiSearch, FiArchive } from 'react-icons/fi'; // Changed FiTrash2 to FiArchive
import Modal from './Modal';
import CreateProduct from './CreateProduct';

export default function ProductList({ products, isLoading, error, onSelectProduct, onProductCreated }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    return products.filter(p =>
      p.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.mvd_number.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, products]);
  
  // --- MODIFIED: Handle Archive Logic ---
  const handleArchive = async (e, product) => {
    e.stopPropagation(); // Prevent the card's main click event

    const password = prompt('To archive this product, please enter the admin password:');
    if (password === null) return; // User cancelled the prompt

    if (password !== 'TNAliso35') {
      alert('Incorrect password.');
      return;
    }

    if (window.confirm(`Are you sure you want to archive "${product.product_name}"? It will be hidden from this list.`)) {
      try {
        // Changed to a PUT request to the new archive endpoint
        await axios.put(`${API_BASE_URL}/products/${product.mvd_number}/archive`, 
          { adminPassword: password }, // Send password in the body
          { withCredentials: true }
        );
        alert('Product archived successfully.');
        onProductCreated(); // Refresh the product list
      } catch (err) {
        console.error('Archive failed:', err);
        alert(err.response?.data?.error || 'Failed to archive product.');
      }
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  return (
    <motion.div
      key="grid-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="p-8 h-full overflow-y-auto w-full"
    >
      <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-8">Products</h1>
      <div className="relative mb-6">
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-lg p-3 pl-12 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {isLoading && <p>Loading...</p>}
      {error && <p className="text-red-500 bg-red-100 p-4 rounded-lg">{error}</p>}
      
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
      >
        <motion.button
          variants={itemVariants}
          onClick={() => setIsModalOpen(true)}
          className="border-2 border-dashed border-slate-300 rounded-xl text-slate-500 w-full h-52 flex flex-col items-center justify-center hover:border-indigo-500 hover:text-indigo-600 transition-all duration-300"
        >
          <FiPlus size={48} />
          <span className="mt-2 font-semibold">Add New Product</span>
        </motion.button>
        
        {filteredProducts.map(p => (
          <motion.div
            key={p.mvd_number}
            variants={itemVariants}
            onClick={() => onSelectProduct(p)}
            className="group bg-white border border-slate-200 rounded-xl h-52 p-4 flex flex-col justify-between cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
          >
            <div>
              {/* --- MODIFIED: Archive button --- */}
              <button
                onClick={(e) => handleArchive(e, p)}
                className="absolute top-2 right-2 p-2 rounded-full text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-yellow-100 hover:text-yellow-700"
                aria-label={`Archive ${p.product_name}`}
              >
                <FiArchive size={16} />
              </button>
              <h3 className="font-bold text-lg text-slate-800">{p.product_name}</h3>
              <p className="text-sm text-slate-500 mt-1">{p.mvd_number}</p>
            </div>
            <span className="text-sm text-indigo-600 font-semibold mt-auto">
              View Details &rarr;
            </span>
          </motion.div>
        ))}
      </motion.div>
      
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <CreateProduct onSuccess={() => { setIsModalOpen(false); onProductCreated(); }} onCancel={() => setIsModalOpen(false)} />
      </Modal>
    </motion.div>
  );
}