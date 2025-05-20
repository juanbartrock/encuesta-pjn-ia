import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { getServerSession } from "next-auth/next";

interface SectionRouteParams {
  params: Promise<{ surveyId: string; sectionId: string }>;
}

// PUT /api/surveys/[surveyId]/sections/[sectionId] - Actualizar una sección
export async function PUT(
  request: NextRequest,
  { params }: SectionRouteParams
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { surveyId, sectionId } = await params;
  
  try {
    const body = await request.json();
    const { title, description, order } = body;

    // Validaciones
    if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
      return NextResponse.json({ error: "El título no puede estar vacío si se provee." }, { status: 400 });
    }
    if (description !== undefined && description !== null && typeof description !== 'string') {
      return NextResponse.json({ error: "La descripción debe ser una cadena de texto o nula." }, { status: 400 });
    }
    if (order !== undefined && (typeof order !== 'number' || !Number.isInteger(order) || order < 0)) {
      return NextResponse.json({ error: "El orden debe ser un número entero no negativo." }, { status: 400 });
    }

    // Verificar que la sección exista y pertenezca a la encuesta
    const existingSection = await prisma.section.findUnique({
      where: { id: sectionId },
    });

    if (!existingSection || existingSection.surveyId !== surveyId) {
      return NextResponse.json({ error: "Sección no encontrada o no pertenece a la encuesta especificada." }, { status: 404 });
    }

    const dataToUpdate: { title?: string; description?: string | null; order?: number } = {};
    if (title !== undefined) dataToUpdate.title = title.trim();
    if (description !== undefined) dataToUpdate.description = description === null ? null : description.trim();
    if (order !== undefined) dataToUpdate.order = order;

    if (Object.keys(dataToUpdate).length === 0) {
        return NextResponse.json({ error: "No se proporcionaron datos para actualizar." }, { status: 400 });
    }

    // Si el orden cambia, podríamos necesitar reordenar otras secciones.
    // Esto puede ser complejo. Por ahora, si se actualiza el 'order',
    // se actualiza directamente. Una lógica más robusta podría implicar una transacción
    // para ajustar los números de orden de otras secciones para evitar conflictos o huecos,
    // dependiendo de la estrategia deseada (ej. corrimiento de ítems).
    // Por simplicidad, esta versión no implementa el reajuste automático de otras secciones.

    const updatedSection = await prisma.section.update({
      where: { id: sectionId },
      data: dataToUpdate,
    });

    return NextResponse.json(updatedSection);
  } catch (error) {
    console.error(`Error al actualizar sección ${sectionId} para encuesta ${surveyId}:`, error);
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: "JSON malformado en el cuerpo de la solicitud" }, { status: 400 });
    }
    // Prisma error P2025: Record to update not found.
    if (error instanceof Error && typeof (error as unknown as Record<string, unknown>).code === 'string' && (error as unknown as Record<string, unknown>).code === 'P2025') {
      return NextResponse.json({ error: "Sección no encontrada para actualizar" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Error al actualizar la sección" },
      { status: 500 }
    );
  }
}

// DELETE /api/surveys/[surveyId]/sections/[sectionId] - Eliminar una sección
export async function DELETE(
  request: NextRequest, // El request no se usa aquí, pero es parte de la firma
  { params }: SectionRouteParams
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { surveyId, sectionId } = await params;
  
  try {
    // Verificar que la sección exista y pertenezca a la encuesta antes de intentar eliminarla
    const sectionToDelete = await prisma.section.findUnique({
      where: { id: sectionId },
    });

    if (!sectionToDelete) {
      return NextResponse.json({ error: "Sección no encontrada." }, { status: 404 });
    }

    if (sectionToDelete.surveyId !== surveyId) {
      // Aunque la sección exista, no pertenece a la encuesta especificada en la URL.
      // Podríamos devolver 403 Forbidden o 404 Not Found. 404 es más simple.
      return NextResponse.json({ error: "Sección no encontrada en la encuesta especificada." }, { status: 404 });
    }
    
    // Eliminar la sección
    // Prisma se encargará de eliminar en cascada las preguntas y opciones asociadas
    // si así está configurado en el schema.prisma (onDelete: Cascade)
    await prisma.section.delete({
      where: { 
        id: sectionId,
      },
    });

    return new NextResponse(null, { status: 204 }); // No Content
  } catch (error) {
    console.error(`Error al eliminar sección ${sectionId} para encuesta ${surveyId}:`, error);
    // Prisma error P2025: Record to delete not found.
    if (error instanceof Error && typeof (error as unknown as Record<string, unknown>).code === 'string' && (error as unknown as Record<string, unknown>).code === 'P2025') {
      return NextResponse.json({ error: "Sección no encontrada para eliminar" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Error al eliminar la sección" },
      { status: 500 }
    );
  }
} 