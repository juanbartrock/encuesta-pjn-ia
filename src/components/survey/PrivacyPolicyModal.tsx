'use client';

import React from 'react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[100] transition-opacity duration-300 ease-in-out" onClick={onClose}>
      <div 
        className="bg-white p-6 sm:p-8 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modalShow"
        onClick={(e) => e.stopPropagation()} // Evitar que el clic dentro del modal lo cierre
      >
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-800">Política de Anonimato y Confidencialidad</h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Cerrar modal"
          >
            <svg className="w-6 h-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        
        <div className="prose prose-sm sm:prose-base max-w-none text-gray-700 space-y-4">
          <p>
            En el Poder Judicial de la Nación, valoramos profundamente su privacidad y la confianza que deposita en nosotros al participar en esta encuesta. 
            Nos comprometemos a proteger su anonimato y la confidencialidad de sus respuestas de acuerdo con los siguientes principios:
          </p>

          <h3 className="text-lg font-semibold text-gray-700 !mt-6 !mb-2">1. Recolección Anónima de Datos:</h3>
          <ul className="list-disc list-outside pl-5 space-y-1">
            <li>La encuesta ha sido diseñada para ser completada de forma completamente <strong>ANÓNIMA</strong>.</li>
            <li><strong>NO</strong> se recolectará ninguna información de identificación personal (como nombre, dirección de correo electrónico, número de legajo, dirección IP, o cualquier otro dato que pueda identificarlo directa o indirectamente) junto con sus respuestas.</li>
            <li>No existen mecanismos técnicos que permitan rastrear las respuestas hasta un individuo específico.</li>
          </ul>

          <h3 className="text-lg font-semibold text-gray-700 !mt-6 !mb-2">2. Uso de la Información:</h3>
          <ul className="list-disc list-outside pl-5 space-y-1">
            <li>Las respuestas serán agrupadas y analizadas de forma agregada <strong>ÚNICAMENTE</strong> con fines estadísticos y para obtener una comprensión general sobre las percepciones y opiniones respecto a la implementación de Inteligencia Artificial en el ámbito judicial.</li>
            <li>Los informes generados a partir de estos datos presentarán información consolidada, impidiendo la identificación de respuestas individuales.</li>
            <li>El objetivo es mejorar nuestros procesos y estrategias basándonos en la retroalimentación colectiva, no evaluar o monitorear a empleados individualmente.</li>
          </ul>

          <h3 className="text-lg font-semibold text-gray-700 !mt-6 !mb-2">3. Almacenamiento y Seguridad de los Datos:</h3>
          <ul className="list-disc list-outside pl-5 space-y-1">
            <li>Los datos de las respuestas se almacenarán en servidores seguros, protegidos con medidas técnicas adecuadas para prevenir el acceso no autorizado.</li>
            <li>Solo un equipo reducido y autorizado tendrá acceso a la base de datos de respuestas crudas (siempre anónimas) con el único propósito de realizar el análisis estadístico agregado.</li>
          </ul>

          <h3 className="text-lg font-semibold text-gray-700 !mt-6 !mb-2">4. No Represalias:</h3>
          <ul className="list-disc list-outside pl-5 space-y-1">
            <li>Le aseguramos que su participación es voluntaria y sus respuestas, al ser anónimas, no tendrán ninguna repercusión, ni positiva ni negativa, en su situación laboral o profesional.</li>
            <li>Fomentamos la honestidad y la transparencia en sus respuestas para que los resultados sean lo más fidedignos y útiles posible.</li>
          </ul>
          
          <h3 className="text-lg font-semibold text-gray-700 !mt-6 !mb-2">5. Participación y Consentimiento:</h3>
          <p>
            Al iniciar y completar esta encuesta, usted comprende y acepta que sus respuestas serán tratadas de acuerdo con esta política de anonimato y confidencialidad.
          </p>

          <p className="!mt-6">
            Agradecemos sinceramente su tiempo y su valiosa contribución. Su perspectiva es fundamental para nosotros.
          </p>
          
          {/* 
          <p className="text-xs italic text-gray-500 !mt-6">
            Si tiene alguna duda sobre esta política, por favor, absténgase de completar la encuesta y comuníquese con [Contacto o Departamento Responsable - opcional, considerar si esto podría comprometer el anonimato si se hace antes de responder].
          </p>
          */}
        </div>

        <div className="mt-6 sm:mt-8 text-right">
          <button 
            onClick={onClose} 
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors text-sm font-medium"
          >
            Entendido, Cerrar
          </button>
        </div>
      </div>
      <style jsx global>{`
        @keyframes modalShowAnim {
          0% { transform: scale(0.95); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-modalShow {
          animation: modalShowAnim 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default PrivacyPolicyModal; 