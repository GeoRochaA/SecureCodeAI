import { Express, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  processCodeGeneration,
  analyzeExistingCode,
  getSecurityStatistics,
  getPromptHistory,
  getPromptDetails,
} from '../services/codeService.js';
import { checkAIServiceHealth } from '../ai/service.js';
import { analyzePromptSecurity } from '../security/guardrails.js';

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

export const setupRoutes = (app: Express) => {
  app.post('/api/generate', asyncHandler(async (req: Request, res: Response) => {
    const { prompt, safeMode } = req.body;

    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const userIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').toString();

    try {
      const result = await processCodeGeneration({
        prompt,
        safeMode: safeMode !== false,
        userIp,
      });

      return res.json(result);
    } catch (error: unknown) {
      return res.status(400).json({
        error: getErrorMessage(error),
        timestamp: new Date().toISOString(),
      });
    }
  }));

  app.post('/api/analyze', asyncHandler(async (req: Request, res: Response) => {
    const { code, language } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const userIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').toString();
    const result = await analyzeExistingCode({
      code,
      language,
      userIp,
    });

    return res.json(result);
  }));

  app.get('/api/statistics', asyncHandler(async (_req: Request, res: Response) => {
    const stats = await getSecurityStatistics();
    return res.json(stats);
  }));

  app.get('/api/history', asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const history = await getPromptHistory(limit);
    return res.json(history);
  }));

  app.get('/api/prompt/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const details = await getPromptDetails(id);

    if (!details) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    return res.json(details);
  }));

  app.get('/api/ai-health', asyncHandler(async (_req: Request, res: Response) => {
    const isHealthy = await checkAIServiceHealth();
    return res.json({
      status: isHealthy ? 'online' : 'offline',
      provider: process.env.AI_PROVIDER || 'ollama',
      model: process.env.AI_MODEL || 'qwen2.5-coder:0.5b',
    });
  }));

  app.post('/api/validate', asyncHandler(async (req: Request, res: Response) => {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const analysis = await analyzePromptSecurity(prompt);

    return res.json({
      isValid: !analysis.isInjectionDetected && analysis.riskLevel !== 'critical',
      riskLevel: analysis.riskLevel,
      details: analysis.details,
    });
  }));

  app.get('/api/owasp', (_req: Request, res: Response) => {
    return res.json([
      { id: 'A01', title: 'Broken Access Control', description: 'Access control failure' },
      { id: 'A02', title: 'Cryptographic Failures', description: 'Sensitive data or crypto failure' },
      { id: 'A03', title: 'Injection', description: 'SQL, command, or template injection' },
      { id: 'A04', title: 'Insecure Design', description: 'Missing secure design controls' },
      { id: 'A05', title: 'Security Misconfiguration', description: 'Unsafe runtime configuration' },
      { id: 'A06', title: 'Vulnerable and Outdated Components', description: 'Known vulnerable dependency' },
      { id: 'A07', title: 'Identification and Authentication Failures', description: 'Authentication/session failure' },
      { id: 'A08', title: 'Software and Data Integrity Failures', description: 'Integrity failure' },
      { id: 'A09', title: 'Logging and Monitoring Failures', description: 'Missing detection or audit trail' },
      { id: 'A10', title: 'Server-Side Request Forgery', description: 'SSRF' },
    ]);
  });
};
