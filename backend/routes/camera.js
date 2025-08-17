import express from 'express';
import { triggerCameraAndGetData } from './keyence.js';

const router = express.Router();

// POST /api/camera/trigger
// Triggers the camera and returns the single numeric measurement.
router.post('/trigger', async (req, res) => {
    try {
        console.log(`API received trigger request. Contacting camera...`);
        
        // Call the simplified function. It will use the default program on the camera.
        const measurements = await triggerCameraAndGetData();
        res.json({ measurements });

    } catch (error) {
        console.error('Error in /api/camera/trigger:', error);
        res.status(500).json({ error: error.message || 'Failed to get measurement from camera.' });
    }
});

export default router;