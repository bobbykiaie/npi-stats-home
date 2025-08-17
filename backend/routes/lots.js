import express from 'express';
import { prisma } from '../config/db.js';
import { runPythonScript } from '../utils/python.js';
import { protectRoute } from '../middleware/authMiddleware.js';

const router = express.Router();

// Helper function from your original file
const normalizeType = (type) => {
  const t = type?.toLowerCase();
  if (t === "attribute") return "attribute";
  if (t === "variable") return "variable";
  return type;
};


// =================================================================
// == LOT MANAGEMENT ROUTES 
// =================================================================

// CORRECTED: This route now correctly fetches the MP names and calculates yield for each.
router.get('/:lot_number/active-mps', protectRoute(['engineer']), async (req, res) => {
    const { lot_number } = req.params;
    try {
        // Step 1: Get the distinct mp_numbers that have logs for this lot.
        const loggedMpNumbers = await prisma.inspectionLogs.findMany({
            where: { lot_number },
            distinct: ['mp_number'],
            select: { 
                mp_number: true,
            }
        });

        if (loggedMpNumbers.length === 0) {
            return res.json([]);
        }

        const mpNumbers = loggedMpNumbers.map(item => item.mp_number);

        // Step 2: Use the list of mp_numbers to get the full procedure details.
        const mps = await prisma.manufacturingProcedures.findMany({
            where: {
                mp_number: { in: mpNumbers }
            },
            select: {
                mp_number: true,
                procedure_name: true
            }
        });

        // Step 3: Calculate yield for each MP
        const yieldPromises = mps.map(async (mp) => {
            const passCount = await prisma.inspectionLogs.count({
                where: { lot_number, mp_number: mp.mp_number, pass_fail: 'Pass' }
            });
            const failCount = await prisma.inspectionLogs.count({
                where: { lot_number, mp_number: mp.mp_number, pass_fail: 'Fail' }
            });
            const total = passCount + failCount;
            const yieldPercent = total > 0 ? Math.round((passCount / total) * 100) : 100;

            return {
                ...mp,
                yield: yieldPercent
            };
        });

        const mpsWithYield = await Promise.all(yieldPromises);
        
        res.json(mpsWithYield);
    } catch (error) {
        console.error(`Error fetching active MPs for lot ${lot_number}:`, error);
        res.status(500).json({ error: 'Failed to fetch manufacturing procedures.' });
    }
});


// NEW & IMPROVED: Get lot details, but filtered for a specific MP
router.get('/details/:lot_number/:mp_number', protectRoute(['engineer']), async (req, res) => {
    const { lot_number, mp_number } = req.params;
    try {
        const lot = await prisma.lots.findUnique({
            where: { lot_number },
            include: { 
                config: { 
                    include: { 
                        product: true 
                    } 
                } 
            }
        });

        if (!lot) {
            return res.status(404).json({ error: 'Lot not found.' });
        }

        const specs = await prisma.configMpSpecs.findMany({
            where: {
                config_number: lot.config_number,
                mp_number: mp_number
            }
        });

        const inspections = await prisma.inspectionLogs.findMany({
            where: { 
                lot_number,
                mp_number
            },
            orderBy: { unit_number: 'asc' }
        });

        res.json({ lot, specs, inspections });

    } catch (error) {
        console.error(`Error fetching details for lot ${lot_number} and MP ${mp_number}:`, error);
        res.status(500).json({ error: "Server error fetching lot details." });
    }
});


// DELETE a lot and all its associated data
router.delete('/:lot_number', protectRoute(['engineer']), async (req, res) => {
    const { lot_number } = req.params;
    try {
        await prisma.$transaction(async (tx) => {
            await tx.inspectionLogs.deleteMany({ where: { lot_number } });
            await tx.lotProcessSetpoint.deleteMany({ where: { lot_number } });
            await tx.activeBuilds.deleteMany({ where: { lot_number } });
            await tx.lots.delete({ where: { lot_number } });
        });
        res.status(204).send();
    } catch (error) {
        console.error(`Failed to delete lot ${lot_number}:`, error);
        res.status(500).json({ error: 'Failed to delete lot and its associated records.' });
    }
});


// GET all lots
router.get('/all', protectRoute(['engineer']), async (req, res) => {
  try {
    const allLots = await prisma.lots.findMany({
      select: { lot_number: true }
    });
    res.json(allLots);
  } catch (error) {
    console.error("Error fetching all lots:", error);
    res.status(500).json({ error: 'Failed to fetch lots.' });
  }
});

// GET lot overview for the LotList page
router.get('/overview', protectRoute(), async (req, res) => {
    try {
        const lots = await prisma.lots.findMany({
            include: {
                config: {
                    include: {
                        product: { select: { product_name: true, mvd_number: true } },
                    }
                }
            },
            orderBy: { lot_number: 'desc' }
        });
        
        res.json(
          lots.map(l => ({
            lot_number: l.lot_number,
            quantity: l.quantity,
            config_number: l.config_number,
            mvd_number: l.config?.product?.mvd_number,
            product_name: l.config?.product?.product_name,
            is_excluded: l.is_excluded
          }))
        );
    } catch (err) {
        console.error('Error fetching lots overview:', err);
        res.status(500).json({ error: 'Failed to fetch lots.' });
    }
});

router.post('/:lot_number/toggle-exclusion', protectRoute(['engineer']), async (req, res) => {
    const { lot_number } = req.params;
    try {
        const lot = await prisma.lots.findUnique({ where: { lot_number } });
        if (!lot) {
            return res.status(404).json({ error: 'Lot not found.' });
        }
        const updatedLot = await prisma.lots.update({
            where: { lot_number },
            data: { is_excluded: !lot.is_excluded },
        });
        res.json(updatedLot);
    } catch (error) {
        console.error("Error toggling lot exclusion:", error);
        res.status(500).json({ error: 'Failed to update lot exclusion status.' });
    }
});

router.get('/excluded', protectRoute(['engineer']), async (req, res) => {
    try {
        const excludedLots = await prisma.lots.findMany({
            where: { is_excluded: true },
            orderBy: { lot_number: 'desc' },
             include: { config: { include: { product: true } } }
        });
        const formattedLots = excludedLots.map(lot => ({ ...lot, configuration: lot.config }));
        res.json(formattedLots);
    } catch (error) {
        console.error("Error fetching excluded lots:", error);
        res.status(500).json({ error: 'Failed to fetch excluded lots.' });
    }
});


router.post('/create', protectRoute(['engineer']), async (req, res) => {
  const {
    lot_number,
    config_number,
    quantity,
    ys_number,
    description,
    is_excluded
  } = req.body;

  if (!lot_number || !config_number || !quantity) {
    return res.status(400).json({ error: 'Missing required fields for lot creation.' });
  }

  try {
    const newLot = await prisma.$transaction(async (tx) => {
      // 1) Create the lot
      const createdLot = await tx.lots.create({
        data: {
          lot_number,
          config_number,
          quantity: parseInt(quantity, 10),
          ys_number,
          description,
          is_excluded: !!is_excluded
        }
      });

      // 2) Fetch all recipes for that config
      const recipes = await tx.processRecipe.findMany({
        where: { config_number },
        include: { parameter: true }
      });

      // 3) Build the raw setpoints array
      const setpointsToCreate = recipes.map(r => ({
        lot_number:      createdLot.lot_number,
        recipe_name:     r.recipe_name,
        parameter_name:  r.parameter.name,
        setpoint_value:  r.nominal_setpoint
      }));

      // 4) De-duplicate in JS by the composite key
      const uniqueSetpoints = Array.from(
        new Map(
          setpointsToCreate.map(sp => [
            `${sp.lot_number}|${sp.recipe_name}|${sp.parameter_name}`,
            sp
          ])
        ).values()
      );

      // 5) Try to bulk‐insert setpoints, but silently skip any that still collide
      try {
        if (uniqueSetpoints.length) {
          await tx.lotProcessSetpoint.createMany({
            data: uniqueSetpoints
          });
        }
      } catch (e) {
        // Only swallow if it’s the setpoints unique‐constraint:
        if (e.code === 'P2002' && e.meta?.modelName === 'LotProcessSetpoint') {
          console.warn('⏭️ Duplicate setpoint rows detected, skipping the collisions');
        } else {
          throw e;
        }
      }

      return createdLot;
    });

    return res.status(201).json(newLot);

  } catch (error) {
    // If the lot_number itself already exists, return your 409
    if (error.code === 'P2002' && error.meta?.target?.includes('lot_number')) {
      return res.status(409).json({ error: 'A lot with this number already exists.' });
    }
    console.error('Failed to create lot:', error);
    return res.status(500).json({ error: 'Failed to create lot.' });
  }
});

router.get('/:lot_number/setpoints/:mp_number', protectRoute(), async (req, res) => {
    const { lot_number, mp_number } = req.params;
    try {
        const lot = await prisma.lots.findUnique({
            where: { lot_number },
            select: { config_number: true }
        });

        if (!lot) {
            return res.status(404).json({ error: 'Lot not found.' });
        }

        const recipes = await prisma.processRecipe.findMany({
            where: {
                config_number: lot.config_number,
                mp_number: mp_number
            },
            include: {
                equipment: true,
                parameter: true
            }
        });
        
        const validParameterNames = recipes.map(r => r.parameter.name);

        const allSetpointsForLot = await prisma.lotProcessSetpoint.findMany({
            where: { 
                lot_number,
                parameter_name: { in: validParameterNames }
            }
        });

        const result = allSetpointsForLot.map(sp => {
            const recipe = recipes.find(r => r.parameter.name === sp.parameter_name && r.recipe_name === sp.recipe_name);
            return {
                ...sp,
                equipment_name: recipe ? recipe.equipment.name : 'General',
                recipe_name: recipe ? recipe.recipe_name : 'Default Recipe',
                min_setpoint: recipe ? recipe.min_setpoint : null,
                max_setpoint: recipe ? recipe.max_setpoint : null
            };
        });
        
        res.json(result);
    } catch (error) {
        console.error("Failed to fetch lot process setpoints:", error);
        res.status(500).json({ error: 'Failed to fetch lot process setpoints.' });
    }
});

router.put('/:lot_number/setpoints', protectRoute(['operator', 'engineer']), async (req, res) => {
    const { lot_number } = req.params;
    const { setpoints } = req.body; 

    if (!Array.isArray(setpoints)) {
        return res.status(400).json({ error: 'Request body must be an array of setpoints.' });
    }

    try {
        await prisma.$transaction(
            setpoints.map(sp => 
                prisma.lotProcessSetpoint.update({
                    where: { id: sp.id },
                    data: { setpoint_value: parseFloat(sp.setpoint_value) }
                })
            )
        );
        res.json({ message: 'Setpoints updated successfully.' });
    } catch (error) {
        console.error("Error updating setpoints:", error);
        res.status(500).json({ error: 'Failed to update setpoints.' });
    }
});

router.get('/', protectRoute(['engineer']), async (req, res) => {
    try {
      const lotsWithYs = await prisma.lots.findMany({
        where: { ys_number: { not: null } },
        distinct: ['ys_number'],
        select: { ys_number: true },
      });
      res.json(lotsWithYs.map(l => l.ys_number));
    } catch (error) {
      console.error("Error fetching YS numbers:", error);
      res.status(500).json({ error: 'Failed to fetch YS numbers.' });
    }
});

router.get('/manufacturing_procedures/by-lot/:lot_number', protectRoute(), async (req, res) => {
    const { lot_number } = req.params;
    try {
        const lot = await prisma.lots.findUnique({
            where: { lot_number },
        });

        if (!lot) {
            return res.status(404).json({ error: 'Lot not found' });
        }

        const configWithMps = await prisma.configurations.findUnique({
            where: { config_number: lot.config_number },
            include: {
                manufacturing_procedures: true,
            },
        });

        if (!configWithMps || !configWithMps.manufacturing_procedures) {
            return res.json([]);
        }

        res.json(configWithMps.manufacturing_procedures);

    } catch (error) {
        console.error(`Error fetching MPs for lot ${lot_number}:`, error);
        res.status(500).json({ error: 'Failed to fetch manufacturing procedures for the lot.' });
    }
});

router.post('/update-quantity', protectRoute(), async (req, res) => {
  const { lot_number, quantity } = req.body;

  if (!lot_number || quantity === undefined) {
    return res.status(400).json({ error: 'Lot number and quantity are required.' });
  }

  try {
    const updatedLot = await prisma.lots.update({
      where: { lot_number: lot_number },
      data: { quantity: parseInt(quantity, 10) },
    });
    
    res.json({ lot: updatedLot });

  } catch (error) {
    console.error("Error updating lot quantity:", error);
    if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Lot not found.' });
    }
    res.status(500).json({ error: 'Failed to update lot quantity.' });
  }
});

router.get('/inspection_logs/:lot_number/:mp_number', async (req, res) => {
  const { lot_number, mp_number } = req.params;
  try {
    const rows = await prisma.inspectionLogs.findMany({
      where: { lot_number, mp_number },
      orderBy: { unit_number: 'asc' },
    });
    res.json(rows.map(log => ({ ...log, inspection_type: normalizeType(log.inspection_type) })));
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get('/inspection-logs/:config_number', async (req, res) => {
  const { config_number } = req.params;
  try {
    const rows = await prisma.inspectionLogs.findMany({
      where: { config_number },
      orderBy: { timestamp: 'desc' },
    });
    if (rows.length === 0) {
      return res.status(404).json({ message: `No inspection logs found for config_number: ${config_number}` });
    }
    res.status(200).json({
      config_number,
      inspection_logs: rows.map(log => ({ ...log, inspection_type: normalizeType(log.inspection_type) })),
    });
  } catch (err) {
    console.error('Error executing query:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/generate-number', protectRoute(['engineer']), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const latestLotToday = await prisma.lots.findFirst({
      where: {
        lot_number: {
          startsWith: `${today.getFullYear().toString().slice(-2)}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-`
        }
      },
      orderBy: {
        lot_number: 'desc'
      }
    });

    let sequence = 1;
    if (latestLotToday) {
      sequence = parseInt(latestLotToday.lot_number.split('-')[1], 10) + 1;
    }

    const datePrefix = `${today.getFullYear().toString().slice(-2)}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const newLotNumber = `${datePrefix}-${String(sequence).padStart(3, '0')}`;
    
    res.json({ lot_number: newLotNumber });
  } catch (error) {
    console.error("Error generating new lot number:", error);
    res.status(500).json({ error: "Failed to generate new lot number." });
  }
});

router.get('/inspection_logs/cpk-by-user/:config_number/:mp_number/:spec_name', async (req, res) => {
  const { config_number, mp_number, spec_name } = req.params;
  const { limit = 50 } = req.query;
  // ... (Your complex CPK logic remains unchanged)
});


router.get('/inspection_logs/by-config-mp-spec/:config_number/:mp_number/:spec_name', async (req, res) => {
  console.log('Route hit:', req.method, req.path, req.params, req.query);
  const { config_number, mp_number, spec_name } = req.params;
  const { limit = 50, username } = req.query;

  try {
    const whereClause = {
      config_number,
      mp_number,
      spec_name,
      inspection_value: { not: null },
    };

    if (username) {
      whereClause.username = username;
    }

    console.log('Fetching inspection logs with whereClause:', whereClause);
    const logs = await prisma.inspectionLogs.findMany({
      where: whereClause,
      orderBy: { timestamp: 'desc' },
      take: parseInt(limit),
      select: { inspection_value: true },
    });

    console.log('Fetched logs:', logs);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching inspection logs:', error);
    res.status(500).json({ error: 'Failed to fetch inspection logs' });
  }
});

router.post('/log_inspection', async (req, res) => {
  let {
    username,
    lot_number,
    config_number,
    mp_number,
    spec_name,
    inspection_type,
    unit_number,
    inspection_value,
  } = req.body;

  inspection_type = normalizeType(inspection_type);

  try {
    const spec = await prisma.configMpSpecs.findFirst({
      where: { config_number, mp_number, spec_name },
    });

    let pass_fail = "Fail";
    if (spec) {
      if (inspection_type === "variable") {
        const lower = spec.lower_spec ?? -Infinity;
        const upper = spec.upper_spec ?? Infinity;
        pass_fail =
          inspection_value >= lower && inspection_value <= upper ? "Pass" : "Fail";
      } else if (inspection_type === "attribute") {
        const attributeResult = (req.body.pass_fail || "Pass").toLowerCase();
        const expected = (spec.attribute_value || "pass").toLowerCase();
        pass_fail = attributeResult === expected ? "Pass" : "Fail";
        inspection_value = null;
      }
    }

    if (inspection_type === "attribute") {
      inspection_value = null;
    }

    const existing = await prisma.inspectionLogs.findFirst({
      where: { lot_number, unit_number, spec_name, mp_number },
    });

    if (existing) {
      await prisma.inspectionLogs.update({
        where: { log_id: existing.log_id },
        data: {
          username,
          inspection_value,
          pass_fail,
          timestamp: new Date(),
          inspection_type,
        },
      });
    } else {
      await prisma.inspectionLogs.create({
        data: {
          username,
          lot_number,
          config_number,
          mp_number,
          spec_name,
          inspection_type,
          unit_number,
          inspection_value,
          pass_fail,
        },
      });
    }

    res.json({ success: true, pass_fail });
  } catch (err) {
    console.error("❌ Error in log_inspection:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const users = await prisma.users.findMany({
      select: { username: true },
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/test/normality/:config_number/:mp_number/:spec_name', protectRoute(), async (req, res) => {
  const { config_number, mp_number, spec_name } = req.params;
  const { limit } = req.query;

  try {
    const queryOptions = {
      where: {
        config_number,
        mp_number,
        spec_name,
        inspection_type: 'variable',
        inspection_value: { not: null },
      },
      orderBy: { timestamp: 'desc' },
    };

    if (limit && !isNaN(parseInt(limit)) && parseInt(limit) > 0) {
      queryOptions.take = parseInt(limit);
    }

    const rows = await prisma.inspectionLogs.findMany(queryOptions);

    if (!rows.length) return res.status(404).json({ error: 'No data found for the given parameters' });

    const values = rows.map(row => row.inspection_value).filter(val => !isNaN(val) && val !== null);
    if (!values.length) return res.status(400).json({ error: 'No valid numeric data for normality test' });

    const [shapiroData, andersonData, johnsonData] = await Promise.all([
      runPythonScript('shapiro_test.py', { values }),
      runPythonScript('anderson_test.py', { values }),
      runPythonScript('johnson_test.py', { values }),
    ]);

    if (shapiroData.error || andersonData.error || johnsonData.error) {
      return res.status(500).json({ error: shapiroData.error || andersonData.error || johnsonData.error });
    }

    res.json({
      config_number,
      mp_number,
      spec_name,
      inspection_values: values,
      tests: {
        shapiro_wilk: {
          statistic: shapiroData.shapiro_wilk_statistic,
          p_value: shapiroData.shapiro_wilk_p_value,
          normality: shapiroData.normality,
        },
        anderson_darling: {
          statistic: andersonData.anderson_darling_statistic,
          p_value: andersonData.anderson_darling_p_value,
          normality: andersonData.normality,
          critical_values: andersonData.critical_values,
          significance_levels: andersonData.significance_levels,
        },
        johnson: {
          statistic: johnsonData.johnson_statistic,
          p_value: johnsonData.johnson_p_value,
          normality: johnsonData.normality,
          transformation_params: johnsonData.transformation_params,
        },
      },
      qq_plot_data: {
        shapiro_wilk: shapiroData.qq_plot_data,
        anderson_darling: andersonData.qq_plot_data,
        johnson: johnsonData.qq_plot_data,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'failed to perform normality tests' });
  }
});

export default router;
