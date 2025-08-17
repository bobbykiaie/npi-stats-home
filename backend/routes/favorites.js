import express from 'express';
import { prisma } from '../config/db.js';
import { protectRoute } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET the current user's favorite specs
router.get('/', protectRoute(['engineer']), async (req, res) => {
    const userId = req.user.user_id; 
    try {
        const favorites = await prisma.userFavoriteSpec.findMany({
            where: { user_id: userId },
            include: {
                spec: {
                    include: {
                        config: {
                            include: {
                                product: true,
                            }
                        }
                    }
                }
            }
        });

        // Re-map the data to a cleaner format for the frontend
        const formattedFavorites = favorites.map(fav => ({
            ...fav.spec,
            product_name: fav.spec.config.product.product_name,
        }));
        res.json(formattedFavorites);
    } catch (error) {
        console.error("Error fetching favorites:", error);
        res.status(500).json({ error: 'Failed to fetch favorites.' });
    }
});

// POST to toggle (add/remove) a favorite spec
router.post('/toggle', protectRoute(['engineer']), async (req, res) => {
    const userId = req.user.user_id;
    const { config_number, mp_number, spec_name } = req.body;

    const favoriteData = {
        user_id: userId,
        config_number,
        mp_number,
        spec_name
    };

    try {
        const existingFavorite = await prisma.userFavoriteSpec.findUnique({
            where: { user_id_config_number_mp_number_spec_name: favoriteData }
        });

        if (existingFavorite) {
            await prisma.userFavoriteSpec.delete({
                where: { user_id_config_number_mp_number_spec_name: favoriteData }
            });
            res.json({ favorited: false });
        } else {
            await prisma.userFavoriteSpec.create({
                data: favoriteData
            });
            res.json({ favorited: true });
        }
    } catch (error) {
        console.error("Error toggling favorite:", error);
        res.status(500).json({ error: 'Failed to toggle favorite status.' });
    }
});

export default router;
