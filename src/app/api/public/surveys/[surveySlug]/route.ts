import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// import { QuestionType } from '@/generated/prisma'; // Útil si queremos devolver el tipo - Eliminado por no usarse directamente

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ surveySlug: string }> }
) {
  try {
    const resolvedParams = await params;
    const { surveySlug } = resolvedParams;

    if (!surveySlug) {
      return NextResponse.json({ error: 'El slug de la encuesta es requerido' }, { status: 400 });
    }

    const survey = await prisma.survey.findUnique({
      where: {
        slug: surveySlug,
        isActive: true,
      },
      select: { // Nivel Raíz: Survey
        id: true,
        title: true,
        slug: true, // Asegurarnos de que el slug se devuelve
        description: true,
        sections: { // Nivel Secciones
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            order: true,
            questions: { // Nivel Preguntas
              orderBy: { order: 'asc' },
              select: {
                id: true,
                text: true,
                type: true,
                isRequired: true,
                order: true,
                placeholder: true,
                options: { // Nivel Opciones
                  orderBy: { order: 'asc' },
                  select: {
                    id: true,
                    text: true,
                    order: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!survey) {
      return NextResponse.json({ error: 'Encuesta no encontrada o no activa' }, { status: 404 });
    }

    // El objeto survey ya tiene la forma deseada gracias al uso de select anidado.
    // No es necesaria la reconstrucción manual de publicSurvey.
    return NextResponse.json(survey);

  } catch (error) {
    console.error("[API_PUBLIC_SURVEY_GET] Error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido al obtener la encuesta';
    return NextResponse.json({ error: 'Error interno del servidor al obtener la encuesta.', details: errorMessage }, { status: 500 });
  }
} 