import express from 'express';
import { prisma } from '../config/db.js';
import { protectRoute } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get all active builds FOR THE CURRENT LOGGED-IN USER
// MODIFIED: This route now includes related names for a better frontend experience.
router.get('/active_builds', protectRoute(), async (req, res) => {
  try {
    const userBuilds = await prisma.activeBuilds.findMany({
      where: {
        username: req.user.username,
      },
      orderBy: {
        start_time: 'desc'
      }
    });

    if (userBuilds.length === 0) {
        return res.json([]);
    }

    // Get all unique MP and Config numbers from the builds
    const mpNumbers = [...new Set(userBuilds.map(b => b.mp_number))];
    const configNumbers = [...new Set(userBuilds.map(b => b.config_number))];

    // Fetch the names for all needed MPs and Configs in two efficient queries
    const mps = await prisma.manufacturingProcedures.findMany({
        where: { mp_number: { in: mpNumbers } },
        select: { mp_number: true, procedure_name: true }
    });

    const configs = await prisma.configurations.findMany({
        where: { config_number: { in: configNumbers } },
        select: { config_number: true, product: { select: { product_name: true } } }
    });

    // Create maps for easy look-up
    const mpMap = new Map(mps.map(mp => [mp.mp_number, mp.procedure_name]));
    const configMap = new Map(configs.map(c => [c.config_number, c.product.product_name]));

    // Add the names to each build object
    const buildsWithDetails = userBuilds.map(build => ({
        ...build,
        procedure_name: mpMap.get(build.mp_number) || 'Unknown Procedure',
        product_name: configMap.get(build.config_number) || 'Unknown Product'
    }));

    res.json(buildsWithDetails);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start a build
router.post('/start_build', protectRoute(), async (req, res) => {
  const { username, lot_number, mp_number } = req.body;

  if (req.user.username !== username) {
    return res.status(403).json({ error: "Forbidden: You can only start your own build." });
  }

  if (!username || !lot_number || !mp_number) {
    return res.status(400).json({ error: "Username, Lot Number, and MP Number are required" });
  }

  try {
    const lot = await prisma.lots.findUnique({ where: { lot_number } });
    if (!lot) return res.status(404).json({ error: "Lot number not found" });

    const existingBuild = await prisma.activeBuilds.findFirst({
        where: {
            username: username,
            lot_number: lot_number,
            mp_number: mp_number
        }
    });

    if (existingBuild) {
        return res.status(409).json({ error: "You already have an active build for this lot and procedure." });
    }

    const newBuild = await prisma.activeBuilds.create({
      data: {
        username,
        lot_number,
        config_number: lot.config_number,
        mp_number,
        start_time: new Date(),
      },
    });
    res.status(201).json(newBuild);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// End a build
router.post('/end_build', protectRoute(), async (req, res) => {
  const { username, build_id } = req.body; 

  if (req.user.username !== username) {
    return res.status(403).json({ error: "Forbidden: You can only end your own build." });
  }
  if (!build_id) {
    return res.status(400).json({ error: "A build_id is required to end a build." });
  }

  try {
    const result = await prisma.activeBuilds.delete({
      where: { 
        build_id: build_id,
        username: username 
      },
    }).catch(() => null);

    if (!result) return res.status(404).json({ error: "No active build found with that ID for this user." });
    
    res.json({ message: `✅ Build ${build_id} ended for User ${username}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
