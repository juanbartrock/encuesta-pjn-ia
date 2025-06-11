import { NextRequest, NextResponse } from 'next/server';

// Simple rate limiter storage (en producción usar Redis)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

// Función helper para rate limiting personalizado
export async function applyRateLimit(req: NextRequest): Promise<NextResponse | null> {
  // Saltar rate limiting en desarrollo si está configurado
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true') {
    return null;
  }

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
  const key = `rate_limit_${ip}`;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutos
  const maxRequests = 5;

  const requestData = requestCounts.get(key);

  if (!requestData || now > requestData.resetTime) {
    // Primera solicitud o ventana expirada
    requestCounts.set(key, {
      count: 1,
      resetTime: now + windowMs
    });
    return null;
  }

  if (requestData.count >= maxRequests) {
    // Límite excedido
    return NextResponse.json(
      { error: 'Demasiados intentos de envío. Intente nuevamente en 15 minutos.' },
      { status: 429 }
    );
  }

  // Incrementar contador
  requestData.count++;
  requestCounts.set(key, requestData);
  
  return null;
}

// Limpiar entradas expiradas periódicamente
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of requestCounts.entries()) {
    if (now > data.resetTime) {
      requestCounts.delete(key);
    }
  }
}, 5 * 60 * 1000); // Limpiar cada 5 minutos 