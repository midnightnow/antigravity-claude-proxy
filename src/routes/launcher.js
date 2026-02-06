import express from 'express';
import { logger } from '../utils/logger.js';

const router = express.Router();

export default function (launcher) {
    // Launch Claude terminal
    router.post('/launch', async (req, res) => {
        try {
            const model = req.body.model;
            logger.info(`[API] Terminal launch requested (Model: ${model || 'default'})`);
            const result = await launcher.launch(model);
            res.json({
                success: true,
                platform: result.platform,
                message: 'Terminal spawned successfully'
            });
        } catch (error) {
            logger.error('[API] Launch failed:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                instructions: launcher.getManualInstructions()
            });
        }
    });

    // Validate CLI installation
    router.get('/validate-cli', async (req, res) => {
        try {
            const installed = await launcher.validateClaudeCLI();
            res.json({
                installed,
                message: installed
                    ? 'Claude CLI is installed and ready'
                    : 'Install with: npm install -g @anthropic-ai/claude-cli'
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Get manual setup instructions
    router.get('/setup-instructions', (req, res) => {
        res.json(launcher.getManualInstructions());
    });

    return router;
}
