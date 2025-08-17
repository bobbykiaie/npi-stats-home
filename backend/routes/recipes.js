import express from 'express';
import { prisma } from '../config/db.js';
import { protectRoute } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET all recipes for a specific Config/MP combination
router.get('/:config_number/:mp_number', protectRoute(['engineer']), async (req, res) => {
    const { config_number, mp_number } = req.params;
    try {
        const recipes = await prisma.processRecipe.findMany({
            where: { config_number, mp_number },
            include: {
                equipment: true,
                parameter: true,
            },
        });
        res.json(recipes);
    } catch (error) {
        console.error("Error fetching process recipes:", error);
        res.status(500).json({ error: 'Failed to fetch process recipes.' });
    }
});

// POST to create a new recipe parameter
router.post('/', protectRoute(['engineer']), async (req, res) => {
    const { recipe_name, config_number, mp_number, equipment_id, parameters } = req.body;

    if (!Array.isArray(parameters) || parameters.length === 0) {
        return res.status(400).json({ error: 'Parameters must be a non-empty array.' });
    }

    try {
        // Use a transaction to ensure all parameters are created or none are.
        await prisma.$transaction(async (tx) => {
            // First, check if a recipe with this name already exists for this Config/MP.
            // This provides a much clearer error message than a generic unique constraint violation.
            const existingRecipe = await tx.processRecipe.findFirst({
                where: {
                    config_number,
                    mp_number,
                    recipe_name,
                }
            });

            if (existingRecipe) {
                // Throw a custom, user-friendly error if the recipe name is taken.
                throw new Error(`A recipe named "${recipe_name}" already exists for this Manufacturing Procedure. Please choose a different name.`);
            }

            // If no existing recipe is found, proceed to create the new records.
            const dataToCreate = parameters.map(p => ({
                recipe_name,
                config_number,
                mp_number,
                equipment_id: parseInt(equipment_id, 10),
                parameter_id: parseInt(p.parameter_id, 10),
                nominal_setpoint: parseFloat(p.nominal_setpoint),
                min_setpoint: parseFloat(p.min_setpoint),
                max_setpoint: parseFloat(p.max_setpoint),
            }));

            await tx.processRecipe.createMany({
                data: dataToCreate,
            });
        });

        res.status(201).json({ message: "Recipe created successfully" });

    } catch (error) {
        console.error("Error creating recipe:", error);
        // Check for our custom error message first.
        if (error.message.includes('already exists')) {
            return res.status(409).json({ error: error.message });
        }
        // Fallback for other potential database errors.
        res.status(500).json({ error: 'An unexpected error occurred while creating the recipe.' });
    }
});

// PUT to update an existing recipe parameter
router.put('/:id', protectRoute(['engineer']), async (req, res) => {
    const { id } = req.params;
    const { recipe_name, equipment_id, parameter_id, nominal_setpoint, min_setpoint, max_setpoint } = req.body;
    try {
        const updatedRecipe = await prisma.processRecipe.update({
            where: { id: parseInt(id) },
            data: {
                recipe_name,
                equipment_id: parseInt(equipment_id),
                parameter_id: parseInt(parameter_id),
                nominal_setpoint: parseFloat(nominal_setpoint),
                min_setpoint: parseFloat(min_setpoint),
                max_setpoint: parseFloat(max_setpoint),
            },
        });
        res.json(updatedRecipe);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update recipe parameter.' });
    }
});


// DELETE a recipe parameter
router.delete('/:id', protectRoute(['engineer']), async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.processRecipe.delete({
            where: { id: parseInt(id) }
        });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete recipe parameter.' });
    }
});

export default router;