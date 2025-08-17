import express from 'express';
import { prisma } from '../config/db.js';
import { runPythonScript } from '../utils/python.js';
import { protectRoute } from '../middleware/authMiddleware.js'; // Corrected import
import multer from 'multer';
import path from 'path';
import { BlobServiceClient } from '@azure/storage-blob';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

const normalizeType = (type) => {
  const t = type?.toLowerCase();
  if (t === "attribute") return "attribute";
  if (t === "variable") return "variable";
  return type;
};
const IS_PRODUCTION = !!process.env.AZURE_STORAGE_CONNECTION_STRING;
let upload;

if (IS_PRODUCTION) {
  // --- PRODUCTION: Azure Blob Storage Configuration ---
  console.log("Azure Blob Storage is configured.");
  const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
  const containerName = 'inspection-images';
  const multerMemoryStorage = multer.memoryStorage();
  upload = multer({ storage: multerMemoryStorage });

  router.post('/upload-image', protectRoute(['operator', 'engineer']), upload.single('inspectionImage'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded.' });
    }
    try {
      const containerClient = blobServiceClient.getContainerClient(containerName);
      const blobName = `${uuidv4()}${path.extname(req.file.originalname)}`;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.upload(req.file.buffer, req.file.size);
      res.json({ imageUrl: blockBlobClient.url }); // Return the full Azure URL
    } catch (error) {
      console.error("Error uploading to Azure Blob Storage:", error);
      res.status(500).json({ error: 'Image upload failed.' });
    }
  });

} else {
  // --- DEVELOPMENT: Local File System Storage Configuration ---
  console.log("Local file storage is configured.");
  const localDiskStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/'); // Save files to the 'uploads' directory
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  });
  upload = multer({ storage: localDiskStorage });

  router.post('/upload-image', protectRoute(['operator', 'engineer']), upload.single('inspectionImage'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded.' });
    }
    // Return a relative path to the file
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl });
  });
}

// NEW ROUTE: Attaches an image to a sample, creating a minimal log if necessary.
router.post('/save-image-for-sample', protectRoute(['operator', 'engineer']), async (req, res) => {
    const { lot_number, mp_number, config_number, unit_number, image_url } = req.body;

    if (!lot_number || !mp_number || !config_number || !unit_number || !image_url) {
        return res.status(400).json({ error: 'Missing required fields to save image.' });
    }

    try {
        // Find the first available spec for this MP to act as a "carrier" for the image log.
        const carrierSpec = await prisma.configMpSpecs.findFirst({
            where: { config_number, mp_number },
            orderBy: { spec_name: 'asc' }
        });

        if (!carrierSpec) {
            return res.status(404).json({ error: 'Cannot attach image: No specifications found for this manufacturing procedure.' });
        }

        // Check if a log for ANY spec already exists for this unit.
        const anyExistingLog = await prisma.inspectionLogs.findFirst({
            where: {
                lot_number,
                mp_number,
                unit_number: parseInt(unit_number, 10),
            },
            orderBy: {
                timestamp: 'desc' // Get the most recent one
            }
        });

        if (anyExistingLog) {
            // If a log exists, just update its image URL. This attaches the image to the most recent inspection activity for that sample.
            const updatedLog = await prisma.inspectionLogs.update({
                where: { log_id: anyExistingLog.log_id },
                data: { image_url }
            });
            res.json(updatedLog);
        } else {
            // If no logs exist for this sample at all, create a new minimal one.
            const newLog = await prisma.inspectionLogs.create({
                data: {
                    username: req.user.username,
                    lot_number,
                    config_number,
                    mp_number,
                    spec_name: carrierSpec.spec_name, // Use the first spec as a carrier
                    inspection_type: carrierSpec.type,
                    unit_number: parseInt(unit_number, 10),
                    pass_fail: 'INFO', // A neutral status to indicate it's not a real inspection
                    image_url,
                    inspection_value: null,
                    reject_code: null,
                }
            });
            res.status(201).json(newLog);
        }

    } catch (error) {
        console.error("Error saving image for sample:", error);
        res.status(500).json({ error: 'Failed to save image.' });
    }
});



router.put('/log/:log_id/toggle-outlier', protectRoute(['engineer']), async (req, res) => {
    const logId = parseInt(req.params.log_id, 10);
    try {
        const log = await prisma.inspectionLogs.findUnique({ where: { log_id: logId } });
        if (!log) {
            return res.status(404).json({ error: 'Inspection log not found.' });
        }
        const updatedLog = await prisma.inspectionLogs.update({
            where: { log_id: logId },
            data: { is_outlier: !log.is_outlier },
        });
        res.json(updatedLog);
    } catch (error) {
        console.error("Error toggling outlier status:", error);
        res.status(500).json({ error: 'Failed to update outlier status.' });
    }
});

// Get inspection logs by lot and MP
router.get('/inspection_logs/:lot_number/:mp_number', protectRoute(), async (req, res) => {
  const { lot_number, mp_number } = req.params;
  try {
    const logs = await prisma.inspectionLogs.findMany({
      where: {
        lot_number: lot_number,
        mp_number: mp_number,
      },
    });
    res.json(logs);
  } catch (error) {
    console.error('Error fetching inspection logs:', error);
    res.status(500).json({ error: 'Failed to fetch inspection logs' });
  }
});

// Get inspection logs by config
router.get('/inspection-logs/:config_number', protectRoute(), async (req, res) => {
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


// Get inspection logs by config, MP, and spec
router.get('/inspection_logs/cpk-by-user/:config_number/:mp_number/:spec_name', protectRoute(), async (req, res) => {
    const { config_number, mp_number, spec_name } = req.params;
    const { limit = 50, lot_number, excludeOutliers = 'true' } = req.query; // New query param

    try {
        const spec = await prisma.configMpSpecs.findUnique({
            where: { config_number_mp_number_spec_name: { config_number, mp_number, spec_name } },
            select: { lower_spec: true, upper_spec: true },
        });

        if (!spec || spec.lower_spec === null || spec.upper_spec === null) {
            return res.json([]);
        }

        const lsl = parseFloat(spec.lower_spec);
        const usl = parseFloat(spec.upper_spec);

        const whereClause = {
            config_number,
            mp_number,
            spec_name,
            inspection_value: { not: null },
            lot_number: lot_number || undefined,
        };
        if (excludeOutliers === 'true') {
            whereClause.is_outlier = false;
        }

        const logs = await prisma.inspectionLogs.findMany({
            where: whereClause,
            orderBy: { timestamp: 'desc' },
            take: lot_number ? undefined : parseInt(limit, 10),
            select: { username: true, inspection_value: true }
        });
        
        const userLogs = logs.reduce((acc, log) => {
            if (!acc[log.username]) acc[log.username] = [];
            acc[log.username].push(log.inspection_value);
            return acc;
        }, {});

        const cpkData = Object.entries(userLogs).map(([username, values]) => {
            if (values.length < 2) return null;
            const mean = values.reduce((s, v) => s + v, 0) / values.length;
            const stdDev = Math.sqrt(values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (values.length - 1));
            if (stdDev === 0) return { username, cpk: 'N/A' };
            const cpk = Math.min((usl - mean) / (3 * stdDev), (mean - lsl) / (3 * stdDev));
            return { username, cpk: cpk.toFixed(2) };
        }).filter(Boolean);

        cpkData.sort((a, b) => b.cpk - a.cpk);
        res.json(cpkData);

    } catch (error) {
        console.error('Error calculating CPK by user:', error);
        res.status(500).json({ error: 'Failed to calculate CPK by user' });
    }
});


// Get inspection logs by config, MP, and spec with username filter
router.get('/inspection_logs/by-config-mp-spec/:config_number/:mp_number/:spec_name', protectRoute(), async (req, res) => {
    const { config_number, mp_number, spec_name } = req.params;
    const { limit = 50, username, lot_number } = req.query; 
    try {
        const whereClause = { config_number, mp_number, spec_name, inspection_value: { not: null } };
        if (username) {
            whereClause.username = username;
        }
        if (lot_number) {
            whereClause.lot_number = lot_number;
        }

        const queryOptions = {
            where: whereClause,
            orderBy: { timestamp: 'desc' },
        };

        if (!lot_number) {
           queryOptions.take = parseInt(limit, 10);
        }

        const logs = await prisma.inspectionLogs.findMany(queryOptions);
        res.json(logs);
    } catch (error) {
        console.error('Error fetching inspection logs:', error);
        res.status(500).json({ error: 'Failed to fetch inspection logs' });
    }
});


// Log an inspection
router.post('/log_inspection', protectRoute(['operator', 'engineer']), async (req, res) => {
    const {
        username, lot_number, config_number, mp_number,
        spec_name, inspection_type, unit_number,
        inspection_value, pass_fail, reject_code,
        image_url, process_parameters_snapshot // This comes from the frontend
    } = req.body;

    if (!username || !lot_number || !mp_number || !spec_name || unit_number == null) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }

    try {
        // --- THIS IS THE FIX ---
        // The logic to build the snapshot on the backend has been removed.
        // The backend now trusts the snapshot sent from the frontend, which is already correctly filtered.
        
        let final_pass_fail = pass_fail;
        let final_reject_code = reject_code;

        if (inspection_type === 'Variable') {
            const value = parseFloat(inspection_value);
            if (isNaN(value)) return res.status(400).json({ error: 'A valid number is required.' });
            const spec = await prisma.configMpSpecs.findUnique({ where: { config_number_mp_number_spec_name: { config_number, mp_number, spec_name } } });
            if (!spec) return res.status(404).json({ error: 'Specification not found.' });
            let isPass = true;
            if (spec.lower_spec !== null && value < spec.lower_spec) isPass = false;
            if (spec.upper_spec !== null && value > spec.upper_spec) isPass = false;
            final_pass_fail = isPass ? 'Pass' : 'Fail';
            final_reject_code = null;
        } else {
            if (!pass_fail) return res.status(400).json({error: 'Pass/Fail status is required.'});
            if (pass_fail === 'Fail' && !reject_code) return res.status(400).json({ error: 'A reject code is required.' });
            if (pass_fail === 'Pass') final_reject_code = null;
        }
        
        const existingLog = await prisma.inspectionLogs.findFirst({
            where: { unit_number: parseInt(unit_number, 10), lot_number, mp_number, spec_name }
        });

        const dataPayload = {
            username, lot_number, config_number, mp_number, spec_name,
            inspection_type, unit_number: parseInt(unit_number, 10),
            inspection_value: inspection_type === 'Variable' ? parseFloat(inspection_value) : null,
            pass_fail: final_pass_fail,
            reject_code: final_reject_code,
            // Use the snapshot directly from the request body.
            // The frontend is responsible for ensuring it's correct and stringified.
            process_parameters_snapshot: JSON.stringify(process_parameters_snapshot),
            image_url: image_url || null,
        };

        if (existingLog) {
            const updatedLog = await prisma.inspectionLogs.update({
                where: { log_id: existingLog.log_id },
                data: dataPayload,
            });
            res.json(updatedLog);
        } else {
            const newLog = await prisma.inspectionLogs.create({
                data: dataPayload,
            });
            res.status(201).json(newLog);
        }
    } catch (error) {
        console.error("Error logging inspection:", error);
        res.status(500).json({ error: 'Failed to log inspection.' });
    }
});

// GET Yield data for a lot/mp
router.get('/yield/:lot_number/:mp_number', protectRoute(), async (req, res) => {
    const { lot_number, mp_number } = req.params;
    try {
        const allLogs = await prisma.inspectionLogs.findMany({
            where: { lot_number, mp_number },
            select: { unit_number: true, pass_fail: true }
        });

        if (allLogs.length === 0) {
            return res.json({ yield: 100, totalUnits: 0, passedUnits: 0, rejectedUnits: 0 });
        }

        const inspectedUnits = new Set(allLogs.map(log => log.unit_number));
        const totalUnits = inspectedUnits.size;

        const failedUnits = new Set(
            allLogs
                .filter(log => log.pass_fail === 'Fail')
                .map(log => log.unit_number)
        );
        const rejectedUnits = failedUnits.size;

        const passedUnits = totalUnits - rejectedUnits;
        const yieldPercent = totalUnits > 0 ? Math.round((passedUnits / totalUnits) * 100) : 100;

        res.json({
            yield: yieldPercent,
            totalUnits: totalUnits,
            passedUnits: passedUnits,
            rejectedUnits: rejectedUnits,
        });

    } catch (error) {
        console.error("Error calculating yield:", error);
        res.status(500).json({ error: 'Failed to calculate yield.' });
    }
});



// GET all inspection logs for a specific config, mp, and spec
router.get('/logs/:config_number/:mp_number/:spec_name', protectRoute(), async (req, res) => {
    const { config_number, mp_number, spec_name } = req.params;
    const { limit = 50, username, lot_number, excludeOutliers = 'true' } = req.query; 
    try {
        const whereClause = { config_number, mp_number, spec_name, inspection_value: { not: null } };
        if (username) {
            whereClause.username = username;
        }
        if (lot_number) {
            whereClause.lot_number = lot_number;
        }
        if (excludeOutliers === 'true') {
            whereClause.is_outlier = false;
        }

        const queryOptions = {
            where: whereClause,
            orderBy: { timestamp: 'asc' }, 
        };

        if (!lot_number) {
           queryOptions.take = parseInt(limit);
           queryOptions.orderBy = { timestamp: 'desc' }; 
        }

        let logs = await prisma.inspectionLogs.findMany(queryOptions);

        if (!lot_number) {
            logs = logs.reverse(); 
        }
        
        const formattedLogs = logs.map(log => ({
            ...log,
            process_parameters_snapshot: log.process_parameters_snapshot ? JSON.parse(log.process_parameters_snapshot) : {}
        }));
        
        res.json(formattedLogs);
    } catch (error) {
        console.error('Error fetching inspection logs:', error);
        res.status(500).json({ error: 'Failed to fetch inspection logs' });
    }
});
router.get('/outliers/:config_number/:mp_number/:spec_name', protectRoute(['engineer']), async (req, res) => {
    const { config_number, mp_number, spec_name } = req.params;
    try {
        const outliers = await prisma.inspectionLogs.findMany({
            where: {
                config_number,
                mp_number,
                spec_name,
                is_outlier: true, 
            },
            orderBy: {
                timestamp: 'desc',
            },
        });
        res.json(outliers);
    } catch (error) {
        console.error("Error fetching outliers:", error);
        res.status(500).json({ error: 'Failed to fetch outliers.' });
    }
});

// Get users
router.get('/users', protectRoute(), async (req, res) => {
    try {
        const users = await prisma.inspectionLogs.findMany({
            distinct: ['username'],
            select: { username: true },
            orderBy: { username: 'asc' }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch users." });
    }
});

// Normality test
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

router.get('/lots-for-spec/:config_number/:mp_number/:spec_name', protectRoute(), async (req, res) => {
  const { config_number, mp_number, spec_name } = req.params;
  try {
    const lots = await prisma.inspectionLogs.findMany({
      where: {
        config_number,
        mp_number,
        spec_name,
      },
      distinct: ['lot_number'],
      select: {
        lot_number: true,
      },
      orderBy: {
        lot_number: 'desc',
      },
    });
    res.json(lots.map(l => l.lot_number));
  } catch (error) {
    console.error(`Error fetching lots for spec:`, error);
    res.status(500).json({ error: 'Failed to fetch lots for spec.' });
  }
});

router.get('/p-chart-data/:config_number/:mp_number/:spec_name', protectRoute(['engineer']), async (req, res) => {
    const { config_number, mp_number, spec_name } = req.params;

    try {
        const logs = await prisma.inspectionLogs.findMany({
            where: {
                config_number,
                mp_number,
                spec_name,
            },
            select: {
                lot_number: true,
                pass_fail: true
            },
            orderBy: {
                lot_number: 'asc'
            }
        });

        if (logs.length === 0) {
            return res.json([]);
        }

        const dataByLot = logs.reduce((acc, log) => {
            if (!acc[log.lot_number]) {
                acc[log.lot_number] = { total: 0, failed: 0 };
            }
            acc[log.lot_number].total++;
            if (log.pass_fail === 'Fail') {
                acc[log.lot_number].failed++;
            }
            return acc;
        }, {});

        const pChartData = Object.keys(dataByLot).map(lot_number => {
            const lotData = dataByLot[lot_number];
            return {
                lot_number,
                proportion_failed: lotData.total > 0 ? lotData.failed / lotData.total : 0,
                total_inspected: lotData.total
            };
        });

        res.json(pChartData);

    } catch (error) {
        console.error("Error fetching p-chart data:", error);
        res.status(500).json({ error: 'Failed to fetch p-chart data.' });
    }
});

router.get('/reject-summary/:config_number/:mp_number/:spec_name', protectRoute(['engineer']), async (req, res) => {
    const { config_number, mp_number, spec_name } = req.params;
    const { lot_number } = req.query; 

    try {
        const whereClause = {
            config_number,
            mp_number,
            spec_name,
            pass_fail: 'Fail',
            reject_code: { not: null } 
        };

        if (lot_number) {
            whereClause.lot_number = lot_number;
        }
        
        const rejectCounts = await prisma.inspectionLogs.groupBy({
            by: ['reject_code'],
            _count: {
                reject_code: true,
            },
            where: whereClause,
            orderBy: {
                _count: {
                    reject_code: 'desc' 
                }
            }
        });

        const formattedData = rejectCounts.map(item => ({
            reject_code: item.reject_code,
            count: item._count.reject_code
        }));

        res.json(formattedData);

    } catch (error) {
        console.error("Error fetching reject summary:", error);
        res.status(500).json({ error: 'Failed to fetch reject summary.' });
    }
});

export default router;
