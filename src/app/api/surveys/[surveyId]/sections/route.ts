import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { getServerSession } from "next-auth/next";

// POST /api/surveys/[surveyId]/sections - Crear una nueva sección para una encuesta
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ surveyId: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { surveyId } = await params;
  
  try {
    const survey = await prisma.survey.findUnique({ where: { id: surveyId } });
    if (!survey) {
      return NextResponse.json({ error: "Encuesta no encontrada" }, { status: 404 });
    }

    const body = await request.json();
    const { title, description, order: providedOrder } = body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return NextResponse.json({ error: "El título es obligatorio y no puede estar vacío." }, { status: 400 });
    }
    if (description && typeof description !== 'string') {
      return NextResponse.json({ error: "La descripción debe ser una cadena de texto." }, { status: 400 });
    }
    if (providedOrder !== undefined && (typeof providedOrder !== 'number' || !Number.isInteger(providedOrder) || providedOrder < 0)) {
      return NextResponse.json({ error: "El orden debe ser un número entero no negativo." }, { status: 400 });
    }

    let sectionOrder = providedOrder;

    if (sectionOrder === undefined) {
      const lastSection = await prisma.section.findFirst({
        where: { surveyId },
        orderBy: { order: 'desc' },
      });
      sectionOrder = lastSection ? lastSection.order + 1 : 0;
    } else {
      // Opcional: si se provee un orden, se podría querer reajustar el orden de otras secciones.
      // Por ahora, simplemente se usará el orden provisto.
      // Se podrían añadir validaciones para evitar órdenes duplicados si es un requisito.
    }

    const newSection = await prisma.section.create({
      data: {
        title: title.trim(),
        description: description?.trim(),
        order: sectionOrder,
        surveyId: surveyId,
      },
    });

    return NextResponse.json(newSection, { status: 201 });
  } catch (error) {
    console.error(`Error al crear sección para encuesta ${surveyId}:`, error);
    if (error instanceof SyntaxError) { // Error al parsear JSON
        return NextResponse.json({ error: "JSON malformado en el cuerpo de la solicitud" }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Error al crear la sección" },
      { status: 500 }
    );
  }
}

// GET /api/surveys/[surveyId]/sections - Listar secciones de una encuesta
export async function GET(
  request: NextRequest, // El request no se usa aquí, pero es parte de la firma
  { params }: { params: Promise<{ surveyId: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { surveyId } = await params;
  try {
    // Validar que la encuesta exista
    const survey = await prisma.survey.findUnique({ 
      where: { id: surveyId },
      include: { sections: { orderBy: { order: 'asc'} }} 
    });

    if (!survey) {
      return NextResponse.json({ error: "Encuesta no encontrada" }, { status: 404 });
    }
    
    return NextResponse.json(survey.sections);
  } catch (error) {
    console.error(`Error al obtener secciones para encuesta ${surveyId}:`, error);
    return NextResponse.json(
      { error: "Error al obtener las secciones" },
      { status: 500 }
    );
  }
} 