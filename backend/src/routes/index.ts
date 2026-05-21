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

export const setupRoutes = (app: Express) => {
  // ==================== API Endpoints ====================

  /**
   * POST /api/generate - Gera código com análise de segurança
   */
  app.post('/api/generate', asyncHandler(async (req: Request, res: Response) => {
    const { prompt, safeMode } = req.body;

    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt não pode estar vazio' });
    }

    const userIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').toString();

    try {
      const result = await processCodeGeneration({
        prompt,
        safeMode: safeMode !== false,
        userIp,
      });

      return res.json(result);
    } catch (error: any) {
      return res.status(400).json({
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }));

  /**
   * POST /api/analyze - Analisa código existente pelo scanner de segurança
   */
  app.post('/api/analyze', asyncHandler(async (req: Request, res: Response) => {
    const { code, language, safeMode } = req.body;

    if (!code || !language) {
      return res.status(400).json({ error: 'Código e linguagem são obrigatórios' });
    }

    const userIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').toString();
    const result = await analyzeExistingCode({
      code,
      language,
      safeMode: safeMode !== false,
      userIp,
    });

    return res.json(result);
  }));

  /**
   * GET /api/statistics - Obtém estatísticas de segurança
   */
  app.get('/api/statistics', asyncHandler(async (_req: Request, res: Response) => {
    const stats = await getSecurityStatistics();
    return res.json(stats);
  }));

  /**
   * GET /api/history - Obtém histórico de prompts
   */
  app.get('/api/history', asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const history = await getPromptHistory(limit);
    return res.json(history);
  }));

  /**
   * GET /api/prompt/:id - Obtém detalhes de um prompt específico
   */
  app.get('/api/prompt/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const details = await getPromptDetails(id);

    if (!details) {
      return res.status(404).json({ error: 'Prompt não encontrado' });
    }

    return res.json(details);
  }));

  /**
   * GET /api/ai-health - Verifica saúde do serviço de IA
   */
  app.get('/api/ai-health', asyncHandler(async (_req: Request, res: Response) => {
    const isHealthy = await checkAIServiceHealth();
    return res.json({
      status: isHealthy ? 'online' : 'offline',
      provider: process.env.AI_PROVIDER || 'ollama',
      model: process.env.AI_MODEL || 'llama3',
    });
  }));

  /**
   * POST /api/validate - Apenas valida sem gerar código
   */
  app.post('/api/validate', asyncHandler(async (req: Request, res: Response) => {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt é obrigatório' });
    }

    const analysis = await analyzePromptSecurity(prompt);

    return res.json({
      isValid: !analysis.isInjectionDetected && analysis.riskLevel !== 'crítico',
      riskLevel: analysis.riskLevel,
      details: analysis.details,
    });
  }));

  /**
   * GET /api/owasp - Retorna informações sobre OWASP Top 10
   */
  app.get('/api/owasp', (_req: Request, res: Response) => {
    const owaspTop10 = [
      {
        id: 'A01',
        title: 'Broken Access Control',
        description: 'Falha no controle de acesso',
      },
      {
        id: 'A02',
        title: 'Cryptographic Failures',
        description: 'Falhas criptográficas',
      },
      {
        id: 'A03',
        title: 'Injection',
        description: 'Injeção de código (SQL, OS, etc)',
      },
      {
        id: 'A04',
        title: 'Insecure Design',
        description: 'Design inseguro',
      },
      {
        id: 'A05',
        title: 'Security Misconfiguration',
        description: 'Configuração incorreta de segurança',
      },
      {
        id: 'A06',
        title: 'Vulnerable and Outdated Components',
        description: 'Componentes vulneráveis e desatualizados',
      },
      {
        id: 'A07',
        title: 'Authentication and Session Management Failures',
        description: 'Falhas em autenticação e gerenciamento de sessão',
      },
      {
        id: 'A08',
        title: 'Software and Data Integrity Failures',
        description: 'Falhas de integridade de software e dados',
      },
      {
        id: 'A09',
        title: 'Logging and Monitoring Failures',
        description: 'Falhas em logging e monitoramento',
      },
      {
        id: 'A10',
        title: 'Server-Side Request Forgery (SSRF)',
        description: 'Falsificação de solicitação do lado do servidor',
      },
    ];

    return res.json(owaspTop10);
  });
};
