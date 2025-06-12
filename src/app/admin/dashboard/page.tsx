"use client"; // Necesario para usar hooks como useSession y funciones como signOut

import { signOut, useSession } from "next-auth/react";
import { useEffect, useState, FormEvent } from "react";
import Link from 'next/link'; // Importar Link

// Definimos un tipo para la encuesta que esperamos de la API
interface Survey {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string; // Suponiendo que la API devuelve fechas como strings ISO
}

// Componente Modal para Editar Encuesta (se puede mover a su propio archivo más adelante)
interface EditSurveyModalProps {
  survey: Survey | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedSurvey: Partial<Omit<Survey, 'createdAt'>> & { id: string }) => Promise<void>; 
}

const EditSurveyModal: React.FC<EditSurveyModalProps> = ({ survey, isOpen, onClose, onSave }) => {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (survey) {
      setTitle(survey.title);
      setSlug(survey.slug);
      setDescription(survey.description || "");
      setIsActive(survey.isActive);
    } else {
      setTitle("");
      setSlug("");
      setDescription("");
      setIsActive(false);
    }
    setError(null);
  }, [survey, isOpen]);

  if (!isOpen || !survey) return null;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        throw new Error("El slug solo puede contener letras minúsculas, números y guiones, y no puede empezar o terminar con guion.");
      }
      await onSave({ id: survey.id, title, slug, description, isActive });
      onClose();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || "Error al guardar la encuesta.");
      } else {
        setError("Error desconocido al guardar la encuesta.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 transition-opacity duration-300 ease-in-out">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md transform transition-all duration-300 ease-in-out scale-100">
        <h2 className="text-2xl font-semibold mb-4">Editar Encuesta</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="editSurveyTitle" className="block text-sm font-medium text-gray-700 mb-1">Título:</label>
            <input
              type="text"
              id="editSurveyTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="editSurveySlug" className="block text-sm font-medium text-gray-700 mb-1">Slug (URL amigable):</label>
            <input
              type="text"
              id="editSurveySlug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              required
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              title="Solo letras minúsculas, números y guiones. No empezar/terminar con guion."
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="editSurveyDescription" className="block text-sm font-medium text-gray-700 mb-1">Descripción:</label>
            <textarea
              id="editSurveyDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div className="mb-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <span className="ml-2 text-sm text-gray-700">Activa</span>
            </label>
          </div>
          {error && <p className="text-red-500 text-sm mb-4">Error: {error}</p>}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out disabled:opacity-50"
            >
              {isSaving ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AdminDashboardPage = () => {
  const { data: session, status } = useSession();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [isLoadingSurveys, setIsLoadingSurveys] = useState(true);
  const [errorSurveys, setErrorSurveys] = useState<string | null>(null);

  // Estado para el formulario de nueva encuesta
  const [newSurveyTitle, setNewSurveyTitle] = useState("");
  const [newSurveySlug, setNewSurveySlug] = useState("");
  const [newSurveyDescription, setNewSurveyDescription] = useState("");
  const [isCreatingSurvey, setIsCreatingSurvey] = useState(false);
  const [createSurveyError, setCreateSurveyError] = useState<string | null>(null);

  // Estado para el modal de edición
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);

  const fetchSurveys = async () => {
    setIsLoadingSurveys(true);
    setErrorSurveys(null);
    try {
      const response = await fetch("/api/surveys");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al cargar las encuestas");
      }
      const data: Survey[] = await response.json();
      setSurveys(data);
    } catch (err) {
      if (err instanceof Error) {
        setErrorSurveys(err.message);
      }
      else {
        setErrorSurveys("Ocurrió un error desconocido al cargar encuestas.");
      }
    } finally {
      setIsLoadingSurveys(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchSurveys();
    }
  }, [status]);

  const handleCreateSurvey = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreatingSurvey(true);
    setCreateSurveyError(null);

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(newSurveySlug)) {
      setCreateSurveyError("El slug solo puede contener letras minúsculas, números y guiones, y no puede empezar o terminar con guion.");
      setIsCreatingSurvey(false);
      return;
    }

    try {
      const response = await fetch("/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          title: newSurveyTitle, 
          slug: newSurveySlug,
          description: newSurveyDescription 
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al crear la encuesta");
      }
      setNewSurveyTitle("");
      setNewSurveySlug("");
      setNewSurveyDescription("");
      fetchSurveys(); 
    } catch (err) {
      if (err instanceof Error) {
        setCreateSurveyError(err.message);
      }
      else {
        setCreateSurveyError("Ocurrió un error desconocido al crear la encuesta.");
      }
    } finally {
      setIsCreatingSurvey(false);
    }
  };

  // Lógica para Editar Encuesta
  const handleOpenEditModal = (survey: Survey) => {
    setEditingSurvey(survey);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingSurvey(null); // Limpiar la encuesta en edición
  };

  const handleSaveSurvey = async (updatedSurvey: Partial<Survey> & { id: string }) => {
    // No es necesario setIsSaving o setError aquí, el modal lo maneja
    const response = await fetch(`/api/surveys/${updatedSurvey.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedSurvey),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Error al actualizar la encuesta");
    }
    fetchSurveys(); // Recargar encuestas después de actualizar
  };

  // Lógica para Eliminar Encuesta
  const handleDeleteSurvey = async (surveyId: string) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar esta encuesta?")) {
      try {
        const response = await fetch(`/api/surveys/${surveyId}`, {
          method: "DELETE",
        });
        if (!response.ok && response.status !== 204) { // 204 es éxito sin contenido
          const errorData = await response.json();
          throw new Error(errorData.error || "Error al eliminar la encuesta");
        }
        fetchSurveys(); // Recargar encuestas después de eliminar
      } catch (err) {
        if (err instanceof Error) {
          alert(`Error al eliminar: ${err.message}`);
        } else {
          alert("Error desconocido al eliminar la encuesta.");
        }
      }
    }
  };

  if (status === "loading") {
    return <p className="text-center py-10">Cargando sesión...</p>;
  }

  if (!session || !session.user?.isAdmin) {
    // Esto no debería pasar si el middleware funciona, pero es una salvaguarda
    return <p className="text-center py-10 text-red-500">Acceso denegado.</p>;
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Dashboard de Administración</h1>
        <button
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out"
        >
          Cerrar Sesión
        </button>
      </div>

      {/* Crear Nueva Encuesta */} 
      <div className="mb-10 p-6 bg-white shadow-md rounded-lg">
        <h2 className="text-2xl font-semibold mb-4">Crear Nueva Encuesta</h2>
        <form onSubmit={handleCreateSurvey}>
          <div className="mb-4">
            <label htmlFor="surveyTitle" className="block text-sm font-medium text-gray-700 mb-1">Título:</label>
            <input
              type="text"
              id="surveyTitle"
              value={newSurveyTitle}
              onChange={(e) => setNewSurveyTitle(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="surveySlug" className="block text-sm font-medium text-gray-700 mb-1">Slug (para URL amigable):</label>
            <input
              type="text"
              id="surveySlug"
              value={newSurveySlug}
              onChange={(e) => setNewSurveySlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              required
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              title="Solo letras minúsculas, números y guiones. No empezar/terminar con guion."
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="ejemplo-de-slug-unico"
            />
          </div>
          <div className="mb-6">
            <label htmlFor="surveyDescription" className="block text-sm font-medium text-gray-700 mb-1">Descripción (Opcional):</label>
            <textarea
              id="surveyDescription"
              value={newSurveyDescription}
              onChange={(e) => setNewSurveyDescription(e.target.value)}
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          {createSurveyError && <p className="text-red-500 text-sm mb-4">Error: {createSurveyError}</p>}
          <button
            type="submit"
            disabled={isCreatingSurvey}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out disabled:opacity-50"
          >
            {isCreatingSurvey ? "Creando..." : "Crear Encuesta"}
          </button>
        </form>
      </div>

      {/* Lista de Encuestas Existentes */} 
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-semibold mb-6">Encuestas Existentes</h2>
        {isLoadingSurveys && <p>Cargando encuestas...</p>}
        {errorSurveys && <p className="text-red-500">Error al cargar encuestas: {errorSurveys}</p>}
        {!isLoadingSurveys && !errorSurveys && surveys.length === 0 && (
          <p className="text-gray-500">No hay encuestas creadas todavía.</p>
        )}
        {!isLoadingSurveys && !errorSurveys && surveys.length > 0 && (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Título</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha de Creación</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {surveys.map((survey) => (
                <tr key={survey.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{survey.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{survey.description}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(survey.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{survey.isActive ? "Activa" : "Inactiva"}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleOpenEditModal(survey)}
                      className="text-indigo-600 hover:text-indigo-900 mr-3"
                    >
                      Editar
                    </button>
                    <Link href={`/admin/surveys/${survey.id}/manage`} className="text-green-600 hover:text-green-900 mr-3">
                      Gestionar
                    </Link>
                    <Link href={`/admin/surveys/${survey.id}/results`} className="text-blue-600 hover:text-blue-900 mr-3">
                      Ver Resultados
                    </Link>
                    <button
                      onClick={() => handleDeleteSurvey(survey.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      {/* Modal de Edición */}
      <EditSurveyModal 
        survey={editingSurvey}
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        onSave={handleSaveSurvey}
      />
    </div>
  );
};

export default AdminDashboardPage; 