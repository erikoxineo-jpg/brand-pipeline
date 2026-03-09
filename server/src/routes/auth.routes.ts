import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { hashPassword, comparePassword } from "../lib/password";
import { signAccessToken, generateRefreshToken, hashToken, getRefreshTokenExpiry } from "../lib/jwt";
import { requireAuth } from "../middleware/auth";
import { planLimits } from "../config";

const router = Router();

// POST /api/auth/signup
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const { email, password, display_name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email e senha obrigatórios" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Email já cadastrado" });
    }

    const password_hash = await hashPassword(password);

    // Criar user + profile + workspace + membership em transação
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, password_hash },
      });

      const profile = await tx.profile.create({
        data: { user_id: user.id, display_name: display_name || null },
      });

      const workspace = await tx.workspace.create({
        data: { name: display_name || "Meu workspace" },
      });

      await tx.workspaceMember.create({
        data: { workspace_id: workspace.id, user_id: user.id, role: "owner" },
      });

      return { user, profile, workspace };
    });

    // Gerar tokens
    const accessToken = signAccessToken({ userId: result.user.id, email });
    const refreshToken = generateRefreshToken();
    await prisma.refreshToken.create({
      data: {
        user_id: result.user.id,
        token_hash: hashToken(refreshToken),
        expires_at: getRefreshTokenExpiry(),
      },
    });

    res.status(201).json({
      user: { id: result.user.id, email },
      profile: { display_name: result.profile.display_name, avatar_url: null },
      accessToken,
      refreshToken,
    });
  } catch (err: any) {
    console.error("Signup error:", err.message);
    res.status(500).json({ error: "Erro ao criar conta" });
  }
});

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email e senha obrigatórios" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const accessToken = signAccessToken({ userId: user.id, email: user.email });
    const refreshToken = generateRefreshToken();
    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token_hash: hashToken(refreshToken),
        expires_at: getRefreshTokenExpiry(),
      },
    });

    res.json({ user: { id: user.id, email: user.email }, accessToken, refreshToken });
  } catch (err: any) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: "Erro ao fazer login" });
  }
});

// POST /api/auth/refresh
router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token obrigatório" });
    }

    const tokenHash = hashToken(refreshToken);
    const stored = await prisma.refreshToken.findUnique({
      where: { token_hash: tokenHash },
      include: { user: true },
    });

    if (!stored || stored.expires_at < new Date()) {
      if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } });
      return res.status(401).json({ error: "Refresh token inválido ou expirado" });
    }

    // Rotacionar: deletar antigo, criar novo
    await prisma.refreshToken.delete({ where: { id: stored.id } });

    const newAccessToken = signAccessToken({ userId: stored.user.id, email: stored.user.email });
    const newRefreshToken = generateRefreshToken();
    await prisma.refreshToken.create({
      data: {
        user_id: stored.user.id,
        token_hash: hashToken(newRefreshToken),
        expires_at: getRefreshTokenExpiry(),
      },
    });

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err: any) {
    console.error("Refresh error:", err.message);
    res.status(500).json({ error: "Erro ao renovar token" });
  }
});

// POST /api/auth/logout
router.post("/logout", requireAuth, async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token_hash: hashToken(refreshToken) },
      });
    }
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

// GET /api/auth/me — retorna tudo que o AuthContext precisa num só request
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const [profile, memberships] = await Promise.all([
      prisma.profile.findUnique({
        where: { user_id: userId },
        select: { display_name: true, avatar_url: true },
      }),
      prisma.workspaceMember.findMany({
        where: { user_id: userId },
        select: { workspace_id: true, role: true },
      }),
    ]);

    const workspaceIds = memberships.map((m) => m.workspace_id);
    const workspaces = workspaceIds.length > 0
      ? await prisma.workspace.findMany({
          where: { id: { in: workspaceIds } },
          select: { id: true, name: true, slug: true, plan: true },
        })
      : [];

    // Buscar subscription do primeiro workspace
    let subscription = null;
    if (workspaces.length > 0) {
      const sub = await prisma.subscription.findFirst({
        where: {
          workspace_id: workspaces[0].id,
          status: { in: ["active", "overdue", "trial"] },
        },
        orderBy: { created_at: "desc" },
        select: { plan: true, status: true, billing_type: true, current_period_end: true },
      });

      if (sub) {
        subscription = {
          plan: sub.plan,
          status: sub.status,
          billingType: sub.billing_type,
          limits: planLimits[sub.plan] || planLimits.free,
          currentPeriodEnd: sub.current_period_end,
        };
      }
    }

    res.json({
      user: { id: userId, email: req.userEmail },
      profile: profile || { display_name: null, avatar_url: null },
      workspaces,
      memberships,
      subscription: subscription || {
        plan: "free",
        status: null,
        billingType: null,
        limits: planLimits.free,
        currentPeriodEnd: null,
      },
    });
  } catch (err: any) {
    console.error("Me error:", err.message);
    res.status(500).json({ error: "Erro ao carregar dados do usuário" });
  }
});

export default router;
