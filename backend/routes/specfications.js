// Create this new file at backend/routes/specifications.js
import express from 'express';
import { prisma } from '../config/db.js';
import { protectRoute } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET all specs for a given config and mp
router.get('/:config_number/:mp_number', protectRoute(), async (req, res) => {
  const { config_number, mp_number } = req.params;
  try {
    const specs = await prisma.configMpSpecs.findMany({
      where: { config_number, mp_number },
      orderBy: { spec_name: 'asc' },
    });
    res.json(specs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch specifications.' });
  }
});

// POST to create a new spec
router.post('/', protectRoute(['engineer']), async (req, res) => {
  const { config_number, mp_number, spec_name, type, upper_spec, lower_spec, nominal, attribute_value } = req.body;
  try {
    const newSpec = await prisma.configMpSpecs.create({
      data: {
        config_number,
        mp_number,
        spec_name,
        type,
        upper_spec: upper_spec ? parseFloat(upper_spec) : null,
        lower_spec: lower_spec ? parseFloat(lower_spec) : null,
        nominal: nominal ? parseFloat(nominal) : null,
        attribute_value,
      },
    });
    res.status(201).json(newSpec);
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Spec name already exists.' });
    res.status(500).json({ error: 'Failed to create specification.' });
  }
});

// DELETE a spec
router.delete('/:config_number/:mp_number/:spec_name', protectRoute(['engineer']), async (req, res) => {
    const { config_number, mp_number, spec_name } = req.params;
    try {
        await prisma.configMpSpecs.delete({
            where: { config_number_mp_number_spec_name: { config_number, mp_number, spec_name } }
        });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete specification.' });
    }
});

// UPDATE an existing spec
router.put('/:config_number/:mp_number/:spec_name', protectRoute(['engineer']), async (req, res) => {
    const { config_number, mp_number, spec_name } = req.params;
    // For now, we only allow updating the numeric/attribute values, not the name/type
    const { upper_spec, lower_spec, nominal, attribute_value } = req.body;

    try {
        const updatedSpec = await prisma.configMpSpecs.update({
            where: { config_number_mp_number_spec_name: { config_number, mp_number, spec_name } },
            data: {
                upper_spec: upper_spec ? parseFloat(upper_spec) : null,
                lower_spec: lower_spec ? parseFloat(lower_spec) : null,
                nominal: nominal ? parseFloat(nominal) : null,
                attribute_value,
            }
        });
        res.json(updatedSpec);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update specification' });
    }
});


export default router;