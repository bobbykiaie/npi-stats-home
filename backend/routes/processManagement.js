import express from 'express';
import { prisma } from '../config/db.js';
import { protectRoute } from '../middleware/authMiddleware.js';

const router = express.Router();

// --- Equipment Master List Routes ---

// GET all equipment and their associated parameters
router.get('/equipment', protectRoute(['engineer']), async (req, res) => {
    try {
        const equipment = await prisma.equipment.findMany({
            include: {
                parameters: {
                    include: {
                        parameter: true
                    }
                }
            },
            orderBy: { name: 'asc' }
        });
        res.json(equipment);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch equipment.' });
    }
});

// POST a new piece of equipment
router.post('/equipment', protectRoute(['engineer']), async (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Equipment name is required.' });

    try {
        const newEquipment = await prisma.equipment.create({
            data: { name, description }
        });
        res.status(201).json(newEquipment);
    } catch (error) {
        if (error.code === 'P2002') return res.status(409).json({ error: 'Equipment with this name already exists.' });
        res.status(500).json({ error: 'Failed to create equipment.' });
    }
});


// --- Parameter Master List Routes ---

// GET all master process parameters
router.get('/parameters', protectRoute(['engineer']), async (req, res) => {
    try {
        const parameters = await prisma.parameter.findMany({
            orderBy: { name: 'asc' }
        });
        res.json(parameters);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch parameters.' });
    }
});

// POST a new master process parameter
router.post('/parameters', protectRoute(['engineer']), async (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Parameter name is required.' });

    try {
        const newParameter = await prisma.parameter.create({
            data: { name, description }
        });
        res.status(201).json(newParameter);
    } catch (error) {
        if (error.code === 'P2002') return res.status(409).json({ error: 'A parameter with this name already exists.' });
        res.status(500).json({ error: 'Failed to create parameter.' });
    }
});


// --- Linking Routes ---
router.get('/equipment/:equipmentId/parameters', protectRoute(['engineer']), async (req, res) => {
    const equipmentId = parseInt(req.params.equipmentId);
    try {
        const equipmentWithParams = await prisma.equipment.findUnique({
            where: { id: equipmentId },
            include: {
                parameters: {
                    include: {
                        parameter: true // Include the actual parameter details
                    }
                }
            }
        });

        if (!equipmentWithParams) {
            return res.status(404).json({ error: 'Equipment not found.' });
        }

        // Return just the array of parameter objects for simplicity on the frontend
        const parameters = equipmentWithParams.parameters.map(p => p.parameter);
        res.json(parameters);

    } catch (error) {
        console.error(`Failed to fetch parameters for equipment ${equipmentId}:`, error);
        res.status(500).json({ error: 'Failed to fetch parameters.' });
    }
});
// POST to link a list of parameters to a piece of equipment
router.post('/equipment/:equipmentId/link-parameters', protectRoute(['engineer']), async (req, res) => {
    const equipmentId = parseInt(req.params.equipmentId);
    const { parameter_ids } = req.body; // Expects an array of parameter IDs

    if (!Array.isArray(parameter_ids)) {
        return res.status(400).json({ error: 'parameter_ids must be an array.' });
    }

    try {
        // Use a transaction to first delete old links, then create new ones.
        // This effectively "sets" the list of parameters for the equipment.
        await prisma.$transaction([
            prisma.equipmentParameter.deleteMany({
                where: { equipment_id: equipmentId }
            }),
            prisma.equipmentParameter.createMany({
                data: parameter_ids.map(paramId => ({
                    equipment_id: equipmentId,
                    parameter_id: paramId,
                }))
            })
        ]);
        res.status(200).json({ message: 'Parameters linked successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to link parameters to equipment.' });
    }
});

export default router;
