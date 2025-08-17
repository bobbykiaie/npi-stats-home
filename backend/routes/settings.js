import express from 'express';
import { prisma } from '../config/db.js';
import { protectRoute } from '../middleware/authMiddleware.js';

const router = express.Router();

// Helper to get or create a setting with a default value
const getOrCreateSetting = async (key, defaultValue) => {
    let setting = await prisma.systemSettings.findUnique({ where: { key } });
    if (!setting) {
        setting = await prisma.systemSettings.create({
            data: { key, value: defaultValue }
        });
    }
    return setting;
};

// GET /api/settings/chatbot-status
router.get('/chatbot-status', async (req, res) => {
    try {
        const setting = await getOrCreateSetting('chatbot_enabled', 'true');
        res.json({ isEnabled: setting.value === 'true' });
    } catch (error) {
        console.error("Error fetching chatbot status:", error);
        res.status(500).json({ error: 'Failed to get chatbot status.' });
    }
});

// POST /api/settings/toggle-chatbot
// CORRECTED: This route now validates against a unique, hardcoded password.
router.post('/toggle-chatbot', protectRoute(['engineer']), async (req, res) => {
    const { password } = req.body;
    
    // The unique password required to change this setting.
    const AI_TOGGLE_PASSWORD = "TNAliso35AIEnable";

    if (!password || password !== AI_TOGGLE_PASSWORD) {
        return res.status(401).json({ error: 'Invalid password provided.' });
    }

    try {
        const currentSetting = await getOrCreateSetting('chatbot_enabled', 'true');
        const newValue = currentSetting.value === 'true' ? 'false' : 'true';
        
        const updatedSetting = await prisma.systemSettings.update({
            where: { key: 'chatbot_enabled' },
            data: { value: newValue }
        });
        
        res.json({ isEnabled: updatedSetting.value === 'true' });
    } catch (error) {
        console.error("Error toggling chatbot status:", error);
        res.status(500).json({ error: 'Failed to toggle chatbot status.' });
    }
});

export default router;
