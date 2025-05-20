'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, FormEvent, useCallback } from 'react';
import Link from 'next/link';
// Importar tipos de Prisma
import { 
  Section as PrismaSection, 
  Question as PrismaQuestion, 
  QuestionOption as PrismaQuestionOption, 
  QuestionType as PrismaQuestionType 
} from '@/generated/prisma';

// Definir tipos locales usando los tipos de Prisma importados
type QuestionOption = PrismaQuestionOption;

interface Question extends PrismaQuestion {
  options: QuestionOption[];
}

interface Section extends PrismaSection {
  questions: Question[];
}

interface Survey {
  id: string;
  title: string;
  description?: string | null;
  isActive: boolean;
  sections: Section[];
}

// Payload para crear pregunta, similar al del backend
interface QuestionCreateFormData {
  text: string;
  type: PrismaQuestionType;
  order?: number;
  isRequired: boolean;
  placeholder?: string;
  options: { text: string }[]; // Solo relevante para tipos con opciones
}

// Payload para actualizar pregunta
interface QuestionUpdateFormData {
  text?: string;
  type?: PrismaQuestionType;
  order?: number;
  isRequired?: boolean;
  placeholder?: string | null; 
  options?: { id?: string; text: string; order?: number; _delete?: boolean }[];
}

// Tipo para el estado de las opciones en edición dentro del modal
interface OptionForEdit {
  id?: string; // ID de la base de datos, si la opción ya existe
  tempId?: string; // ID temporal para opciones nuevas o para usar como key estable
  text: string;
  order?: number;
  _delete?: boolean;
  effectivelyRemoved?: boolean; // Para filtrar inmediatamente del UI las nuevas opciones borradas
}

// --- Componente EditSectionModal ---
interface EditSectionModalProps {
  section: Section | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedSectionData: { 
    id: string; 
    title?: string; 
    description?: string | null; 
    order?: number; 
  }) => Promise<void>;
}

const EditSectionModal: React.FC<EditSectionModalProps> = ({ section, isOpen, onClose, onSave }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [order, setOrder] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (section) {
      setTitle(section.title);
      setDescription(section.description || "");
      setOrder(section.order.toString());
    } else {
      setTitle("");
      setDescription("");
      setOrder("");
    }
    setError(null);
  }, [section, isOpen]);

  if (!isOpen || !section) return null;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    const orderValue = parseInt(order, 10);
    if (isNaN(orderValue) || orderValue < 0) {
        setError("El orden debe ser un número entero no negativo.");
        setIsSaving(false);
        return;
    }

    try {
      const dataToSave: { id: string; title?: string; description?: string | null; order?: number } = { id: section.id };
      if (title.trim() !== section.title) dataToSave.title = title.trim();
      if ((description.trim() === '' ? null : description.trim()) !== section.description) dataToSave.description = description.trim() === '' ? null : description.trim();
      if (orderValue !== section.order) dataToSave.order = orderValue;
      
      await onSave({ 
        id: section.id, 
        title: title.trim(), 
        description: description.trim() === '' ? null : description.trim(), 
        order: orderValue 
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar la sección.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-semibold mb-4">Editar Sección</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="editSectionTitle" className="block text-sm font-medium text-gray-700 mb-1">Título:</label>
            <input
              type="text"
              id="editSectionTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="editSectionDescription" className="block text-sm font-medium text-gray-700 mb-1">Descripción:</label>
            <textarea
              id="editSectionDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div className="mb-6">
            <label htmlFor="editSectionOrder" className="block text-sm font-medium text-gray-700 mb-1">Orden:</label>
            <input
              type="number"
              id="editSectionOrder"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              required
              min="0"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          {error && <p className="text-red-500 text-sm mb-4">Error: {error}</p>}
          <div className="flex justify-end space-x-3">
            <button type="button" onClick={onClose} disabled={isSaving} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={isSaving} className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50">
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
// --- Fin Componente EditSectionModal ---

// --- Componente AddQuestionModal ---
interface AddQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (sectionId: string, questionData: QuestionCreateFormData) => Promise<void>;
  sectionId: string | null;
  availableQuestionTypes: PrismaQuestionType[];
}

const AddQuestionModal: React.FC<AddQuestionModalProps> = ({ isOpen, onClose, onAdd, sectionId, availableQuestionTypes }) => {
  const [text, setText] = useState("");
  const [type, setType] = useState<PrismaQuestionType>(availableQuestionTypes[0] || PrismaQuestionType.TEXT_SHORT);
  const [isRequired, setIsRequired] = useState(true);
  const [orderStr, setOrderStr] = useState(""); // Orden como string para el input
  const [placeholder, setPlaceholder] = useState("");
  const [options, setOptions] = useState<{ text: string }[]>([{ text: "" }]);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Resetear formulario al abrir
      setText("");
      setType(availableQuestionTypes[0] || PrismaQuestionType.TEXT_SHORT);
      setIsRequired(true);
      setOrderStr("");
      setPlaceholder("");
      setOptions([{ text: "" }]);
      setError(null);
    } else {
        // Limpiar errores cuando se cierra explícitamente y no por guardado exitoso
        setError(null);
    }
  }, [isOpen, availableQuestionTypes]);

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], text: value };
    setOptions(newOptions);
  };

  const addOptionField = () => {
    setOptions([...options, { text: "" }]);
  };

  const removeOptionField = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions.length > 0 ? newOptions : [{ text: "" }]); // Asegurar al menos una opción si se borran todas
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!sectionId) {
      setError("ID de sección no especificado.");
      return;
    }
    setIsSaving(true);
    setError(null);

    const finalOrder = orderStr !== "" ? parseInt(orderStr, 10) : undefined;
    if (orderStr !== "" && (isNaN(finalOrder as number) || (finalOrder as number) < 0)) {
      setError("El orden debe ser un número positivo o vacío.");
      setIsSaving(false);
      return;
    }

    const questionData: QuestionCreateFormData = {
      text,
      type,
      isRequired,
      order: finalOrder,
      placeholder: placeholder.trim() === "" ? undefined : placeholder.trim(),
      options: (type === PrismaQuestionType.SINGLE_CHOICE || type === PrismaQuestionType.MULTIPLE_CHOICE || type === PrismaQuestionType.RATING_SCALE) ?
                options.filter(opt => opt.text.trim() !== "") : [],
    };

    if ((type === PrismaQuestionType.SINGLE_CHOICE || type === PrismaQuestionType.MULTIPLE_CHOICE || type === PrismaQuestionType.RATING_SCALE) && questionData.options.length === 0) {
        setError(`Las preguntas de tipo ${type === PrismaQuestionType.RATING_SCALE ? 'Escala de Calificación' : 'Opción'} requieren al menos una opción/punto de escala con texto.`);
        setIsSaving(false);
        return;
    }

    try {
      await onAdd(sectionId, questionData);
      onClose(); // Cerrar el modal si onAdd es exitoso
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al añadir la pregunta.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
        <h2 className="text-2xl font-semibold mb-4">Añadir Nueva Pregunta</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="qText" className="block text-sm font-medium text-gray-700">Texto de la pregunta:</label>
            <input type="text" id="qText" value={text} onChange={(e) => setText(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
          </div>
          <div>
            <label htmlFor="qType" className="block text-sm font-medium text-gray-700">Tipo de pregunta:</label>
            <select id="qType" value={type} onChange={(e) => setType(e.target.value as PrismaQuestionType)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
              {availableQuestionTypes.map(qType => (
                <option key={qType} value={qType}>{qType.replace("_", " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="qOrder" className="block text-sm font-medium text-gray-700">Orden (opcional):</label>
            <input type="number" id="qOrder" value={orderStr} onChange={(e) => setOrderStr(e.target.value)} min="0" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
          </div>
          <div>
            <label htmlFor="qPlaceholder" className="block text-sm font-medium text-gray-700">Placeholder (opcional):</label>
            <input type="text" id="qPlaceholder" value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
          </div>
          <div className="flex items-center">
            <input type="checkbox" id="qIsRequired" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded" />
            <label htmlFor="qIsRequired" className="ml-2 block text-sm text-gray-900">Es obligatoria</label>
          </div>

          {(type === PrismaQuestionType.SINGLE_CHOICE || type === PrismaQuestionType.MULTIPLE_CHOICE || type === PrismaQuestionType.RATING_SCALE) && (
            <div className="space-y-2 p-3 border rounded-md">
              <h4 className="text-sm font-medium text-gray-700">
                {type === PrismaQuestionType.RATING_SCALE 
                  ? "Puntos de la escala (ej: 1, 2, 5):" 
                  : "Opciones de respuesta:"}
              </h4>
              {options.map((opt, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input 
                    type={type === PrismaQuestionType.RATING_SCALE ? "number" : "text"}
                    value={opt.text} 
                    onChange={(e) => handleOptionChange(index, e.target.value)} 
                    placeholder={type === PrismaQuestionType.RATING_SCALE ? `Punto ${index + 1}` : `Opción ${index + 1}`}
                    className="flex-grow px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm"
                  />
                  <button type="button" onClick={() => removeOptionField(index)} className="text-red-500 hover:text-red-700 text-sm" disabled={options.length <= 1}>Eliminar</button>
                </div>
              ))}
              <button type="button" onClick={addOptionField} className="text-indigo-600 hover:text-indigo-800 text-sm">+ Añadir opción</button>
            </div>
          )}

          {error && <p className="text-red-500 text-sm">Error: {error}</p>}
          <div className="flex justify-end space-x-3 pt-3">
            <button type="button" onClick={onClose} disabled={isSaving} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancelar</button>
            <button type="submit" disabled={isSaving} className="px-4 py-2 text-white bg-teal-600 hover:bg-teal-700 rounded-md">
              {isSaving ? 'Añadiendo...' : 'Añadir Pregunta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
// --- Fin Componente AddQuestionModal ---

// --- Componente EditQuestionModal ---
interface EditQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sectionId: string, questionId: string, data: QuestionUpdateFormData) => Promise<void>;
  question: Question | null;
  sectionId: string | null; 
  availableQuestionTypes: PrismaQuestionType[];
}

const EditQuestionModal: React.FC<EditQuestionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  question,
  sectionId,
  availableQuestionTypes,
}) => {
  const [text, setText] = useState("");
  const [type, setType] = useState<PrismaQuestionType>(PrismaQuestionType.TEXT_SHORT);
  const [isRequired, setIsRequired] = useState(true);
  const [orderStr, setOrderStr] = useState("");
  const [placeholder, setPlaceholder] = useState<string | null | undefined>("");
  const [currentOptions, setCurrentOptions] = useState<OptionForEdit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (question) {
      setText(question.text);
      setType(question.type);
      setIsRequired(question.isRequired);
      setOrderStr(question.order?.toString() || "");
      setPlaceholder(question.placeholder);
      setCurrentOptions(
        question.options.map(opt => ({ 
          ...opt, 
          _delete: false, 
          tempId: opt.id // Usar el id real como tempId inicial para opciones existentes
        }))
      );
    } else {
      setText("");
      setType(PrismaQuestionType.TEXT_SHORT);
      setIsRequired(true);
      setOrderStr("");
      setPlaceholder("");
      setCurrentOptions([]);
      setError(null);
    }
    setIsSaving(false);
  }, [question, isOpen]);

  const handleOptionChange = (identifier: string, newText: string) => {
    setCurrentOptions(prevOptions =>
      prevOptions.map(opt =>
        (opt.id === identifier || opt.tempId === identifier) ? { ...opt, text: newText } : opt
      )
    );
  };

  const addOptionField = () => {
    const newTempId = `new_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setCurrentOptions(prevOptions => [
      ...prevOptions,
      { text: "", order: prevOptions.length, tempId: newTempId, _delete: false },
    ]);
  };

  const removeOptionField = (identifier: string) => {
    setCurrentOptions(prevOptions =>
      prevOptions.map(opt => {
        if (opt.id === identifier || opt.tempId === identifier) {
          // Si la opción tiene un ID real (existe en la BD), la marcamos para borrar.
          // Si es una opción nueva (solo tempId), la filtramos directamente.
          return opt.id ? { ...opt, _delete: true } : { ...opt, _delete: true, effectivelyRemoved: true };
        }
        return opt;
      }).filter(opt => !opt.effectivelyRemoved) // Remove new options marked for deletion immediately from UI state
    );
  };
  
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!question || !sectionId) {
      setError("Error: Falta información de la pregunta o sección.");
      return;
    }
    setIsSaving(true);
    setError(null);

    const finalOrder = orderStr.trim() !== "" ? parseInt(orderStr, 10) : undefined;
    if (orderStr.trim() !== "" && (isNaN(finalOrder as number) || (finalOrder as number) < 0)) {
      setError("El orden debe ser un número entero no negativo o dejarse vacío.");
      setIsSaving(false);
      return;
    }

    const dataToSave: QuestionUpdateFormData = {
      text: text.trim(),
      type,
      order: finalOrder,
      isRequired,
      placeholder: placeholder?.trim() === "" ? null : placeholder?.trim(),
    };

    if (type === PrismaQuestionType.SINGLE_CHOICE || type === PrismaQuestionType.MULTIPLE_CHOICE || type === PrismaQuestionType.RATING_SCALE) {
      const processedOptions = currentOptions
        .map((opt, index) => ({
          id: opt.id, // Mantener el ID si existe
          tempId: opt.tempId, // Útil para la key en el render
          text: opt.text.trim(),
          order: opt.order ?? index, // Usar orden existente o el índice actual
          _delete: !!opt._delete, 
        }));

      // Validar que las opciones con texto no estén vacías si no se van a borrar
      const activeOptions = processedOptions.filter(opt => !opt._delete);
      if (activeOptions.some(opt => opt.text.trim() === "")) {
        setError(`El texto de las ${type === PrismaQuestionType.RATING_SCALE ? 'puntos de la escala' : 'opciones'} no puede estar vacío.`);
        setIsSaving(false);
        return;
      }
      if (activeOptions.length === 0) {
        setError(`Las preguntas de tipo ${type === PrismaQuestionType.RATING_SCALE ? 'Escala de Calificación' : 'Opción Múltiple o Única'} deben tener al menos un ${type === PrismaQuestionType.RATING_SCALE ? 'punto de escala activo' : 'opción activa'}.`);
        setIsSaving(false);
        return;
      }
      dataToSave.options = processedOptions;
    } else {
      // Si se cambia a un tipo que no usa opciones, marcamos todas las existentes para eliminar
      if (question && question.options.length > 0) {
        dataToSave.options = question.options.map(opt => ({ id: opt.id, text: opt.text, _delete: true }));
      } else {
        dataToSave.options = []; 
      }
    }

    try {
      await onSave(sectionId, question.id, dataToSave);
      onClose(); // Llamar a la prop onClose del modal
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al guardar la pregunta';
      setError(errorMessage);
      // No relanzar el error aquí si queremos que el modal permanezca abierto con el error
      // Si se relanza, el error se manejará también en el padre, lo cual está bien si esa es la intención.
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !question) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-semibold mb-4">Editar Pregunta</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="editText" className="block text-sm font-medium text-gray-700">Texto de la pregunta:</label>
            <input type="text" id="editText" value={text} onChange={(e) => setText(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
          </div>
          <div>
            <label htmlFor="editType" className="block text-sm font-medium text-gray-700">Tipo de pregunta:</label>
            <select id="editType" value={type} onChange={(e) => setType(e.target.value as PrismaQuestionType)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
              {availableQuestionTypes.map(qType => (
                <option key={qType} value={qType}>{qType.replace("_", " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="editOrder" className="block text-sm font-medium text-gray-700">Orden (opcional):</label>
            <input type="number" id="editOrder" value={orderStr} onChange={(e) => setOrderStr(e.target.value)} min="0" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
          </div>
          <div>
            <label htmlFor="editPlaceholder" className="block text-sm font-medium text-gray-700">Placeholder (opcional):</label>
            <input type="text" id="editPlaceholder" value={placeholder || ""} onChange={(e) => setPlaceholder(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
          </div>
          <div className="flex items-center">
            <input type="checkbox" id="editIsRequired" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded" />
            <label htmlFor="editIsRequired" className="ml-2 block text-sm text-gray-900">Es obligatoria</label>
          </div>

          {(type === PrismaQuestionType.SINGLE_CHOICE || type === PrismaQuestionType.MULTIPLE_CHOICE || type === PrismaQuestionType.RATING_SCALE) && (
            <div className="space-y-2 p-3 border rounded-md">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                {type === PrismaQuestionType.RATING_SCALE 
                  ? "Puntos de la escala (ej: 1, 2, 5):" 
                  : "Opciones de respuesta:"}
              </h4>
              {currentOptions.filter(opt => !opt._delete).map((opt, index) => (
                // Usar opt.tempId (que es el id real para las existentes o el nuevo tempId para las nuevas)
                <div key={opt.tempId || opt.id || `fallback-${index}`} className="flex items-center space-x-2">
                  <input
                    type={type === PrismaQuestionType.RATING_SCALE ? "number" : "text"}
                    value={opt.text}
                    onChange={(e) => handleOptionChange(opt.tempId || opt.id!, e.target.value)}
                    placeholder={`${type === PrismaQuestionType.RATING_SCALE ? 'Punto' : 'Opción'} ${index + 1}`}
                    className="flex-grow px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm"
                  />
                  <button 
                    type="button" 
                    onClick={() => removeOptionField(opt.tempId || opt.id!)}
                    className="text-red-500 hover:text-red-700 text-sm p-1"
                    aria-label="Eliminar opción"
                  >
                    Eliminar
                  </button>
                </div>
              ))}
              <button type="button" onClick={addOptionField} className="mt-2 text-indigo-600 hover:text-indigo-800 text-sm font-medium">+ Añadir opción</button>
            </div>
          )}

          {error && <p className="text-red-500 text-sm mt-2">Error: {error}</p>}
          <div className="flex justify-end space-x-3 pt-3 border-t mt-4">
            <button type="button" onClick={onClose} disabled={isSaving} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={isSaving} className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50">
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
// --- Fin Componente EditQuestionModal ---

export default function ManageSurveyPage() {
  const params = useParams();
  const surveyId = params.surveyId as string;

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para el formulario de nueva sección
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionDescription, setNewSectionDescription] = useState("");
  const [newSectionOrder, setNewSectionOrder] = useState<string>("");
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [addSectionError, setAddSectionError] = useState<string | null>(null);

  // Estado para la eliminación de secciones
  const [isDeletingSection, setIsDeletingSection] = useState<string | null>(null);
  const [deleteSectionError, setDeleteSectionError] = useState<string | null>(null);

  // Estados para el modal de edición de sección
  const [isEditSectionModalOpen, setIsEditSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [editSectionError, setEditSectionError] = useState<string | null>(null);

  // Nuevos estados para el modal de Añadir Pregunta
  const [isAddQuestionModalOpen, setIsAddQuestionModalOpen] = useState(false);
  const [addingToSectionId, setAddingToSectionId] = useState<string | null>(null);
  const [addQuestionError, setAddQuestionError] = useState<string | null>(null);

  // Estados para eliminación de preguntas
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);
  const [deleteQuestionError, setDeleteQuestionError] = useState<string | null>(null);

  // Estados para edición de preguntas
  const [isEditQuestionModalOpen, setIsEditQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editingQuestionSectionId, setEditingQuestionSectionId] = useState<string | null>(null);
  const [editQuestionError, setEditQuestionError] = useState<string | null>(null);

  const availableQuestionTypes = Object.values(PrismaQuestionType);

  const fetchSurveyDetails = useCallback(async () => {
    try {
      const response = await fetch(`/api/surveys/${surveyId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error al cargar la encuesta: ${response.statusText}`);
      }
      const data = await response.json();
      console.log("Datos recibidos en fetchSurveyDetails:", JSON.stringify(data, null, 2));
      setSurvey(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error desconocido al cargar la encuesta');
    }
  }, [surveyId]);

  useEffect(() => {
    if (surveyId) {
      setLoading(true);
      fetchSurveyDetails().finally(() => setLoading(false));
    }
  }, [surveyId, fetchSurveyDetails]);

  const handleAddSection = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsAddingSection(true);
    setAddSectionError(null);
    setDeleteSectionError(null);
    setEditSectionError(null);

    const orderValue = newSectionOrder !== "" ? parseInt(newSectionOrder, 10) : undefined;

    if (newSectionOrder !== "" && (isNaN(orderValue as number) || (orderValue as number) < 0)) {
        setAddSectionError("El orden debe ser un número entero no negativo.");
        setIsAddingSection(false);
        return;
    }

    try {
      const response = await fetch(`/api/surveys/${surveyId}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newSectionTitle,
          description: newSectionDescription,
          order: orderValue,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al añadir la sección');
      }

      setNewSectionTitle("");
      setNewSectionDescription("");
      setNewSectionOrder("");
      await fetchSurveyDetails(); 
    } catch (err) {
      setAddSectionError(err instanceof Error ? err.message : 'Ocurrió un error desconocido al añadir la sección');
    } finally {
      setIsAddingSection(false);
    }
  };

  const handleDeleteSection = async (sectionIdToDelete: string) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar esta sección? Sus preguntas y opciones también serán eliminadas.")) {
      setIsDeletingSection(sectionIdToDelete);
      setDeleteSectionError(null);
      setAddSectionError(null);
      setEditSectionError(null);

      try {
        const response = await fetch(`/api/surveys/${surveyId}/sections/${sectionIdToDelete}`, {
          method: 'DELETE',
        });

        if (!response.ok && response.status !== 204) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Error al eliminar la sección');
        }
        await fetchSurveyDetails();
      } catch (err) {
        setDeleteSectionError(err instanceof Error ? err.message : 'Ocurrió un error desconocido al eliminar la sección');
      } finally {
        setIsDeletingSection(null);
      }
    }
  };

  const handleOpenEditSectionModal = (section: Section) => {
    setEditingSection(section);
    setEditSectionError(null); 
    setIsEditSectionModalOpen(true);
  };

  const handleCloseEditSectionModal = () => {
    setIsEditSectionModalOpen(false);
    setEditingSection(null);
  };

  const handleUpdateSection = async (updatedSectionData: { id: string; title?: string; description?: string | null; order?: number; }) => {
    setEditSectionError(null); 
    try {
        const response = await fetch(`/api/surveys/${surveyId}/sections/${updatedSectionData.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedSectionData),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Error al actualizar la sección');
        }
        await fetchSurveyDetails(); 
        handleCloseEditSectionModal();
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido al actualizar la sección';
        setEditSectionError(errorMessage);
    }
  };

  const handleOpenAddQuestionModal = (sectionId: string) => {
    setAddingToSectionId(sectionId);
    setAddQuestionError(null); // Limpiar errores previos
    setIsAddQuestionModalOpen(true);
  };

  const handleCloseAddQuestionModal = () => {
    setIsAddQuestionModalOpen(false);
    setAddingToSectionId(null);
    // No limpiar addQuestionError aquí, podría ser útil verlo si el modal se cierra por error
  };

  const handleAddQuestion = async (sectionId: string, questionData: QuestionCreateFormData) => {
    setAddQuestionError(null);
    // El estado de guardado lo maneja el modal, pero podríamos tener uno general aquí si fuera necesario
    try {
      const response = await fetch(`/api/surveys/${surveyId}/sections/${sectionId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(questionData),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al añadir la pregunta');
      }
      await fetchSurveyDetails(); // Refrescar datos
      // No es necesario llamar a handleCloseAddQuestionModal aquí, el modal lo hace si tiene éxito
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido';
      setAddQuestionError(errorMessage);
      throw err; // Relanzar para que el modal pueda capturarlo y mostrarlo también si es necesario
    }
  };

  const handleDeleteQuestion = async (sectionId: string, questionId: string) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar esta pregunta? Sus opciones y respuestas asociadas (si las hubiera) también podrían ser afectadas o eliminadas según la configuración de la base de datos.")) {
      setDeletingQuestionId(questionId);
      setDeleteQuestionError(null);
      // Limpiar otros errores para evitar confusión
      setAddSectionError(null);
      setDeleteSectionError(null);
      setEditSectionError(null);
      setAddQuestionError(null);

      try {
        const response = await fetch(`/api/surveys/${surveyId}/sections/${sectionId}/questions/${questionId}`, {
          method: 'DELETE',
        });

        if (!response.ok && response.status !== 204) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Error al eliminar la pregunta');
        }
        await fetchSurveyDetails(); // Refrescar datos
      } catch (err) {
        setDeleteQuestionError(err instanceof Error ? err.message : 'Ocurrió un error desconocido al eliminar la pregunta');
      } finally {
        setDeletingQuestionId(null);
      }
    }
  };

  // Funciones para el modal de Edición de Pregunta
  const handleOpenEditQuestionModal = (question: Question, sectionId: string) => {
    setEditingQuestion(question);
    setEditingQuestionSectionId(sectionId);
    setEditQuestionError(null); // Limpiar errores previos
    setIsEditQuestionModalOpen(true);
  };

  const handleCloseEditQuestionModal = () => {
    setIsEditQuestionModalOpen(false);
    setEditingQuestion(null);
    setEditingQuestionSectionId(null);
    // No limpiar editQuestionError aquí, se limpiará al abrir o en un guardado exitoso
  };

  const handleUpdateQuestion = async (sectionId: string, questionId: string, data: QuestionUpdateFormData) => {
    setEditQuestionError(null);
    try {
      const response = await fetch(`/api/surveys/${surveyId}/sections/${sectionId}/questions/${questionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error al actualizar la pregunta: ${response.status} ${response.statusText}`);
      }
      await fetchSurveyDetails();
      handleCloseEditQuestionModal();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido al actualizar la pregunta';
      setEditQuestionError(errorMessage);
      throw err;
    }
  };

  if (loading) return <div className="container mx-auto p-4">Cargando detalles de la encuesta...</div>;
  if (error) return <div className="container mx-auto p-4 text-red-500">Error al cargar: {error}</div>;
  if (!survey) return <div className="container mx-auto p-4">Encuesta no encontrada.</div>;

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Gestionar Encuesta</h1>
          <p className="text-lg text-gray-700">{survey.title}</p>
        </div>
        <Link href="/admin/dashboard" className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded transition duration-150 ease-in-out">
          Volver al Dashboard
        </Link>
      </div>
      
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-6">
        <h2 className="text-xl font-semibold mb-3">Detalles de la Encuesta</h2>
        <p className="mb-1"><span className="font-semibold">ID:</span> {survey.id}</p>
        <p className="mb-1"><span className="font-semibold">Descripción:</span> {survey.description || 'N/A'}</p>
        <p className="mb-3"><span className="font-semibold">Estado:</span> {survey.isActive ? 'Activa' : 'Inactiva'}</p>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Añadir Nueva Sección</h2>
        <form onSubmit={handleAddSection} className="bg-white shadow-md rounded px-8 pt-6 pb-8">
          <div className="mb-4">
            <label htmlFor="newSectionTitle" className="block text-sm font-medium text-gray-700 mb-1">Título de la Sección:</label>
            <input
              type="text"
              id="newSectionTitle"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="newSectionDescription" className="block text-sm font-medium text-gray-700 mb-1">Descripción (Opcional):</label>
            <textarea
              id="newSectionDescription"
              value={newSectionDescription}
              onChange={(e) => setNewSectionDescription(e.target.value)}
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div className="mb-6">
            <label htmlFor="newSectionOrder" className="block text-sm font-medium text-gray-700 mb-1">Orden (Opcional, dejar vacío para añadir al final):</label>
            <input
              type="number"
              id="newSectionOrder"
              value={newSectionOrder}
              onChange={(e) => setNewSectionOrder(e.target.value)}
              min="0"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          {addSectionError && <p className="text-red-500 text-sm mb-4">Error: {addSectionError}</p>}
          <button
            type="submit"
            disabled={isAddingSection}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out disabled:opacity-50"
          >
            {isAddingSection ? 'Añadiendo...' : 'Añadir Sección'}
          </button>
        </form>
      </div>

      <h2 className="text-xl font-semibold mb-3">Secciones Existentes</h2>
      {deleteSectionError && <p className="text-red-500 text-sm mb-3">Error al eliminar sección: {deleteSectionError}</p>}
      {addQuestionError && <p className="text-red-500 text-sm mb-3">Error al añadir pregunta: {addQuestionError}</p>}
      {editSectionError && <p className="text-red-500 text-sm mb-3">Error al actualizar sección: {editSectionError}</p>}
      {deleteQuestionError && <p className="text-red-500 text-sm mb-3">Error al eliminar pregunta: {deleteQuestionError}</p>}
      {editQuestionError && <p className="text-red-500 text-sm mb-3">Error al editar pregunta: {editQuestionError}</p>}
      {survey.sections && survey.sections.length > 0 ? (
        <ul className="space-y-4">
          {survey.sections.sort((a, b) => a.order - b.order).map(section => (
            <li key={section.id} className="p-4 border border-gray-200 rounded-md bg-white shadow">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-indigo-700">{section.title}</h3>
                  <p className="text-sm text-gray-500 mb-1">Orden: {section.order}</p>
                  <p className="text-gray-600 text-sm">{section.description || 'Sin descripción'}</p>
                </div>
                <div className="space-x-2 flex-shrink-0 mt-1">
                  <button 
                    onClick={() => handleOpenEditSectionModal(section)}
                    className="px-3 py-1 text-xs text-white bg-blue-500 hover:bg-blue-600 rounded shadow disabled:opacity-50"
                    disabled={isDeletingSection === section.id || isAddingSection } 
                  >
                    Editar Sección
                  </button>
                  <button 
                    onClick={() => handleDeleteSection(section.id)}
                    className="px-3 py-1 text-xs text-white bg-red-500 hover:bg-red-600 rounded shadow disabled:opacity-50"
                    disabled={isDeletingSection === section.id || isAddingSection}
                  >
                    {isDeletingSection === section.id ? 'Eliminando...' : 'Eliminar Sección'}
                  </button>
                </div>
              </div>
              
              <div className="ml-4 pl-4 border-l border-gray-200">
                <h4 className="text-md font-semibold text-gray-800 mb-2">Preguntas:</h4>
                {section.questions && section.questions.length > 0 ? (
                  <ul className="space-y-2">
                    {section.questions.sort((a,b) => a.order - b.order).map(question => {
                      // Console log para depurar renderizado de pregunta y opciones
                      console.log("Renderizando pregunta ID:", question.id, "Tipo:", question.type, "Tiene opciones cargadas:", !!(question.options && question.options.length > 0), "Nro Opciones:", question.options ? question.options.length : 0 , "Opciones:", JSON.stringify(question.options));
                      return (
                        <li key={question.id} className="p-3 border border-gray-100 rounded bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-gray-700">{question.order}. {question.text}</p>
                              <p className="text-xs text-gray-500">
                                Tipo: {question.type} {question.isRequired ? '(Obligatoria)' : '(Opcional)'}
                              </p>
                              {question.placeholder && <p className="text-xs text-gray-400 italic">Placeholder: {question.placeholder}</p>}
                              {(question.type === PrismaQuestionType.SINGLE_CHOICE || question.type === PrismaQuestionType.MULTIPLE_CHOICE || question.type === PrismaQuestionType.RATING_SCALE) && question.options && question.options.length > 0 && (
                                <div className="mt-1">
                                  <p className="text-xs text-gray-600 font-semibold">
                                    {question.type === PrismaQuestionType.RATING_SCALE ? "Puntos de la escala:" : "Opciones:"}
                                  </p>
                                  <ul className="list-disc list-inside ml-2 space-y-0.5">
                                    {question.options.sort((a,b) => a.order - b.order).map(option => (
                                      <li key={option.id} className="text-xs text-gray-500">{option.text}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                            <div className="space-x-1 flex-shrink-0 mt-1">
                              <button 
                                onClick={() => handleOpenEditQuestionModal(question, section.id)}
                                className="px-2 py-0.5 text-xs text-white bg-yellow-500 hover:bg-yellow-600 rounded shadow disabled:opacity-50"
                                disabled={!!deletingQuestionId || isAddingSection || !!isDeletingSection}
                              >
                                Editar
                              </button>
                              <button 
                                onClick={() => handleDeleteQuestion(section.id, question.id)}
                                className="px-2 py-0.5 text-xs text-white bg-pink-500 hover:bg-pink-600 rounded shadow disabled:opacity-50"
                                disabled={deletingQuestionId === question.id || isAddingSection || !!isDeletingSection}
                              >
                                {deletingQuestionId === question.id ? 'Elim...' : 'Eliminar'}
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 italic">Esta sección aún no tiene preguntas.</p>
                )}
                <button 
                  onClick={() => handleOpenAddQuestionModal(section.id)} 
                  className="mt-3 px-3 py-1.5 text-xs text-white bg-teal-500 hover:bg-teal-600 rounded shadow">
                  Añadir Pregunta a esta Sección
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="bg-white shadow-md rounded px-8 pt-6 pb-8">
            <p className="text-gray-500">Esta encuesta aún no tiene secciones.</p>
        </div>
      )}

      <EditSectionModal 
        section={editingSection}
        isOpen={isEditSectionModalOpen}
        onClose={handleCloseEditSectionModal}
        onSave={handleUpdateSection}
      />
      
      {/* Modal para Añadir Pregunta */}
      <AddQuestionModal 
        isOpen={isAddQuestionModalOpen}
        onClose={handleCloseAddQuestionModal}
        onAdd={handleAddQuestion}
        sectionId={addingToSectionId}
        availableQuestionTypes={availableQuestionTypes}
      />

      {/* Modal para Editar Pregunta */}
      <EditQuestionModal
        isOpen={isEditQuestionModalOpen}
        onClose={handleCloseEditQuestionModal}
        onSave={handleUpdateQuestion}        
        question={editingQuestion}
        sectionId={editingQuestionSectionId}
        availableQuestionTypes={availableQuestionTypes}
      />
    </div>
  );
} 