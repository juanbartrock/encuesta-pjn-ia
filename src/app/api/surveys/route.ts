import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions"; // Actualizado

// GET: Listar todas las encuestas
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: Request) {
  // Podrías añadir lógica de paginación o filtros aquí si es necesario
  // Por ahora, asumimos que solo los admins pueden listar todas las encuestas
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const surveys = await prisma.survey.findMany({
      orderBy: {
        createdAt: "desc", // Mostrar las más recientes primero
      },
      // Podrías incluir secciones y preguntas si es necesario:
      // include: { sections: { include: { questions: true } } }
    });
    return NextResponse.json(surveys);
  } catch (error) {
    console.error("Error al obtener encuestas:", error);
    return NextResponse.json(
      { error: "Error al obtener encuestas" },
      { status: 500 }
    );
  }
}

// POST: Crear una nueva encuesta
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_) {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const { title, description, isActive, slug } = body;

  if (!title || typeof title !== 'string') {
    return NextResponse.json({ error: "El título es requerido y debe ser un string" }, { status: 400 });
  }
  
  if (!slug || typeof slug !== 'string') {
    return NextResponse.json({ error: "El slug es requerido y debe ser un string" }, { status: 400 });
  }

  try {
    const existingSurveyBySlug = await prisma.survey.findUnique({
      where: { slug },
    });
    if (existingSurveyBySlug) {
      return NextResponse.json({ error: "El slug de la encuesta ya existe. Por favor, elija otro." }, { status: 409 });
    }

    const newSurvey = await prisma.survey.create({
      data: {
        title,
        slug,
        description: description || null,
        isActive: isActive !== undefined ? isActive : false,
      },
    });
    return NextResponse.json(newSurvey, { status: 201 });
  } catch (error) {
    console.error("Error al crear la encuesta:", error);
    if (error instanceof Error && error.message.includes("Unique constraint failed on the fields: (`slug`)")) {
        return NextResponse.json({ error: "El slug de la encuesta ya existe (error de base de datos)." }, { status: 409 });
    }
    return NextResponse.json({ error: "Error al crear la encuesta" }, { status: 500 });
  }
} 