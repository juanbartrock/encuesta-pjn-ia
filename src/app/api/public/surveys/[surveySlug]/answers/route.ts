import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { QuestionType } from '@/generated/prisma';
import { applyRateLimit } from '@/lib/rateLimiter';

interface AnswerPayload {
  questionId: string;
  value?: string; 
  selectedOptionId?: string; 
}

interface SubmitAnswersPayload {
  surveyId: string; // El ID de la encuesta real.
  answers: AnswerPayload[];
  fingerprint?: string; // Fingerprint del navegador
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ surveySlug: string }> }
) {
  try {
    // 1. Aplicar rate limiting
    const rateLimitResult = await applyRateLimit(request);
    if (rateLimitResult) {
      return rateLimitResult; // Retorna 429 si se excede el límite
    }

    const { surveySlug } = await params;
    const body: SubmitAnswersPayload = await request.json();

    if (!body.surveyId || !body.answers || !Array.isArray(body.answers)) {
      return NextResponse.json({ error: "Payload inválido: surveyId y answers (array) son requeridos." }, { status: 400 });
    }

    // 2. Generar fingerprint si no se proporcionó uno
    let fingerprint = body.fingerprint;
    if (!fingerprint) {
      // Fallback: generar fingerprint temporal basado en timestamp
      fingerprint = `fallback_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    }

    // 3. Obtener la encuesta y sus preguntas para validación
    const surveyFromDb = await prisma.survey.findUnique({
      where: { slug: surveySlug, isActive: true },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: {
            questions: {
              orderBy: { order: 'asc' },
              select: { id: true, type: true, isRequired: true, options: { select: { id: true }} }, // Solo lo necesario para validación
            },
          },
        },
      },
    });

    if (!surveyFromDb) {
      return NextResponse.json({ error: "Encuesta no encontrada, no activa o slug incorrecto." }, { status: 404 });
    }

    // Opcional: verificar si el surveyId del body coincide con el del slug (deberían)
    if (surveyFromDb.id !== body.surveyId) {
      return NextResponse.json({ error: "Conflicto de ID de encuesta." }, { status: 400 });
    }

    // 4. Verificar si ya existe una respuesta con este fingerprint para esta encuesta
    const existingAnswer = await prisma.answer.findFirst({
      where: {
        surveyId: surveyFromDb.id,
        fingerprint: fingerprint
      }
    });

    if (existingAnswer) {
      return NextResponse.json({ 
        error: "Ya has respondido esta encuesta. Solo se permite una respuesta por persona.",
        code: "DUPLICATE_RESPONSE"
      }, { status: 409 });
    }

          // 5. Validar respuestas obligatorias y contenido de respuestas
    const allQuestions = surveyFromDb.sections.flatMap(s => s.questions);
    const receivedAnswersMap = new Map(body.answers.map(a => [a.questionId, a]));

    for (const question of allQuestions) {
      const answer = receivedAnswersMap.get(question.id);
      if (question.isRequired) {
        if (!answer) {
          return NextResponse.json({ error: `Respuesta para la pregunta obligatoria (ID: ${question.id}) no encontrada.` }, { status: 400 });
        }
        if (question.type === QuestionType.SINGLE_CHOICE && !answer.selectedOptionId) {
          return NextResponse.json({ error: `Opción no seleccionada para la pregunta obligatoria de opción única (ID: ${question.id}).` }, { status: 400 });
        }
        if ((question.type === QuestionType.TEXT_SHORT || question.type === QuestionType.TEXT_LONG) && (!answer.value || answer.value.trim() === '')) {
          return NextResponse.json({ error: `Valor vacío para la pregunta obligatoria de texto (ID: ${question.id}).` }, { status: 400 });
        }
      }
      // Validación adicional: asegurar que la opción seleccionada pertenezca a la pregunta
      if (answer && question.type === QuestionType.SINGLE_CHOICE && answer.selectedOptionId) {
        if (!question.options.find(opt => opt.id === answer.selectedOptionId)) {
          return NextResponse.json({ error: `Opción seleccionada (ID: ${answer.selectedOptionId}) no es válida para la pregunta (ID: ${question.id}).` }, { status: 400 });
        }
      }
    }

    // 6. Transacción de Prisma para crear Answer y AnswerDetails
    const newAnswerRecord = await prisma.$transaction(async (tx) => {
      // 7. Crear Answer con fingerprint real
      const createdAnswer = await tx.answer.create({
        data: {
          surveyId: surveyFromDb.id,
          fingerprint: fingerprint,
        },
      });

      // 8. Crear AnswerDetails
      const answerDetailsToCreate = body.answers
        .map(ans => {
          const question = allQuestions.find(q => q.id === ans.questionId);
          if (!question) return null; // Debería haberse capturado antes o ser un error interno

          const detail: { answerId: string; questionId: string; value?: string; selectedOptionId?: string } = {
            answerId: createdAnswer.id,
            questionId: ans.questionId,
          };

          if (question.type === QuestionType.SINGLE_CHOICE) {
            if (ans.selectedOptionId) detail.selectedOptionId = ans.selectedOptionId;
          } else {
            if (ans.value) detail.value = ans.value;
          }
          // Solo añadir a la creación si tiene un valor o una opción seleccionada (evita crear detalles vacíos para preguntas no respondidas y no obligatorias)
          if (detail.value || detail.selectedOptionId) {
            return detail;
          }
          return null;
        })
        .filter(Boolean) as { answerId: string; questionId: string; value?: string; selectedOptionId?: string }[];
      
      if (answerDetailsToCreate.length > 0) {
        await tx.answerDetail.createMany({
          data: answerDetailsToCreate,
        });
      }
      return createdAnswer;
    });

    return NextResponse.json({ message: "Respuestas enviadas y procesadas con éxito!", answerId: newAnswerRecord.id }, { status: 201 });

  } catch (error) {
    console.error(`[API_SUBMIT_ANSWERS] Error procesando respuestas para ${params ? (await params).surveySlug : 'slug desconocido'}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido al procesar las respuestas.';
    
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: "JSON malformado en el cuerpo de la solicitud" }, { status: 400 });
    }
    
    // Manejar violación de restricción única (P2002)
    if (error instanceof Error && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ 
        error: "Ya has respondido esta encuesta. Solo se permite una respuesta por persona.",
        code: "DUPLICATE_RESPONSE"
      }, { status: 409 });
    }
    
    return NextResponse.json({ error: 'Error interno del servidor al procesar las respuestas.', details: errorMessage }, { status: 500 });
  }
} 