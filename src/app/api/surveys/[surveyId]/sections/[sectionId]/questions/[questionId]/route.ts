import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma, QuestionType } from '@/generated/prisma';
import { authOptions } from '@/lib/authOptions';
import { getServerSession } from 'next-auth/next';

// Interfaz para el payload de actualización de pregunta
interface QuestionUpdatePayload {
  text?: string;
  type?: QuestionType;
  order?: number;
  isRequired?: boolean;
  placeholder?: string | null;
  options?: { id?: string; text?: string; order?: number; _delete?: boolean }[]; // Para actualizar, crear o eliminar opciones
}

/**
 * @swagger
 * /api/surveys/{surveyId}/sections/{sectionId}/questions/{questionId}:
 *   put:
 *     summary: Actualiza una pregunta específica.
 *     tags: [Preguntas]
 *     parameters:
 *       - in: path
 *         name: surveyId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QuestionUpdateInput'
 *     responses:
 *       200:
 *         description: Pregunta actualizada.
 *       400:
 *         description: Datos inválidos.
 *       401:
 *         description: No autorizado.
 *       404:
 *         description: Pregunta no encontrada.
 *       500:
 *         description: Error del servidor.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ surveyId: string; sectionId: string; questionId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.isAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const resolvedParams = await params;
  const { surveyId, sectionId, questionId } = resolvedParams;
  let body: QuestionUpdatePayload;

  try {
    body = await request.json();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) { // Comentario para ESLint
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido' }, { status: 400 });
  }

  const { text, type, order, isRequired, placeholder, options } = body;

  if (Object.keys(body).length === 0) {
    return NextResponse.json({ error: 'El cuerpo de la solicitud no puede estar vacío' }, { status: 400 });
  }

  if (type && !Object.values(QuestionType).includes(type)) {
    return NextResponse.json({ error: `Tipo de pregunta inválido: ${type}` }, { status: 400 });
  }

  try {
    // Verificar que la pregunta exista y pertenezca a la sección y encuesta correctas
    const existingQuestion = await prisma.question.findUnique({
      where: { id: questionId, sectionId: sectionId, section: { surveyId: surveyId } },
      include: { options: true },
    });

    if (!existingQuestion) {
      return NextResponse.json({ error: 'Pregunta no encontrada' }, { status: 404 });
    }

    const newQuestionType = type || existingQuestion.type;

    // Validación: Si se intenta dejar sin opciones a un tipo que las requiere y no se cambia el tipo.
    if (
      (newQuestionType === QuestionType.SINGLE_CHOICE || newQuestionType === QuestionType.MULTIPLE_CHOICE || newQuestionType === QuestionType.RATING_SCALE) &&
      options && options.filter(opt => !(opt._delete && opt.id)).length === 0 && // No quedan opciones activas
      (!type || type === existingQuestion.type) // Y el tipo no está cambiando a uno sin opciones
    ) {
        return NextResponse.json({ error: 'Las preguntas de opción única, múltiple o de escala de valoración deben tener al menos una opción activa.'}, { status: 400 });
    }
    
    const updateData: Prisma.QuestionUpdateInput = {};
    if (text !== undefined) updateData.text = text;
    if (type !== undefined) updateData.type = type;
    if (order !== undefined) updateData.order = order;
    if (isRequired !== undefined) updateData.isRequired = isRequired;
    // Para placeholder, permitir explícitamente null para borrarlo, o string para establecerlo/actualizarlo.
    // Si placeholder es undefined en el payload, no se toca.
    if (placeholder !== undefined) updateData.placeholder = placeholder; 

    if (options) {
      const creates: Prisma.QuestionOptionCreateWithoutQuestionInput[] = [];
      const updates: Prisma.QuestionOptionUpdateWithWhereUniqueWithoutQuestionInput[] = [];
      const deletes: string[] = []; // IDs de opciones a borrar

      for (const opt of options) {
        if (opt._delete && opt.id) {
          deletes.push(opt.id);
        } else if (opt.id) { // Opción existente para actualizar potencialmente
          const optionUpdateData: Prisma.QuestionOptionUpdateInput = {};
          let hasUpdate = false;
          if (opt.text !== undefined) { // Solo actualizar si se provee texto
            optionUpdateData.text = opt.text;
            hasUpdate = true;
          }
          if (opt.order !== undefined) { // Solo actualizar si se provee orden
            optionUpdateData.order = opt.order;
            hasUpdate = true;
          }
          if (hasUpdate) {
            updates.push({
              where: { id: opt.id },
              data: optionUpdateData,
            });
          }
        } else if (!opt.id && opt.text !== undefined) { // Nueva opción a crear (asumimos que order puede ser asignado por el backend o es 0 por defecto si no se provee)
          creates.push({ text: opt.text, order: opt.order ?? 0 }); // Asignar un orden por defecto si no viene
        }
      }

      if (newQuestionType === QuestionType.SINGLE_CHOICE || newQuestionType === QuestionType.MULTIPLE_CHOICE || newQuestionType === QuestionType.RATING_SCALE) {
        // Preparamos las operaciones para las opciones. TypeScript inferirá el tipo correcto para prismaOptionsUpdate.
        const prismaOptionsUpdate: Prisma.QuestionUpdateInput['options'] = {}; 

        if (creates.length > 0) {
          // Para crear opciones, Prisma espera un array de objetos QuestionOptionCreateWithoutQuestionInput
          prismaOptionsUpdate.create = creates.map(c => ({ text: c.text, order: c.order }));
        }
        if (updates.length > 0) {
          prismaOptionsUpdate.update = updates;
        }
        if (deletes.length > 0) {
          prismaOptionsUpdate.deleteMany = { id: { in: deletes } };
        }
        
        // Si se envían options: [] (array vacío) y no hay otras operaciones, significa borrar todas las opciones.
        if (options.length === 0 && creates.length === 0 && updates.length === 0 && deletes.length === 0) {
            prismaOptionsUpdate.deleteMany = {}; // Borra todas las opciones asociadas a la pregunta
        }

        // Solo asignar a updateData.options si hay alguna operación de opciones definida.
        if (Object.keys(prismaOptionsUpdate).length > 0) {
          updateData.options = prismaOptionsUpdate;
        }

      } else {
        // Si el tipo de pregunta actual (o el nuevo tipo) NO es de opciones,
        // y la pregunta existente TENÍA opciones, entonces hay que borrarlas.
        if (existingQuestion.options && existingQuestion.options.length > 0) { 
            updateData.options = { deleteMany: {} };
        }
      }
    } else if (options === null) {
        // Si options es explícitamente null en el payload: no se modifican las opciones existentes,
        // a menos que el TIPO de pregunta esté cambiando a uno que NO usa opciones.
        if (type && // Solo si se está cambiando el tipo
            type !== existingQuestion.type && // y el tipo es diferente
            type !== QuestionType.SINGLE_CHOICE && 
            type !== QuestionType.MULTIPLE_CHOICE &&
            type !== QuestionType.RATING_SCALE) {
            // Y el nuevo tipo no es de opciones
            if (existingQuestion.options && existingQuestion.options.length > 0) {
                updateData.options = { deleteMany: {} }; // Borrar opciones existentes
            }
        }
    }
    // Si 'options' es undefined en el payload (no se incluyó en el JSON), no se hace nada con las opciones existentes.

    // Optimización: No actualizar si no hay cambios reales en los campos directos de la pregunta Y no hay operaciones de opciones.
    const noDirectChanges = Object.keys(updateData).filter(key => key !== 'options').length === 0;
    const noOptionOperations = !updateData.options || Object.keys(updateData.options).length === 0;

    if (noDirectChanges && noOptionOperations) {
      return NextResponse.json(existingQuestion); // Devuelve la pregunta sin cambios
    }
    
    const updatedQuestion = await prisma.question.update({
      where: { id: questionId },
      data: updateData,
      include: { options: true },
    });

    return NextResponse.json(updatedQuestion);
  } catch (error) {
    console.error(`Error al actualizar pregunta ${questionId}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ error: `Error de Prisma: ${error.code}`, details: error.message, meta: error.meta }, { status: 500 });
    } else if (error instanceof Error) {
      return NextResponse.json({ error: 'Error al actualizar la pregunta', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Error desconocido al actualizar la pregunta' }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/surveys/{surveyId}/sections/{sectionId}/questions/{questionId}:
 *   delete:
 *     summary: Elimina una pregunta específica.
 *     tags: [Preguntas]
 *     parameters:
 *       - in: path
 *         name: surveyId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Pregunta eliminada.
 *       401:
 *         description: No autorizado.
 *       404:
 *         description: Pregunta no encontrada.
 *       500:
 *         description: Error del servidor.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ surveyId: string; sectionId: string; questionId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.isAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const resolvedParams = await params;
  const { surveyId, sectionId, questionId } = resolvedParams;

  try {
    // Verificar que la pregunta exista y pertenezca a la sección y encuesta correctas
    const existingQuestion = await prisma.question.findUnique({
      where: { id: questionId, sectionId: sectionId, section: { surveyId: surveyId } },
    });

    if (!existingQuestion) {
      return NextResponse.json({ error: 'Pregunta no encontrada' }, { status: 404 });
    }

    await prisma.question.delete({
      where: { id: questionId },
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(`Error al eliminar pregunta ${questionId}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Por ejemplo, si hay respuestas asociadas que impiden la eliminación (si no hay onDelete: Cascade)
      return NextResponse.json({ error: `Error de Prisma: ${error.code}`, details: error.message, meta: error.meta }, { status: 500 });
    } else if (error instanceof Error) {
      return NextResponse.json({ error: 'Error al eliminar la pregunta', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Error desconocido al eliminar la pregunta' }, { status: 500 });
  }
} 