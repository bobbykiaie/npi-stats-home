import express from 'express';
import { prisma } from '../config/db.js';
import { protectRoute } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET all products (MODIFIED to hide archived products)
router.get('/', protectRoute(), async (req, res) => {
  try {
    const products = await prisma.products.findMany({
      where: { is_archived: false }, // <-- This is the change
      orderBy: { product_name: 'asc' },
      include: { 
          configurations: {
              include: {
                  manufacturing_procedures: true
              }
          }
       },
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// GET a single product by MVD
router.get('/:mvd_number', protectRoute(), async (req, res) => {
  // This route remains the same, allowing access to archived products by direct link
  const { mvd_number } = req.params;
  try {
    const product = await prisma.products.findUnique({
      where: { mvd_number },
      include: {
        configurations: {
          orderBy: { config_number: 'asc' },
           include: {
              manufacturing_procedures: true
          }
        }
      }
    });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch product details.' });
  }
});

// POST to create a new product (No changes needed here)
router.post('/', protectRoute(['engineer']), async (req, res) => {
  const { mvd_number, product_name, configurations, procedures } = req.body;
  // ... (rest of the function is the same)
  // --- The following is a condensed version for brevity ---
  if (!mvd_number || !product_name) {
    return res.status(400).json({ error: 'MVD number and product name are required.' });
  }
  try {
    if (procedures && procedures.length > 0) {
      await prisma.$transaction(
        procedures.map(proc =>
          prisma.manufacturingProcedures.upsert({
            where: { mp_number: proc.mp_number },
            update: { procedure_name: proc.procedure_name },
            create: { mp_number: proc.mp_number, procedure_name: proc.procedure_name },
          })
        )
      );
    }
    const newProduct = await prisma.products.create({
      data: {
        mvd_number,
        product_name,
        configurations: {
          create: configurations.map(config => ({
            config_number: config.config_number,
            config_name: config.config_name,
            manufacturing_procedures: {
              connect: config.mps.map(mp => ({ mp_number: mp.mp_number })),
            },
          })),
        },
      },
      include: { configurations: true },
    });
    res.status(201).json(newProduct);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: `A product with this ID already exists.` });
    }
    console.error("Error creating product:", error);
    res.status(500).json({ error: "Failed to create product" });
  }
});


// --- NEW: This route now ARCHIVES a product instead of deleting it ---
router.put('/:mvd_number/archive', protectRoute(['engineer']), async (req, res) => {
  const { mvd_number } = req.params;
  const { adminPassword } = req.body;

  if (adminPassword !== 'TNAliso35') {
    return res.status(403).json({ error: 'Forbidden: Invalid admin password.' });
  }

  try {
    const updatedProduct = await prisma.products.update({
      where: { mvd_number },
      data: { is_archived: true }, // Set the archived flag to true
    });
    res.json(updatedProduct);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Product not found.' });
    }
    console.error(`Error archiving product ${mvd_number}:`, error);
    res.status(500).json({ error: 'Failed to archive product.' });
  }
});

// GET all configurations for a specific product
router.get('/:mvd_number/configurations', protectRoute(), async (req, res) => {
  const { mvd_number } = req.params;
  try {
    const product = await prisma.products.findUnique({
      where: { mvd_number },
      include: {
        configurations: {
          orderBy: { config_number: 'asc' },
          include: {
            manufacturing_procedures: true,
          },
        },
      },
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product.configurations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch configurations.' });
  }
});

export default router;