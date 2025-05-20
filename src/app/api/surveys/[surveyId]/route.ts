import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

// GET: Obtener una encuesta específica por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ surveyId: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resolvedParams = await params;
  const surveyId = resolvedParams.surveyId;

  try {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: {
            questions: {
              orderBy: { order: 'asc' },
              include: {
                options: {
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!survey) {
      return NextResponse.json({ error: "Encuesta no encontrada" }, { status: 404 });
    }

    return NextResponse.json(survey);
  } catch (error) {
    console.error(`Error al obtener la encuesta ${surveyId}:`, error);
    return NextResponse.json(
      { error: "Error al obtener la encuesta" },
      { status: 500 }
    );
  }
}

// PUT: Actualizar una encuesta específica por ID
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ surveyId: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { surveyId } = await params;
  try {
    const body = await request.json();
    const { title, description, isActive } = body;

    // Validar que al menos un campo se esté actualizando o que el título no sea vacío si se provee
    if (title === "") {
        return NextResponse.json({ error: "El título no puede estar vacío" }, { status: 400 });
    }

    const updatedSurvey = await prisma.survey.update({
      where: { id: surveyId },
      data: {
        title: title,
        description: description,
        isActive: isActive,
      },
    });
    return NextResponse.json(updatedSurvey);
  } catch (error) {
    console.error(`Error al actualizar la encuesta ${surveyId}:`, error);
    if (error instanceof Error && (error as unknown as Record<string, unknown>).code === 'P2025') {
      return NextResponse.json({ error: "Encuesta no encontrada para actualizar" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Error al actualizar la encuesta" },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar una encuesta específica por ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ surveyId: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { surveyId } = await params;

  try {
    await prisma.survey.delete({
      where: { id: surveyId },
    });
    return new NextResponse(null, { status: 204 }); 
  } catch (error) {
    console.error(`Error al eliminar la encuesta ${surveyId}:`, error);
    if (error instanceof Error && (error as unknown as Record<string, unknown>).code === 'P2025') {
      return NextResponse.json({ error: "Encuesta no encontrada para eliminar" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Error al eliminar la encuesta" },
      { status: 500 }
    );
  }
} 