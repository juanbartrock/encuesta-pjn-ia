import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Corregido: importación nombrada de la instancia de Prisma
import { Prisma, QuestionType } from '@/generated/prisma'; // Tipos de Prisma desde la ruta generada
import { authOptions } from '@/lib/authOptions'; // Actualizado
import { getServerSession } from 'next-auth/next';

// La interfaz RequestContext ya no se usa directamente como tipo del segundo parámetro.
// interface RequestContext {
//   params: {
//     surveyId: string;
//     sectionId: string;
//   };
// }

// Interfaz para el payload de creación de pregunta, para validación y claridad
interface QuestionCreatePayload {
  text: string;
  type: QuestionType;
  order?: number; // Opcional, se calculará si no se provee
  isRequired?: boolean;
  options?: { text: string }[]; // Opcional, para preguntas de opción múltiple
}

/**
 * @swagger
 * /api/surveys/{surveyId}/sections/{sectionId}/questions:
 *   get:
 *     summary: Obtiene todas las preguntas de una sección específica.
 *     tags: [Preguntas]
 *     parameters:
 *       - in: path
 *         name: surveyId
 *         required: true
 *         description: ID de la encuesta.
 *         schema:
 *           type: string
 *       - in: path
 *         name: sectionId
 *         required: true
 *         description: ID de la sección.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de preguntas.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Question'
 *       401:
 *         description: No autorizado.
 *       404:
 *         description: Encuesta o sección no encontrada.
 *       500:
 *         description: Error del servidor.
 */
export async function GET(
  request: NextRequest, 
  { params }: { params: Promise<{ surveyId: string; sectionId: string; }> } // Firma corregida
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.isAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const resolvedParams = await params; // Resolver la promesa de los parámetros
  const { surveyId, sectionId } = resolvedParams;

  try {
    const section = await prisma.section.findUnique({
      where: { id: sectionId, surveyId: surveyId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { options: { orderBy: { order: 'asc' } } },
        },
      },
    });

    if (!section) {
      return NextResponse.json({ error: 'Sección no encontrada o no pertenece a la encuesta especificada' }, { status: 404 });
    }

    return NextResponse.json(section.questions);
  } catch (error) {
    console.error(`Error al obtener preguntas de la sección ${sectionId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: 'Error al obtener preguntas', details: errorMessage }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/surveys/{surveyId}/sections/{sectionId}/questions:
 *   post:
 *     summary: Crea una nueva pregunta en una sección específica.
 *     tags: [Preguntas]
 *     parameters:
 *       - in: path
 *         name: surveyId
 *         required: true
 *         description: ID de la encuesta.
 *         schema:
 *           type: string
 *       - in: path
 *         name: sectionId
 *         required: true
 *         description: ID de la sección.
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QuestionCreateInput' 
 *     responses:
 *       201:
 *         description: Pregunta creada exitosamente.
 *       400:
 *         description: Datos de entrada inválidos.
 *       401:
 *         description: No autorizado.
 *       404:
 *         description: Encuesta o sección no encontrada.
 *       500:
 *         description: Error del servidor.
 */
export async function POST(
  request: NextRequest, 
  { params }: { params: Promise<{ surveyId: string; sectionId: string; }> } // Firma corregida
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.isAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const resolvedParams = await params; // Resolver la promesa de los parámetros
  const { surveyId, sectionId } = resolvedParams;
  let body: QuestionCreatePayload;

  try {
    body = await request.json();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) { // _error sigue prefijado, pero el comentario lo silenciará explícitamente
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido' }, { status: 400 });
  }

  const { text, type, order: clientOrder, options, isRequired } = body;

  if (!text || !type) {
    return NextResponse.json({ error: 'Los campos texto y tipo son obligatorios' }, { status: 400 });
  }

  if (!Object.values(QuestionType).includes(type)) {
    return NextResponse.json({ error: `Tipo de pregunta inválido: ${type}. Tipos permitidos: ${Object.values(QuestionType).join(', ')}` }, { status: 400 });
  }
  
  if (type === QuestionType.SINGLE_CHOICE && (!options || options.length === 0)) {
    return NextResponse.json({ error: 'Las preguntas de opción única (SINGLE_CHOICE) deben tener opciones.' }, { status: 400 });
  }

  try {
    const sectionExists = await prisma.section.findUnique({
      where: { id: sectionId, surveyId: surveyId },
    });

    if (!sectionExists) {
      return NextResponse.json({ error: 'Sección no encontrada o no pertenece a la encuesta especificada' }, { status: 404 });
    }

    let finalOrder = clientOrder;
    if (clientOrder === undefined || clientOrder === null) {
        const lastQuestion = await prisma.question.findFirst({
            where: { sectionId: sectionId },
            orderBy: { order: 'desc' },
        });
        finalOrder = lastQuestion ? lastQuestion.order + 1 : 0;
    }

    const questionData: Prisma.QuestionUncheckedCreateInput = {
      text,
      type,
      order: finalOrder as number,
      isRequired: isRequired === undefined ? false : isRequired,
      sectionId: sectionId,
      options: ((type === QuestionType.SINGLE_CHOICE || type === QuestionType.MULTIPLE_CHOICE || type === QuestionType.RATING_SCALE) && options) ? 
        { create: options.map((opt: { text: string }, index: number) => ({ text: opt.text, order: index })) } : undefined,
    };
    
    const newQuestion = await prisma.question.create({
      data: questionData,
      include: { options: true }
    });

    return NextResponse.json(newQuestion, { status: 201 });
  } catch (error) {
    console.error(`Error al crear pregunta en la sección ${sectionId}:`, error);
    
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return NextResponse.json({ error: `Error de Prisma: ${error.code}`, details: error.message, meta: error.meta }, { status: 500 });
    } else if (error instanceof Error) {
        return NextResponse.json({ error: 'Error al crear la pregunta', details: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ error: 'Error desconocido al crear la pregunta' }, { status: 500 });
  }
}

// TODO: Definir los esquemas para Swagger/OpenAPI si se utiliza
// components:
//   schemas:
//     Question:
//       type: object
//       properties:
//         id:
//           type: string
//           format: uuid
//         text:
//           type: string
//         type:
//           $ref: '#/components/schemas/QuestionType'
//         order:
//           type: integer
//         isRequired:
//           type: boolean
//         includeComment:
//           type: boolean
//         createdAt:
//           type: string
//           format: date-time
//         updatedAt:
//           type: string
//           format: date-time
//         sectionId:
//           type: string
//           format: uuid
//         options:
//           type: array
//           items:
//             $ref: '#/components/schemas/QuestionOption'
//     QuestionOption:
//       type: object
//       properties:
//         id:
//           type: string
//           format: uuid
//         text:
//           type: string
//         order:
//           type: integer
//         questionId:
//           type: string
//           format: uuid
//     QuestionType:
//       type: string
//       enum: [OPEN_TEXT, SINGLE_CHOICE, MULTIPLE_CHOICE, SCALE, DATE] # Ajustar según tu enum
//     QuestionCreateInput:
//       type: object
//       required:
//         - text
//         - type
//       properties:
//         text:
//           type: string
//         type:
//           $ref: '#/components/schemas/QuestionType'
//         order:
//           type: integer
//           nullable: true
//           description: El orden de la pregunta. Si no se provee, se añade al final.
//         isRequired:
//           type: boolean
//           default: false
//         options: # Para SINGLE_CHOICE o MULTIPLE_CHOICE
//           type: array
//           items:
//             type: object
//             required:
//               - text
//             properties:
//               text:
//                 type: string
//           nullable: true 