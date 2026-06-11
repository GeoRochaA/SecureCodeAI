// CORREÇÕES: #4, #5, #6, #7
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

const MAX_PROMPT_CHARS = 4_000;
const MAX_CODE_CHARS = 100_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IS_DEV = process.env.NODE_ENV === 'development';

// Nunca retorna detalhes internos de exceção em produção
const safeErrorMessage = (error: unknown): string => {
  if (IS_DEV) return error instanceof Error ? error.message : String(error);
  return 'Request could not be processed.';
};

export const setupRoutes = (app: Express) => {
  app.post('/api/generate', asyncHandler(async (req: Request, res: Response) => {
    const { prompt, safeMode } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // #5 — limita comprimento do prompt para evitar DoS e overflow no banco
    if (prompt.length > MAX_PROMPT_CHARS) {
      return res.status(400).json({
        error: `Prompt exceeds maximum length of ${MAX_PROMPT_CHARS} characters`,
      });
    }

    // #4 — req.ip usa X-Forwarded-For corretamente via trust proxy (server.ts)
    const userIp = req.ip || '0.0.0.0';

    try {
      const result = await processCodeGeneration({
        prompt,
        safeMode: safeMode !== false,
        userIp,
      });

      return res.json(result);
    } catch (error: unknown) {
      // #7 — nunca expõe mensagem interna de erro ao cliente em produção
      return res.status(400).json({
        error: safeErrorMessage(error),
        timestamp: new Date().toISOString(),
      });
    }
  }));

  app.post('/api/analyze', asyncHandler(async (req: Request, res: Response) => {
    const { code, language } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Code is required' });
    }

    // #6 — limita tamanho do código para evitar DoS computacional nos regex de guardrails
    if (code.length > MAX_CODE_CHARS) {
      return res.status(400).json({
        error: `Code exceeds maximum size of ${MAX_CODE_CHARS} characters`,
      });
    }

    // #4 — ip via trust proxy
    const userIp = req.ip || '0.0.0.0';

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

    // Valida formato UUID antes de consultar o banco
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: 'Invalid prompt ID format' });
    }

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

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (prompt.length > MAX_PROMPT_CHARS) {
      return res.status(400).json({
        error: `Prompt exceeds maximum length of ${MAX_PROMPT_CHARS} characters`,
      });
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
