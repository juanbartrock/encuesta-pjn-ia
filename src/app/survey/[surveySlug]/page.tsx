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
  
  // Estados para la paginación por secciones
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [completedSections, setCompletedSections] = useState<Set<number>>(new Set());
  
  // Estado para controlar si estamos en la página de introducción
  const [showIntroduction, setShowIntroduction] = useState(true);

  // Función para comenzar la encuesta
  const startSurvey = () => {
    setShowIntroduction(false);
    // Scroll suave hacia arriba
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

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

  // Función para validar si una sección está completa
  const isSectionComplete = (sectionIndex: number): boolean => {
    if (!surveyData) return false;
    const section = surveyData.sections[sectionIndex];
    if (!section) return false;

    for (const question of section.questions) {
      if (question.isRequired) {
        const answer = answers[question.id];
        if (!answer) return false;
        if (typeof answer === 'string' && answer.trim() === '') return false;
        if (question.type === QuestionType.MULTIPLE_CHOICE) {
          const selectedOptions = answer as { [optionId: string]: boolean };
          if (!Object.values(selectedOptions).some(isSelected => isSelected)) return false;
        }
      }
    }
    return true;
  };

  // Función para navegar entre secciones
  const navigateToSection = (direction: 'next' | 'prev') => {
    if (!surveyData) return;

    if (direction === 'next') {
      if (isSectionComplete(currentSectionIndex)) {
        setCompletedSections(prev => new Set([...prev, currentSectionIndex]));
      }
      
      if (currentSectionIndex < surveyData.sections.length - 1) {
        setCurrentSectionIndex(prev => prev + 1);
        setSubmitError(null); // Limpiar errores al navegar
        // Scroll suave hacia arriba
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
      }
    } else {
      if (currentSectionIndex > 0) {
        setCurrentSectionIndex(prev => prev - 1);
        setSubmitError(null); // Limpiar errores al navegar
        // Scroll suave hacia arriba
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
      }
    }
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
          if (!answer) {
            setSubmitError(`La pregunta "${question.text}" es obligatoria.`);
            setIsSubmitting(false);
            return;
          }
          if (typeof answer === 'string' && answer.trim() === '') {
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
      } else {
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-6"></div>
          <p className="text-2xl text-gray-700 font-medium">Cargando encuesta...</p>
          <p className="text-gray-500 mt-2">Por favor, espere un momento</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 p-4">
        <div className="text-center bg-white p-8 rounded-xl shadow-xl max-w-md">
          <div className="text-red-500 text-6xl mb-6">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Error al cargar la encuesta</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!surveyData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="text-center bg-white p-8 rounded-xl shadow-xl max-w-md">
          <div className="text-gray-400 text-6xl mb-6">📋</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Encuesta no encontrada</h2>
          <p className="text-gray-600">No se pudo cargar la encuesta solicitada.</p>
        </div>
      </div>
    );
  }

  // Página de introducción
  if (showIntroduction) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-4xl w-full">
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
              {/* Header de bienvenida */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-12 text-white text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-10 rounded-full -translate-y-20 translate-x-20"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white opacity-10 rounded-full translate-y-16 -translate-x-16"></div>
                <div className="relative">
                  <div className="text-blue-100 text-lg font-medium mb-4">
                    Poder Judicial de la Nación
                  </div>
                  <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
                    {surveyData.title}
                  </h1>
                  {surveyData.description && (
                    <p className="text-blue-100 text-xl leading-relaxed max-w-3xl mx-auto">
                      {surveyData.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Contenido de la introducción */}
              <div className="p-8 md:p-12">
                <div className="grid md:grid-cols-2 gap-8 mb-12">
                  <div className="bg-blue-50 rounded-xl p-6">
                    <div className="flex items-center mb-4">
                      <svg className="w-8 h-8 text-blue-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      <h3 className="text-xl font-bold text-gray-900">Totalmente Anónima</h3>
                    </div>
                    <p className="text-gray-700">
                      Sus respuestas son completamente anónimas y confidenciales. No se almacena información personal identificable.
                    </p>
                  </div>

                  <div className="bg-green-50 rounded-xl p-6">
                    <div className="flex items-center mb-4">
                      <svg className="w-8 h-8 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h3 className="text-xl font-bold text-gray-900">Tiempo Estimado</h3>
                    </div>
                    <p className="text-gray-700">
                      La encuesta tiene <strong>{surveyData.sections.length} sección{surveyData.sections.length !== 1 ? 'es' : ''}</strong> y tomará aproximadamente <strong>5-10 minutos</strong> completar.
                    </p>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-8">
                  <div className="flex items-start">
                    <svg className="w-6 h-6 text-yellow-600 mr-3 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h4 className="font-bold text-yellow-800 mb-2">Información importante:</h4>
                      <ul className="text-yellow-700 space-y-1 text-sm">
                        <li>• Puede navegar hacia atrás y adelante entre secciones</li>
                        <li>• Las preguntas marcadas con (*) son obligatorias</li>
                        <li>• Su progreso se guardará mientras completa la encuesta</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <div className="mb-6">
                    {!fingerprint && (
                      <div className="inline-flex items-center text-amber-600 bg-amber-50 px-4 py-2 rounded-full border border-amber-200 mb-4">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-600 mr-3"></div>
                        <span className="font-medium">Preparando sistema...</span>
                      </div>
                    )}
                    {fingerprint && (
                      <div className="inline-flex items-center text-green-600 bg-green-50 px-4 py-2 rounded-full border border-green-200 mb-4">
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Sistema listo</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={startSurvey}
                    disabled={!fingerprint}
                    className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                  >
                    Comenzar Encuesta
                    <svg className="w-5 h-5 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Footer con política de privacidad */}
            <div className="mt-8 text-center">
              <p className="text-gray-600 text-sm">
                Al continuar, acepta que sus respuestas sean utilizadas para los fines de esta encuesta. 
                <button 
                  onClick={() => setIsPolicyModalOpen(true)} 
                  className="text-blue-600 hover:text-blue-800 underline ml-1 font-medium"
                >
                  Ver política de anonimato
                </button>
              </p>
            </div>
          </div>
        </div>
        
        <PrivacyPolicyModal isOpen={isPolicyModalOpen} onClose={() => setIsPolicyModalOpen(false)} />
      </div>
    );
  }

  const currentSection = surveyData.sections[currentSectionIndex];
  const isLastSection = currentSectionIndex === surveyData.sections.length - 1;
  const isFirstSection = currentSectionIndex === 0;
  const progressPercentage = ((currentSectionIndex + 1) / surveyData.sections.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header compacto */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-gray-900 truncate">
                {surveyData.title}
              </h1>
            </div>
            
            <div className="flex items-center space-x-6">
              {/* Indicadores compactos */}
              <div className="flex space-x-1">
                {surveyData.sections.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-all duration-200 ${
                      index < currentSectionIndex 
                        ? 'bg-green-500' 
                        : index === currentSectionIndex 
                          ? 'bg-blue-500' 
                          : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
              
              {/* Progreso compacto */}
              <div className="text-sm text-gray-600 font-medium">
                {currentSectionIndex + 1}/{surveyData.sections.length}
              </div>
            </div>
          </div>
          
          {/* Barra de progreso minimalista */}
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-1">
              <div 
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-1 rounded-full transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Header de la sección actual - compacto */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h2 className="text-xl font-bold">
                  {currentSection.title}
                </h2>
                {currentSection.description && (
                  <p className="text-blue-100 text-sm mt-1">
                    {currentSection.description}
                  </p>
                )}
              </div>
              
              <div className="flex items-center space-x-3 text-sm">
                {completedSections.has(currentSectionIndex) && (
                  <span className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center">
                    ✓
                  </span>
                )}
                <span className="text-blue-100">
                  {currentSection.questions.length} pregunta{currentSection.questions.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Formulario de la sección actual */}
          <form onSubmit={handleSubmit} className="p-6">
            {currentSection.questions && currentSection.questions.length > 0 ? (
              <div className="space-y-6">
                {currentSection.questions.map((question, qIndex) => (
                  <div key={question.id} className="bg-gray-50 rounded-xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-md">
                        {qIndex + 1}
                      </div>
                      <div className="flex-1">
                        <label className="block text-xl font-semibold text-gray-900 mb-4 leading-relaxed">
                          {question.text}
                          {question.isRequired && (
                            <span className="text-red-500 ml-2 text-2xl">*</span>
                          )}
                        </label>
                        
                        {question.placeholder && (
                          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6 rounded-r-lg">
                            <p className="text-blue-800 text-sm font-medium flex items-center">
                              💡 <span className="ml-2">{question.placeholder}</span>
                            </p>
                          </div>
                        )}
                        
                        <div className="space-y-4">
                          {question.type === QuestionType.TEXT_SHORT && (
                            <input
                              type="text"
                              id={question.id}
                              name={question.id}
                              value={typeof answers[question.id] === 'object' ? '' : String(answers[question.id] || '')}
                              onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange(question.id, e.target.value, question.type)}
                              placeholder={question.placeholder || 'Escriba su respuesta...'}
                              className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-lg"
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
                              rows={6}
                              className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-vertical text-lg"
                              required={question.isRequired}
                            />
                          )}
                          
                          {question.type === QuestionType.SINGLE_CHOICE && question.options && question.options.length > 0 && (
                            <div className="space-y-3">
                              {question.options.map(option => (
                                <label key={option.id} className={`flex items-center p-5 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                                  answers[question.id] === option.id 
                                    ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200' 
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm'
                                }`}>
                                  <input
                                    type="radio"
                                    id={`${question.id}-${option.id}`}
                                    name={question.id}
                                    value={option.id}
                                    checked={answers[question.id] === option.id}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange(question.id, e.target.value, question.type)}
                                    className="h-5 w-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                                  />
                                  <span className="ml-4 text-gray-700 font-medium text-lg">{option.text}</span>
                                </label>
                              ))}
                            </div>
                          )}
                          
                          {question.type === QuestionType.MULTIPLE_CHOICE && question.options && question.options.length > 0 && (
                            <div className="space-y-3">
                              {question.options.map(option => (
                                <label key={option.id} className={`flex items-center p-5 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                                  !!(answers[question.id] && (answers[question.id] as { [optId: string]: boolean })[option.id])
                                    ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200' 
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm'
                                }`}>
                                  <input
                                    type="checkbox"
                                    id={`${question.id}-${option.id}`}
                                    name={`${question.id}-${option.id}`}
                                    value={option.id}
                                    checked={!!(answers[question.id] && (answers[question.id] as { [optId: string]: boolean })[option.id])}
                                    onChange={() => handleInputChange(question.id, '', question.type, option.id)}
                                    className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                  />
                                  <span className="ml-4 text-gray-700 font-medium text-lg">{option.text}</span>
                                </label>
                              ))}
                            </div>
                          )}
                          
                          {question.type === QuestionType.RATING_SCALE && question.options && question.options.length > 0 && (
                            <div className="bg-white rounded-xl p-6 border-2 border-gray-200 shadow-sm">
                              <div className="flex items-center justify-between space-x-2" role="radiogroup">
                                {question.options.sort((a, b) => a.order - b.order).map(option => (
                                  <label 
                                    key={option.id} 
                                    htmlFor={`${question.id}-${option.id}`}
                                    className={`flex flex-col items-center justify-center p-4 rounded-xl cursor-pointer transition-all duration-200 min-w-[80px] ${
                                      answers[question.id] === option.id 
                                        ? 'bg-blue-600 text-white shadow-xl scale-110 transform ring-4 ring-blue-200' 
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-2 border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md'
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      id={`${question.id}-${option.id}`}
                                      name={question.id}
                                      value={option.id}
                                      checked={answers[question.id] === option.id}
                                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange(question.id, e.target.value, question.type)}
                                      className="sr-only"
                                    />
                                    <span className="text-lg font-bold">{option.text}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="text-gray-400 text-8xl mb-6">📝</div>
                <h3 className="text-2xl font-bold text-gray-700 mb-2">Esta sección no tiene preguntas</h3>
                <p className="text-gray-500">Puedes continuar a la siguiente sección.</p>
              </div>
            )}

            {/* Errores de envío */}
            {submitError && (
              <div className="mt-8 p-6 bg-red-50 border-2 border-red-200 rounded-xl">
                <div className="flex items-start">
                  <div className="text-red-500 text-2xl mr-4">⚠️</div>
                  <div>
                    <h3 className="text-red-800 font-bold text-lg">Error al enviar la encuesta</h3>
                    <p className="text-red-700 mt-2 text-base">{submitError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Navegación entre secciones */}
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => navigateToSection('prev')}
                disabled={isFirstSection}
                className="flex items-center px-8 py-4 text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Anterior
              </button>

              <div className="flex items-center space-x-6">
                {!fingerprint && (
                  <div className="flex items-center text-amber-600 bg-amber-50 px-4 py-2 rounded-full border border-amber-200">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-600 mr-3"></div>
                    <span className="font-medium">Preparando sistema...</span>
                  </div>
                )}
                {fingerprint && (
                  <div className="flex items-center text-green-600 bg-green-50 px-4 py-2 rounded-full border border-green-200">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">Sistema listo</span>
                  </div>
                )}
              </div>

              {isLastSection ? (
                <button
                  type="submit"
                  disabled={isSubmitting || !fingerprint}
                  className="flex items-center px-10 py-4 bg-gradient-to-r from-green-600 to-green-700 text-white font-bold rounded-xl shadow-lg hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-4 focus:ring-green-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                      Enviando...
                    </>
                  ) : (
                    <>
                      Enviar Respuestas
                      <svg className="w-5 h-5 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigateToSection('next')}
                  className="flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all duration-200 text-lg"
                >
                  Siguiente
                  <svg className="w-5 h-5 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Footer con política de privacidad */}
        <div className="mt-12 text-center">
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <p className="text-gray-600 text-lg flex items-center justify-center">
              <svg className="w-5 h-5 mr-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              Todas las respuestas son anónimas y confidenciales. 
              <button 
                onClick={() => setIsPolicyModalOpen(true)} 
                className="text-blue-600 hover:text-blue-800 underline ml-2 font-semibold"
              >
                Ver política de anonimato
              </button>
            </p>
          </div>
        </div>
      </main>
      
      <PrivacyPolicyModal isOpen={isPolicyModalOpen} onClose={() => setIsPolicyModalOpen(false)} />

      {/* Footer */}
      <footer className="mt-20 py-8 text-center text-gray-500 bg-white/70 backdrop-blur-sm">
        <p className="text-lg font-medium">&copy; {new Date().getFullYear()} Poder Judicial de la Nación. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
} 