import express from 'express';
import { prisma } from '../config/db.js';
import { protectRoute } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET all specs for a specific MP within a configuration
router.get('/:config_number/mps/:mp_number/specs', protectRoute(), async (req, res) => {
  const { config_number, mp_number } = req.params;
  try {
    const specs = await prisma.configMpSpecs.findMany({
      where: { config_number, mp_number },
      orderBy: { spec_name: 'asc' }
    });
    if (!specs) {
      return res.status(404).json({ error: 'No specifications found.' });
    }
    const filteredSpecs = specs.filter(spec => spec.spec_name !== 'PLACEHOLDER_DO_NOT_DELETE');
    res.json(filteredSpecs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch specifications.' });
  }
});

// GET all MPs associated with a specific configuration
router.get('/:config_number/mps', protectRoute(), async (req, res) => {
  const { config_number } = req.params;
  try {
    const configWithMps = await prisma.configurations.findUnique({
      where: { config_number },
      include: { manufacturing_procedures: true },
    });
    if (!configWithMps) {
      return res.status(404).json({ error: 'Configuration not found' });
    }
    res.json(configWithMps.manufacturing_procedures);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch associated MPs.' });
  }
});


// UPDATE the list of MPs for a specific configuration
router.put('/:config_number/mps', protectRoute(['engineer']), async (req, res) => {
  const { config_number } = req.params;
  const { mp_numbers, associate } = req.body; // Check for the 'associate' flag

  if (!Array.isArray(mp_numbers)) {
    return res.status(400).json({ error: 'mp_numbers must be an array.' });
  }

  try {
    // --- THIS IS THE FIX ---
    // If 'associate' is true, we ONLY ADD the new MP.
    // Otherwise, we SET the list to the new list (for syncing).
    const dataOperation = associate
      ? { connect: mp_numbers.map(mp_number => ({ mp_number })) }
      : { set: mp_numbers.map(mp_number => ({ mp_number })) };

    const updatedConfig = await prisma.configurations.update({
      where: { config_number },
      data: {
        manufacturing_procedures: dataOperation
      }
    });
    
    res.json({ message: 'Associations updated successfully.', data: updatedConfig });
  } catch (err) {
    console.error('Association update failed:', err);
    res.status(500).json({ error: 'Failed to update associations.' });
  }
});


// CREATE a new configuration for a product
router.post('/', protectRoute(['engineer']), async (req, res) => {
  const { mvd_number, config_number, config_name } = req.body;
  try {
    const newConfig = await prisma.configurations.create({
      data: { mvd_number, config_number, config_name },
    });
    res.status(201).json(newConfig);
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'This Configuration Number already exists.' });
    res.status(500).json({ error: 'Failed to create configuration.' });
  }
});

// RENAME a configuration
router.put('/:config_number', protectRoute(['engineer']), async (req, res) => {
    const { config_number } = req.params;
    const { config_name, mvd_number } = req.body;
    try {
        const updatedConfig = await prisma.configurations.update({
            where: { config_number },
            data: { config_name, ...(mvd_number && { mvd_number })},
        });
        res.json(updatedConfig);
    } catch (error) {
        res.status(500).json({ error: 'Failed to rename configuration.' });
    }
});

// DELETE a configuration
router.delete('/:config_number', protectRoute(['engineer']), async (req, res) => {
  const { config_number } = req.params;
  try {
    await prisma.configurations.delete({ where: { config_number } });
    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2003') return res.status(409).json({ error: 'Cannot delete: configuration is in use by Lots or has Specs.' });
    res.status(500).json({ error: 'Failed to delete configuration.' });
  }
});

export default router;
