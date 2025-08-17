// backend/routes/manufacturingProcedures.js (Corrected)

import express from 'express';
import { prisma } from '../config/db.js';
import { protectRoute } from '../middleware/authMiddleware.js';

const router = express.Router();
// GET all manufacturing procedures
router.get('/', protectRoute(), async (req, res) => {
  try {
    const all = await prisma.manufacturingProcedures.findMany({
      orderBy: { mp_number: 'asc' },   // optional
    });
    res.json(all);
  } catch (err) {
    console.error('Failed to fetch MPs:', err);
    res.status(500).json({ error: 'Failed to fetch manufacturing procedures.' });
  }
});


router.post('/', protectRoute(['engineer']), async (req, res) => {
  const incomingProcedures = req.body;

  if (!Array.isArray(incomingProcedures) || incomingProcedures.length === 0) {
    return res.status(400).json({ error: 'Request body must be a non-empty array of procedures.' });
  }
  
  const validProcedures = incomingProcedures.filter(p => p.mp_number && p.procedure_name);
  if (validProcedures.length === 0) {
    return res.status(400).json({ error: 'No valid procedures provided.' });
  }

  // --- START OF NEW LOGIC ---

  // 1. Get a list of just the MP numbers from the request
  const requestedMpNumbers = validProcedures.map(p => p.mp_number);

  // 2. Query the database to see which of these numbers already exist
  const existingProcedures = await prisma.manufacturingProcedures.findMany({
    where: {
      mp_number: {
        in: requestedMpNumbers,
      },
    },
    select: {
      mp_number: true, // Only select the mp_number field
    },
  });

  const existingMpNumbers = new Set(existingProcedures.map(p => p.mp_number));

  // 3. Filter the incoming procedures to only include ones that DO NOT exist yet
  const proceduresToCreate = validProcedures.filter(p => !existingMpNumbers.has(p.mp_number));

  // --- END OF NEW LOGIC ---

  // If there are no new procedures to create, we can just return success
  if (proceduresToCreate.length === 0) {
    return res.status(200).json({ message: "No new manufacturing procedures to create." });
  }

  try {
    // 4. Call createMany ONLY with the list of truly new procedures.
    // Notice `skipDuplicates` is now removed.
    const result = await prisma.manufacturingProcedures.createMany({
      data: proceduresToCreate,
    });
    res.status(201).json(result);
  } catch (error) {
    console.error("Error creating manufacturing procedures:", error);
    res.status(500).json({ error: "Failed to create manufacturing procedures" });
  }
});
// UPDATE (rename) an MP
router.put('/:mp_number', protectRoute(['engineer']), async (req, res) => {
  const { mp_number } = req.params;
  const { procedure_name } = req.body;
  try {
    const updated = await prisma.manufacturingProcedures.update({
      where: { mp_number },
      data: { procedure_name },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to rename manufacturing procedure.' });
  }
});
router.get('/:mp_number/specs', protectRoute(), async (req, res) => {
  const { mp_number } = req.params;
  try {
    const specs = await prisma.configMpSpecs.findMany({
      where: { 
        mp_number,
        type: 'Variable' // We only care about variable specs for SPC
      },
      include: {
        config: {
          select: {
            config_name: true,
            product: {
              select: {
                product_name: true
              }
            }
          }
        }
      },
      orderBy: {
        config_number: 'asc'
      }
    });

    if (!specs || specs.length === 0) {
      return res.status(404).json({ error: 'No variable specs found for this procedure.' });
    }
    
    // Flatten the response for easier use on the frontend
    const flattenedSpecs = specs.map(spec => ({
      ...spec, // Include all original spec fields like lsl, usl etc.
      config_name: spec.config.config_name,
      product_name: spec.config.product.product_name,
    }));

    res.json(flattenedSpecs);
  } catch (error) {
    console.error(`Error fetching specs for MP ${mp_number}:`, error);
    res.status(500).json({ error: 'Failed to fetch specifications.' });
  }
});

// DELETE an MP
router.delete('/:mp_number', protectRoute(['engineer']), async (req, res) => {
  const { mp_number } = req.params;
  try {
    await prisma.manufacturingProcedures.delete({ where: { mp_number } });
    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2003') {
      return res.status(409).json({ error: 'Cannot delete: MP is still referenced by configurations or logs.' });
    }
    res.status(500).json({ error: 'Failed to delete manufacturing procedure.' });
  }
});

// GET all specs for a given mp_number, joined with config and product info
router.get('/:mp_number/specs', protectRoute(), async (req, res) => {
  const { mp_number } = req.params;
  try {
    const specs = await prisma.configMpSpecs.findMany({
      where: { 
        mp_number,
        type: 'Variable' // We only care about variable specs for SPC
      },
      include: {
        config: {
          select: {
            config_name: true,
            product: {
              select: {
                product_name: true
              }
            }
          }
        }
      },
      orderBy: {
        config_number: 'asc'
      }
    });

    if (!specs || specs.length === 0) {
      return res.status(404).json({ error: 'No variable specs found for this procedure.' });
    }
    
    // Flatten the response for easier use on the frontend
    const flattenedSpecs = specs.map(spec => ({
      spec_name: spec.spec_name,
      mp_number: spec.mp_number,
      config_number: spec.config_number,
      config_name: spec.config.config_name,
      product_name: spec.config.product.product_name,
    }));

    res.json(flattenedSpecs);
  } catch (error) {
    console.error(`Error fetching specs for MP ${mp_number}:`, error);
    res.status(500).json({ error: 'Failed to fetch specifications.' });
  }
});


export default router;