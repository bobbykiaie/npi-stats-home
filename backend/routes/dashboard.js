import express from 'express';
import { prisma } from '../config/db.js';
import { protectRoute } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/dashboard/stats
router.get('/stats', protectRoute(['engineer']), async (req, res) => {
    try {
        const sevenDaysAgo = new Date(new Date().setDate(new Date().getDate() - 7));

        const activeLotsCount = await prisma.lots.count({
            where: { is_excluded: false } 
        });

        const recentBuildsCount = await prisma.activeBuilds.count({
            where: { start_time: { gte: sevenDaysAgo } }
        });

        const passCount = await prisma.inspectionLogs.count({
            where: { 
                timestamp: { gte: sevenDaysAgo },
                pass_fail: 'Pass'
            }
        });

        const failCount = await prisma.inspectionLogs.count({
            where: { 
                timestamp: { gte: sevenDaysAgo },
                pass_fail: 'Fail'
            }
        });

        const totalInspections = passCount + failCount;
        const overallYield = totalInspections > 0 ? ((passCount / totalInspections) * 100).toFixed(1) : "100.0";

        res.json({
            activeLots: activeLotsCount,
            recentBuilds: recentBuildsCount,
            yield: parseFloat(overallYield)
        });

    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        res.status(500).json({ error: 'Failed to fetch dashboard statistics.' });
    }
});

// GET /api/dashboard/all-active-builds-yield
// CORRECTED: This endpoint now correctly filters by product ID.
router.get('/all-active-builds-yield', protectRoute(['engineer']), async (req, res) => {
    const { productId } = req.query;

    try {
        const whereClause = {};

        // If a specific product is selected, we first need to find all its configurations.
        if (productId && productId !== 'All') {
            const productConfigs = await prisma.configurations.findMany({
                where: { mvd_number: productId },
                select: { config_number: true }
            });

            if (productConfigs.length === 0) {
                return res.json([]); // No configs for this product, so no active builds.
            }

            const configNumbers = productConfigs.map(c => c.config_number);
            whereClause.config_number = { in: configNumbers };
        }

        const activeBuilds = await prisma.activeBuilds.findMany({
            where: whereClause,
            select: {
                build_id: true,
                lot_number: true,
                mp_number: true,
                username: true,
                config_number: true // Select the config_number to link to product name
            },
            orderBy: {
                start_time: 'desc'
            }
        });

        if (activeBuilds.length === 0) {
            return res.json([]);
        }

        // --- Enrich builds with product names ---
        const allConfigNumbers = [...new Set(activeBuilds.map(b => b.config_number))];
        const configsWithProducts = await prisma.configurations.findMany({
            where: { config_number: { in: allConfigNumbers } },
            select: {
                config_number: true,
                product: { select: { product_name: true } }
            }
        });
        const productNameMap = new Map(configsWithProducts.map(c => [c.config_number, c.product.product_name]));
        // --- End enrichment ---


        const yieldPromises = activeBuilds.map(async (build) => {
            const passCount = await prisma.inspectionLogs.count({
                where: { lot_number: build.lot_number, mp_number: build.mp_number, pass_fail: 'Pass' }
            });
            const failCount = await prisma.inspectionLogs.count({
                where: { lot_number: build.lot_number, mp_number: build.mp_number, pass_fail: 'Fail' }
            });
            const total = passCount + failCount;
            const yieldPercent = total > 0 ? ((passCount / total) * 100).toFixed(1) : "100.0";
            
            return {
                ...build,
                product_name: productNameMap.get(build.config_number) || 'Unknown Product',
                yield: parseFloat(yieldPercent),
                passed: passCount,
                failed: failCount
            };
        });

        const buildsWithYield = await Promise.all(yieldPromises);
        res.json(buildsWithYield);

    } catch (error) {
        console.error("Error fetching all active builds yield:", error);
        res.status(500).json({ error: 'Failed to fetch build yields.' });
    }
});


export default router;
