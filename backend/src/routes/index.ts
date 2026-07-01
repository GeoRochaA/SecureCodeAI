import { Express, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { analyzeExistingCode } from '../services/codeService.js';

const MAX_CODE_CHARS = 100_000;

export const setupRoutes = (app: Express) => {
  app.post('/api/analyze', asyncHandler(async (req: Request, res: Response) => {
    const { code, language } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Code is required' });
    }

    if (code.length > MAX_CODE_CHARS) {
      return res.status(400).json({
        error: `Code exceeds maximum size of ${MAX_CODE_CHARS} characters`,
      });
    }

    const result = await analyzeExistingCode({ code, language });
    return res.json(result);
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
