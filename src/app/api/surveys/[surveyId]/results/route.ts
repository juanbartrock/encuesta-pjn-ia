import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma'; // Corregido: importación nombrada

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ surveyId: string }> } // Modificado: params como Promise
) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token || !token.isAdmin) {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  // Necesitamos await para resolver los params si son una Promise
  const resolvedParams = await context.params;
  const { surveyId } = resolvedParams;

  if (!surveyId) {
    return NextResponse.json({ message: 'ID de encuesta es requerido' }, { status: 400 });
  }

  try {
    const surveyWithSectionsAndQuestions = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        sections: { // Incluir secciones de la encuesta
          orderBy: { order: 'asc' }, // Ordenar secciones
          include: {
            questions: { // Dentro de cada sección, incluir preguntas
              orderBy: { order: 'asc' }, // Ordenar preguntas dentro de la sección
              include: {
                options: true, // Incluir opciones de cada pregunta
              },
            },
          },
        },
      },
    });

    if (!surveyWithSectionsAndQuestions) {
      return NextResponse.json({ message: 'Encuesta no encontrada' }, { status: 404 });
    }

    // Extraer y aplanar las preguntas para la respuesta final
    const allQuestions = surveyWithSectionsAndQuestions.sections.flatMap(section => section.questions);

    const answers = await prisma.answer.findMany({
      where: { surveyId: surveyId },
      include: {
        answerDetails: { // Corregido: el campo se llama answerDetails
          include: {
            question: true, 
            selectedOption: true,
          },
          orderBy: {
            question: {
              order: 'asc',
            }
          }
        },
      },
      orderBy: {
        submittedAt: 'desc', // Corregido: el campo se llama submittedAt
      },
    });

    const resultsData = {
      surveyId: surveyWithSectionsAndQuestions.id,
      surveyTitle: surveyWithSectionsAndQuestions.title,
      questions: allQuestions, // Usar la lista aplanada de preguntas
      answers: answers,
      totalResponses: answers.length,
    };

    return NextResponse.json(resultsData, { status: 200 });
  } catch (error) {
    console.error(`Error al obtener resultados para la encuesta ${surveyId}:`, error);
    return NextResponse.json(
      { message: 'Error interno del servidor al obtener los resultados' },
      { status: 500 }
    );
  }
} 