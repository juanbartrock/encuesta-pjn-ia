'use client';

import React, { useEffect, useState } from 'react';
import SingleChoiceChart from '@/components/admin/SingleChoiceChart';

// Tipos refinados basados en la estructura de Prisma y la respuesta de la API
interface QuestionOption {
  id: string;
  text: string;
  // Otros campos relevantes de QuestionOption si los hay
}

interface Question {
  id: string;
  text: string;
  type: 'TEXT_SHORT' | 'TEXT_LONG' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'RATING_SCALE'; // Asegúrate de que estos coincidan con tu enum QuestionType
  order: number;
  required: boolean;
  placeholder?: string | null;
  options: QuestionOption[];
}

interface AnswerDetail {
  id: string;
  questionId: string;
  value?: string | null;
  textResponse?: string | null;
  selectedOptionId?: string | null;
  selectedOption?: QuestionOption | null; // Incluido desde el backend
  question: Pick<Question, 'id' | 'text' | 'type'>; // Incluimos solo lo necesario de la pregunta asociada al detalle
}

interface Answer {
  id: string;
  surveyId: string;
  createdAt: string; // O Date, dependiendo de la serialización
  answerDetails: AnswerDetail[]; // Cambiado de 'details' a 'answerDetails'
}

interface SurveyResultData {
  surveyId: string;
  surveyTitle: string;
  questions: Question[];
  answers: Answer[];
  totalResponses: number;
}

// Interfaz de Props para la página, con params como Promise para satisfacer Next.js 15
interface SurveyResultsPageClientProps {
  params: Promise<{ surveyId: string }>;
}

const TEXT_ITEMS_PER_PAGE = 5;

const SurveyResultsPage = ({ params: paramsPromise }: SurveyResultsPageClientProps) => {
  // Aunque params llega como Promise para el tipado de Next.js 15,
  // en un Client Component, esperamos que esté resuelto antes del render.
  // Cambiamos 'as any' por 'as unknown' para intentar satisfacer el linter.
  const { surveyId } = paramsPromise as unknown as { surveyId: string }; // Type assertion modificada

  const [results, setResults] = useState<SurveyResultData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [textAnswersCurrentPage, setTextAnswersCurrentPage] = useState<{ [questionId: string]: number }>({});

  useEffect(() => {
    if (surveyId) { // surveyId se usa aquí después de la aserción
      const fetchResults = async () => {
        try {
          setLoading(true);
          setError(null);
          const response = await fetch(`/api/surveys/${surveyId}/results`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Error ${response.status} al obtener resultados`);
          }
          const data: SurveyResultData = await response.json();
          setResults(data);
          const initialPagingState: { [questionId: string]: number } = {};
          data.questions.forEach(q => {
            if (q.type === 'TEXT_SHORT' || q.type === 'TEXT_LONG') {
              initialPagingState[q.id] = 1;
            }
          });
          setTextAnswersCurrentPage(initialPagingState);
        } catch (err) { 
          const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
          setError(errorMessage);
          console.error(err);
        }
        setLoading(false);
      };
      fetchResults();
    }
  }, [surveyId]);

  if (loading) {
    return (
      <div className="container mx-auto p-4 text-center">
        <p>Cargando resultados...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 text-center text-red-600">
        <p>Error: {error}</p>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="container mx-auto p-4 text-center">
        <p>No se encontraron resultados para esta encuesta.</p>
      </div>
    );
  }

  // Función para procesar y agregar respuestas
  const getAggregatedAnswers = (questionId: string, questionType: Question['type'], questionOptions: QuestionOption[]) => {
    if (!results) return null;
    const relevantAnswersDetails = results.answers.flatMap(ans => 
      ans.answerDetails ? ans.answerDetails.filter(detail => detail.questionId === questionId) : []
    );

    if (questionType === 'SINGLE_CHOICE' || questionType === 'MULTIPLE_CHOICE' || questionType === 'RATING_SCALE') {
      const counts: { [optionId: string]: { text: string, count: number } } = {};
      // Ordenar opciones: primero por el campo 'order' si existe, luego numéricamente por 'text', finalmente por 'text' literal.
      const sortedOptions = [...questionOptions].sort((a, b) => {
        // @ts-expect-error: Asumimos que 'order' puede existir en los datos de la opción y que el tipo QuestionOption local podría no tenerlo definido explícitamente.
        const orderA = typeof a.order === 'number' ? a.order : Infinity;
        // @ts-expect-error: Asumimos que 'order' puede existir en los datos de la opción y que el tipo QuestionOption local podría no tenerlo definido explícitamente.
        const orderB = typeof b.order === 'number' ? b.order : Infinity;
        if (orderA !== Infinity && orderB !== Infinity && orderA !== orderB) {
          return orderA - orderB;
        }
        const numA = parseInt(a.text, 10);
        const numB = parseInt(b.text, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return a.text.localeCompare(b.text);
      });

      sortedOptions.forEach(opt => {
        counts[opt.id] = { text: opt.text, count: 0 };
      });

      relevantAnswersDetails.forEach(detail => {
        if (detail.selectedOptionId && counts[detail.selectedOptionId]) {
          counts[detail.selectedOptionId].count++;
        }
      });
      return counts;
    }
    // Para tipos no manejados por esta lógica (ej. TEXT_SHORT, TEXT_LONG)
    return null;
  };

  const handlePageChange = (questionId: string, newPage: number) => {
    setTextAnswersCurrentPage(prev => ({
      ...prev,
      [questionId]: newPage,
    }));
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Resultados de la Encuesta: {results.surveyTitle}</h1>
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-2">Resumen General</h2>
        <p className="text-gray-700">ID de la Encuesta: <span className="font-mono">{results.surveyId}</span></p>
        <p className="text-gray-700">Total de Respuestas Recibidas: <span className="font-bold text-lg">{results.totalResponses}</span></p>
      </div>

      <div className="space-y-8">
        {results.questions.sort((a, b) => a.order - b.order).map((question) => {
          const aggregated = getAggregatedAnswers(question.id, question.type, question.options);
          
          let currentTextAnswers: AnswerDetail[] = [];
          let totalTextAnswersCount = 0;
          if (results && (question.type === 'TEXT_SHORT' || question.type === 'TEXT_LONG')) {
            const allTextAnswersForQuestion = results.answers.flatMap(ans => ans.answerDetails || [])
              .filter(detail => detail.questionId === question.id && detail.value);
            totalTextAnswersCount = allTextAnswersForQuestion.length;
            const currentPage = textAnswersCurrentPage[question.id] || 1;
            const startIndex = (currentPage - 1) * TEXT_ITEMS_PER_PAGE;
            const endIndex = startIndex + TEXT_ITEMS_PER_PAGE;
            currentTextAnswers = allTextAnswersForQuestion.slice(startIndex, endIndex);
          }

          return (
            <div key={question.id} className="bg-white shadow-md rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-1">Pregunta {question.order + 1}: {question.text}</h3>
              <p className="text-sm text-gray-500 mb-3">Tipo: {question.type}</p>

              {question.type === 'SINGLE_CHOICE' && aggregated && (
                <div>
                  <h4 className="font-medium mb-2">Distribución de Respuestas:</h4>
                  <SingleChoiceChart 
                    data={Object.values(aggregated).map(optStat => ({ 
                      name: optStat.text, 
                      count: optStat.count 
                    }))}
                  />
                </div>
              )}

              {question.type === 'MULTIPLE_CHOICE' && aggregated && (
                <div>
                  <h4 className="font-medium mb-2">Distribución de Opciones Seleccionadas (Opción Múltiple):</h4>
                  <SingleChoiceChart 
                    data={Object.values(aggregated).map(optStat => ({ 
                      name: optStat.text, 
                      count: optStat.count 
                    }))}
                  />
                </div>
              )}

              {(question.type === 'TEXT_SHORT' || question.type === 'TEXT_LONG') && results && (
                 <div>
                   <h4 className="font-medium mb-2">Respuestas de Texto ({totalTextAnswersCount} en total):</h4>
                   {currentTextAnswers.map((detail, index) => (
                       <p key={detail.id || index} className="text-sm text-gray-700 border-b py-1">{detail.value}</p>
                   ))}
                   {totalTextAnswersCount === 0 && (
                     <p className="text-sm text-gray-500">No hay respuestas de texto para esta pregunta.</p>
                   )}

                   {totalTextAnswersCount > TEXT_ITEMS_PER_PAGE && (
                    <div className="mt-4 flex justify-between items-center">
                      <button 
                        onClick={() => handlePageChange(question.id, (textAnswersCurrentPage[question.id] || 1) - 1)}
                        disabled={(textAnswersCurrentPage[question.id] || 1) === 1}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Anterior
                      </button>
                      <span className="text-sm text-gray-600">
                        Página {textAnswersCurrentPage[question.id] || 1} de {Math.ceil(totalTextAnswersCount / TEXT_ITEMS_PER_PAGE)}
                      </span>
                      <button 
                        onClick={() => handlePageChange(question.id, (textAnswersCurrentPage[question.id] || 1) + 1)}
                        disabled={(textAnswersCurrentPage[question.id] || 1) * TEXT_ITEMS_PER_PAGE >= totalTextAnswersCount}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Siguiente
                      </button>
                    </div>
                   )}
                 </div>
              )}
              {/* Nuevo bloque para RATING_SCALE */}
              {question.type === 'RATING_SCALE' && aggregated && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Distribución en Escala de Calificación:</h4>
                  <SingleChoiceChart 
                    data={Object.values(aggregated)
                      // Los datos ya vienen ordenados desde getAggregatedAnswers si sortedOptions se usó allí.
                      // Si no, se puede re-ordenar aquí si es necesario:
                      // .sort((a, b) => parseInt(a.text, 10) - parseInt(b.text, 10) || a.text.localeCompare(b.text))
                      .map(optStat => ({ 
                        name: optStat.text, 
                        count: optStat.count 
                      }))}
                  />
                  {(() => {
                    // Filtrar opciones que no son numéricas del objeto 'aggregated'
                    const numericAggregated = Object.values(aggregated)
                      .filter(optStat => !isNaN(parseInt(optStat.text, 10)));
                    
                    if (numericAggregated.length > 0) {
                      let totalValue = 0;
                      let totalCount = 0;
                      numericAggregated.forEach(optStat => {
                        totalValue += parseInt(optStat.text, 10) * optStat.count;
                        totalCount += optStat.count;
                      });
                      const average = totalCount > 0 ? (totalValue / totalCount).toFixed(2) : 'N/A';
                      return (
                        <p className="mt-3 text-sm text-gray-600">
                          Promedio de calificación: <span className="font-semibold">{average}</span> (sobre {totalCount} respuestas numéricas válidas)
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
              {/* Fin del nuevo bloque para RATING_SCALE */}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SurveyResultsPage; 