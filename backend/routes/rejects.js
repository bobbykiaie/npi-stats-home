import express from 'express';
import { prisma } from '../config/db.js';
import { protectRoute } from '../middleware/authMiddleware.js';

const router = express.Router();


// GET all master reject types
router.get('/', protectRoute(['engineer']), async (req, res) => {
    try {
        const rejectTypes = await prisma.rejectType.findMany({
            orderBy: { reject_code: 'asc' }
        });
        res.json(rejectTypes);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch reject types.' });
    }
});

// POST a new master reject type
router.post('/', protectRoute(['engineer']), async (req, res) => {
    const { reject_code, description } = req.body;
    if (!reject_code || !description) {
        return res.status(400).json({ error: 'Reject code and description are required.' });
    }
    try {
        const newRejectType = await prisma.rejectType.create({
            data: { reject_code, description }
        });
        res.status(201).json(newRejectType);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'A reject with this code already exists.' });
        }
        res.status(500).json({ error: 'Failed to create reject type.' });
    }
});

// --- Product-Specific Reject Management ---

// GET all rejects for a specific product
router.get('/product/:mvd_number', protectRoute(['engineer']), async (req, res) => {
    const { mvd_number } = req.params;
    try {
        const productRejects = await prisma.productRejects.findMany({
            where: { mvd_number },
            include: {
                rejectType: true,
                assignments: { select: { mp_number: true } }
            }
        });
        res.json(productRejects);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch rejects for product.' });
    }
});

// POST to assign master reject types to a specific product
router.post('/product/:mvd_number', protectRoute(['engineer']), async (req, res) => {
    const { mvd_number } = req.params;
    const { reject_codes } = req.body;

    if (!Array.isArray(reject_codes) || reject_codes.length === 0) {
        return res.status(400).json({ error: 'reject_codes must be a non-empty array.' });
    }

    try {
        // 1. Find which of these rejects are ALREADY assigned to the product
        const existingAssignments = await prisma.productRejects.findMany({
            where: {
                mvd_number: mvd_number,
                reject_code: { in: reject_codes }
            },
            select: { reject_code: true }
        });
        const existingCodes = new Set(existingAssignments.map(a => a.reject_code));

        // 2. Filter out the codes that already exist to avoid errors
        const codesToCreate = reject_codes.filter(code => !existingCodes.has(code));

        // If all selected rejects are already assigned, no need to do anything
        if (codesToCreate.length === 0) {
            return res.status(200).json({ message: "All selected rejects were already assigned." });
        }

        // 3. Create only the new assignments
        const dataToCreate = codesToCreate.map(code => ({
            mvd_number: mvd_number,
            reject_code: code,
        }));

        const result = await prisma.productRejects.createMany({
            data: dataToCreate,
        });

        res.status(201).json(result);
    } catch (error) {
        console.error(`Failed to assign rejects to product ${mvd_number}:`, error);
        res.status(500).json({ error: 'Failed to assign rejects to product. See server logs for details.' });
    }
});


// PUT to update the MPs a specific product reject is assigned to
router.put('/product-reject/:product_reject_id/assign-mps', protectRoute(['engineer']), async (req, res) => {
    const { product_reject_id } = req.params;
    const { mp_numbers } = req.body;

    if (!Array.isArray(mp_numbers)) {
        return res.status(400).json({ error: 'mp_numbers must be an array.' });
    }
    const id = parseInt(product_reject_id);
    try {
        await prisma.$transaction([
            prisma.rejectAssignments.deleteMany({
                where: { product_reject_id: id }
            }),
            prisma.rejectAssignments.createMany({
                data: mp_numbers.map(mp => ({
                    product_reject_id: id,
                    mp_number: mp,
                }))
            })
        ]);
        res.json({ message: 'MP assignments updated successfully.' });
    } catch (error) {
        console.error("Failed to assign reject to MPs:", error);
        res.status(500).json({ error: 'Failed to update MP assignments.' });
    }
});

// --- Operator-Facing Route ---

// GET all available reject types for a specific MP
router.get('/for-mp/:mp_number', protectRoute(['operator', 'engineer']), async (req, res) => {
    const { mp_number } = req.params;
    try {
        const assignments = await prisma.rejectAssignments.findMany({
            where: { mp_number },
            include: {
                productReject: { include: { rejectType: true } }
            }
        });
        const rejects = assignments.map(a => ({
            reject_code: a.productReject.rejectType.reject_code,
            description: a.productReject.rejectType.description
        }));
        res.json(rejects);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch rejects for this MP.' });
    }
});


export default router;
