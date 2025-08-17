// backend/routes/api.js (Updated)

import express from 'express';
import authRoutes from './auth.js';
import buildsRoutes from './builds.js';
import inspectionsRoutes from './inspections.js';
import lotsRoutes from './lots.js';
import productsRouter from './products.js';
import manufacturingProceduresRouter from './manufacturingProcedures.js'; // 1. IMPORT the new router
import configurationsRouter from './configurations.js'; // Assuming you have a configurations router
import specificationsRouter from './specfications.js'
import rejectsRouter from './rejects.js'; // Assuming you have a rejects router
import processManagementRouter from './processManagement.js'; // Assuming you have a process management router
import recipes from './recipes.js'; // Assuming you have a recipes router
import favorites from './favorites.js'; 
import dashboardRoutes from './dashboard.js';
import aiRoutes from './ai.js'; // Import AI routes if needed
import settingsRoutes from './settings.js';
import cameraRoutes from './camera.js'; // Assuming you have a camera router

const router = express.Router();

router.get('/', (req, res) => res.send('API is running! 🚀'));
router.use('/auth', authRoutes);
router.use('/builds', buildsRoutes);
router.use('/inspections', inspectionsRoutes);
router.use('/lots', lotsRoutes);
router.use('/products', productsRouter);
router.use('/configurations', configurationsRouter);
router.use('/specifications', specificationsRouter);
router.use('/rejects', rejectsRouter); 
router.use('/process-management', processManagementRouter);
router.use('/recipes', recipes);
router.use('/favorites', favorites); 
router.use('/dashboard', dashboardRoutes); // Use the dashboard routes
router.use('/camera', cameraRoutes); // Assuming you have a camera router
// router.use('/ai', aiRoutes); // Use AI routes if needed
// router.use('/settings', settingsRoutes);

// 2. USE the new router at its own top-level endpoint
router.use('/manufacturing-procedures', manufacturingProceduresRouter);

export default router;