'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, ChangeEvent, FormEvent } from 'react';
import PrivacyPolicyModal from '@/components/survey/PrivacyPolicyModal';
import { QuestionType } from '@/generated/prisma'; // Para usar el tipo QuestionType
import { getSurveyFingerprint } from '@/lib/fingerprint';

// Interfaces para los datos de la encuesta pública
interface PublicQuestionOption {
  id: string;
  text: string;
  order: number;
}

interface PublicQuestion {
  id: string;
  text: string;
  type: QuestionType;
  isRequired: boolean;
  order: number;
  placeholder?: string | null;
  options: PublicQuestionOption[];
}

interface PublicSection {
  id: string;
  title: string;
  description?: string | null;
  order: number;
  questions: PublicQuestion[];
}

interface PublicSurveyData {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  sections: PublicSection[];
}

// Interface para el payload que se enviará al backend
interface AnswerPayloadEntry {
  questionId: string;
  value?: string;
  selectedOptionId?: string;
  // selectedOptionIds?: string[]; // Considerar para MULTIPLE_CHOICE si el backend se adapta
}

export default function SurveyPage() {
  const params = useParams();
  const router = useRouter();
  const surveySlug = params.surveySlug as string;

  // const [surveyTitle, setSurveyTitle] = useState<string | null>(null); // Reemplazado por surveyData
  const [surveyData, setSurveyData] = useState<PublicSurveyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  // Modificado para soportar MULTIPLE_CHOICE: { [optionId: string]: boolean }
  const [answers, setAnswers] = useState<{ [questionId: string]: string | { [optionId: string]: boolean } }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  const handleInputChange = (
    questionId: string,
    value: string,
    questionType: QuestionType,
    optionId?: string // Solo para MULTIPLE_CHOICE
  ) => {
    setAnswers(prevAnswers => {
      const newAnswers = { ...prevAnswers };
      if (questionType === QuestionType.MULTIPLE_CHOICE && optionId) {
        const currentOptions = (newAnswers[questionId] as { [optId: string]: boolean }) || {};
        newAnswers[questionId] = {
          ...currentOptions,
          [optionId]: !currentOptions[optionId], // Toggle
        };
      } else {
        newAnswers[questionId] = value;
      }
      return newAnswers;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    if (!surveyData || !surveyData.id) {
      setSubmitError("No se han cargado los datos de la encuesta para el envío.");
      setIsSubmitting(false);
      return;
    }

    // Validación de respuestas obligatorias antes de enviar
    for (const section of surveyData.sections) {
      for (const question of section.questions) {
        if (question.isRequired) {
          const answer = answers[question.id];
          if (!answer) { // Cubre undefined
            setSubmitError(`La pregunta "${question.text}" es obligatoria.`);
            setIsSubmitting(false);
            return;
          }
          if (typeof answer === 'string' && answer.trim() === '') { // Para TEXT_SHORT, TEXT_LONG
            setSubmitError(`La pregunta "${question.text}" es obligatoria.`);
            setIsSubmitting(false);
            return;
          }
          if (question.type === QuestionType.MULTIPLE_CHOICE) {
            const selectedOptions = answer as { [optionId: string]: boolean };
            if (!Object.values(selectedOptions).some(isSelected => isSelected)) {
              setSubmitError(`Debe seleccionar al menos una opción para la pregunta "${question.text}".`);
              setIsSubmitting(false);
              return;
            }
          }
          // Para SINGLE_CHOICE, la existencia de un string no vacío es suficiente y ya cubierto.
        }
      }
    }

    const transformedAnswers: AnswerPayloadEntry[] = [];
    Object.keys(answers).forEach(questionId => {
      const question = surveyData.sections
        .flatMap(sec => sec.questions)
        .find(q => q.id === questionId);

      if (!question) return;

      const answerValue = answers[questionId];

      if (question.type === QuestionType.SINGLE_CHOICE || question.type === QuestionType.RATING_SCALE) {
        if (typeof answerValue === 'string' && answerValue.trim() !== '') {
          transformedAnswers.push({ questionId, selectedOptionId: answerValue });
        }
      } else if (question.type === QuestionType.MULTIPLE_CHOICE) {
        if (typeof answerValue === 'object' && answerValue !== null) {
          const selectedOptionIds = Object.keys(answerValue).filter(
            optId => (answerValue as { [optId: string]: boolean })[optId]
          );
          selectedOptionIds.forEach(optId => {
            transformedAnswers.push({ questionId, selectedOptionId: optId });
          });
        }
      } else { // TEXT_SHORT, TEXT_LONG (y cualquier otro tipo futuro que use 'value')
        if (typeof answerValue === 'string' && answerValue.trim() !== '') {
          transformedAnswers.push({ questionId, value: answerValue });
        }
      }
    });
    
    if (transformedAnswers.length === 0 && Object.keys(answers).length > 0) {
        // Esto podría pasar si todas las respuestas son opcionales y se dejan vacías,
        // o si hay un error en la lógica de transformación y no se produce ninguna entrada válida.
        // Dependiendo del caso, podría ser un error o un envío válido sin datos.
        // Por ahora, asumimos que si hay 'answers' pero no 'transformedAnswers', es un problema si hay preguntas.
        let hasQuestions = false;
        surveyData.sections.forEach(s => {
            if (s.questions.length > 0) hasQuestions = true;
        });
        if (hasQuestions) {
             console.warn("Se intentó enviar respuestas pero no se transformó ninguna entrada válida.");
            // setSubmitError("No se pudo procesar ninguna respuesta para el envío.");
            // setIsSubmitting(false);
            // return;
        }
    }


    try {
      const response = await fetch(`/api/public/surveys/${surveySlug}/answers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          surveyId: surveyData.id, 
          answers: transformedAnswers,
          fingerprint: fingerprint || undefined // Incluir fingerprint si está disponible
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        // Manejar casos específicos de error
        if (response.status === 409 && responseData.code === 'DUPLICATE_RESPONSE') {
          setSubmitError('Ya has respondido esta encuesta. Solo se permite una respuesta por persona.');
          setIsSubmitting(false);
          return;
        }
        if (response.status === 429) {
          setSubmitError('Demasiados intentos de envío. Por favor intente nuevamente en 15 minutos.');
          setIsSubmitting(false);
          return;
        }
        throw new Error(responseData.error || responseData.details || 'Error al enviar las respuestas.');
      }

      // Éxito: Redirigir a la página de agradecimiento
      router.push(`/survey/${surveySlug}/thank-you`);

    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Ocurrió un error desconocido al enviar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchPublicSurvey = useCallback(async () => {
    if (!surveySlug) {
      setError("No se ha especificado un slug de encuesta.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`/api/public/surveys/${surveySlug}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error al cargar la encuesta: ${response.statusText} (${response.status})`);
      }
      const data: PublicSurveyData = await response.json();
      setSurveyData(data);
      
      // Generar fingerprint para esta encuesta
      try {
        const fp = await getSurveyFingerprint(data.id);
        setFingerprint(fp);
      } catch (err) {
        console.error('Error generando fingerprint:', err);
        // Continuar sin fingerprint (fallback se maneja en el backend)
      }
      
      setError(null);
    } catch (err) {
      setSurveyData(null);
      setError(err instanceof Error ? err.message : 'Ocurrió un error desconocido al cargar la encuesta.');
    } finally {
      setIsLoading(false);
    }
  }, [surveySlug]);

  useEffect(() => {
    fetchPublicSurvey();
  }, [fetchPublicSurvey]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4"><p className="text-xl text-gray-700">Cargando encuesta...</p></div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4"><p className="text-xl text-red-600">Error: {error}</p></div>;
  }

  if (!surveyData) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4"><p className="text-xl text-gray-700">No se pudo cargar la encuesta o no se encontró.</p></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 py-8 px-4 sm:px-6 lg:px-8">
      <header className="text-center mb-10">
        <h1 className="text-4xl font-extrabold text-gray-800 tracking-tight sm:text-5xl md:text-6xl">
          {surveyData.title}
        </h1>
        {surveyData.description && (
          <p className="mt-3 max-w-md mx-auto text-base text-gray-600 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            {surveyData.description}
          </p>
        )}
        <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
          Su opinión es muy importante para nosotros. Gracias por su tiempo y participación.
        </p>
      </header>

      <main className="max-w-3xl mx-auto bg-white shadow-xl rounded-lg p-6 sm:p-8 md:p-10">
        {surveyData.sections && surveyData.sections.length > 0 ? (
          <form className="space-y-8" onSubmit={handleSubmit}>
            {surveyData.sections.map((section) => (
              <section key={section.id} className="p-4 border border-gray-200 rounded-md">
                <h2 className="text-2xl font-semibold text-indigo-700 mb-3">{section.title}</h2>
                {section.description && <p className="text-sm text-gray-600 mb-4 italic">{section.description}</p>}
                {section.questions && section.questions.length > 0 ? (
                  <div className="space-y-6">
                    {section.questions.map((question, qIndex) => (
                      <div key={question.id} className="p-3 border-t border-gray-100">
                        <label htmlFor={question.id} className="font-medium text-gray-800 block">
                          {qIndex + 1}. {question.text}
                          {question.isRequired && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        {question.placeholder && <p className="text-xs text-gray-400 italic mb-2">Ayuda: {question.placeholder}</p>}
                        
                        <div className="mt-2">
                          {question.type === QuestionType.TEXT_SHORT && (
                            <input
                              type="text"
                              id={question.id}
                              name={question.id}
                              value={typeof answers[question.id] === 'object' ? '' : String(answers[question.id] || '')}
                              onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange(question.id, e.target.value, question.type)}
                              placeholder={question.placeholder || 'Escriba su respuesta...'}
                              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                              required={question.isRequired}
                            />
                          )}
                          {question.type === QuestionType.TEXT_LONG && (
                            <textarea
                              id={question.id}
                              name={question.id}
                              value={typeof answers[question.id] === 'object' ? '' : String(answers[question.id] || '')}
                              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleInputChange(question.id, e.target.value, question.type)}
                              placeholder={question.placeholder || 'Escriba su respuesta detallada...'}
                              rows={4}
                              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                              required={question.isRequired}
                            />
                          )}
                          {question.type === QuestionType.SINGLE_CHOICE && question.options && question.options.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {question.options.map(option => (
                                <label key={option.id} className="flex items-center space-x-2 p-2 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                                  <input
                                    type="radio"
                                    id={`${question.id}-${option.id}`}
                                    name={question.id}
                                    value={option.id}
                                    checked={answers[question.id] === option.id}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange(question.id, e.target.value, question.type)}
                                    className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                  />
                                  <span className="text-sm text-gray-700">{option.text}</span>
                                </label>
                              ))}
                            </div>
                          )}
                          {question.type === QuestionType.MULTIPLE_CHOICE && question.options && question.options.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {question.options.map(option => (
                                <label key={option.id} className="flex items-center space-x-2 p-2 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    id={`${question.id}-${option.id}`}
                                    name={`${question.id}-${option.id}`} // Nombre único para cada checkbox
                                    value={option.id}
                                    checked={!!(answers[question.id] && (answers[question.id] as { [optId: string]: boolean })[option.id])}
                                    onChange={() => handleInputChange(question.id, '', question.type, option.id)} // El valor 'string' no se usa para checkbox aquí
                                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded-md focus:ring-indigo-500"
                                    // required se maneja en la validación general para MULTIPLE_CHOICE
                                  />
                                  <span className="text-sm text-gray-700">{option.text}</span>
                                </label>
                              ))}
                            </div>
                          )}
                          {question.type === QuestionType.RATING_SCALE && question.options && question.options.length > 0 && (
                            <div className="mt-2">
                              <div className="flex items-center space-x-1 sm:space-x-2 border border-gray-300 rounded-md p-1 sm:p-2 justify-around flex-wrap" role="radiogroup" aria-labelledby={`${question.id}-label`}>
                                {question.options.sort((a, b) => a.order - b.order).map(option => (
                                  <label 
                                    key={option.id} 
                                    htmlFor={`${question.id}-${option.id}`}
                                    className={`flex flex-col items-center justify-center p-2 rounded-md cursor-pointer transition-all duration-150 ease-in-out w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-center my-1
                                                ${answers[question.id] === option.id 
                                                  ? 'bg-indigo-600 text-white shadow-md scale-105' 
                                                  : 'bg-gray-50 hover:bg-indigo-100 text-gray-700 border border-gray-200'}`}
                                  >
                                    <input
                                      type="radio"
                                      id={`${question.id}-${option.id}`}
                                      name={question.id} // Mismo name para agrupar radios
                                      value={option.id} // El valor es el ID de la opción
                                      checked={answers[question.id] === option.id}
                                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange(question.id, e.target.value, question.type)}
                                      className="sr-only" // Ocultar el radio button real, el label es el control visual
                                      // required={question.isRequired} // La validación de required se maneja en handleSubmit
                                    />
                                    <span className="text-sm sm:text-base font-medium">{option.text}</span>
                                  </label>
                                ))}
                              </div>
                              {question.isRequired && !answers[question.id] && typeof answers[question.id] !== 'string' && (
                                <p className="text-xs text-red-500 mt-1 pl-1">Debe seleccionar un valor en la escala.</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">Esta sección no tiene preguntas.</p>
                )}
              </section>
            ))}
            
            {submitError && (
              <p className="mt-4 text-center text-red-600 bg-red-100 p-3 rounded-md">Error: {submitError}</p>
            )}

            <div className="mt-10 pt-6 border-t border-gray-200 text-center">
              {!fingerprint && (
                <p className="text-sm text-gray-500 mb-4">
                  ⏳ Preparando sistema de respuesta única...
                </p>
              )}
              <button 
                type="submit"
                disabled={isSubmitting || !fingerprint} // Deshabilitar si está enviando o no hay fingerprint
                className="px-8 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Enviando...' : 'Enviar Respuestas'} {/* Texto dinámico */}
              </button>
              {fingerprint && (
                <p className="text-xs text-gray-400 mt-2">
                  ✓ Sistema de respuesta única activado
                </p>
              )}
            </div>
          </form>
        ) : (
          <p className="text-gray-700 text-lg text-center py-12">Esta encuesta aún no tiene contenido.</p>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-500">
            Todas las respuestas son anónimas y confidenciales. 
            <button 
              onClick={() => setIsPolicyModalOpen(true)} 
              className="text-indigo-600 hover:text-indigo-800 underline ml-1"
            >
              Leer nuestra política de anonimato.
            </button>
          </p>
        </div>
      </main>
      
      <PrivacyPolicyModal isOpen={isPolicyModalOpen} onClose={() => setIsPolicyModalOpen(false)} />

      <footer className="mt-12 text-center text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} Poder Judicial de la Nación. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
} 