'use client';

// import Link from 'next/link'; // Eliminado
// import { useParams } from 'next/navigation'; // Eliminado o Comentado

export default function ThankYouPage() {
  // const params = useParams(); // Eliminado o comentado
  // const surveySlug = params.surveySlug as string; // Eliminado - Podríamos usarlo si queremos personalizar el mensaje o enlaces

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-100 to-teal-100 flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white p-8 sm:p-12 rounded-xl shadow-2xl max-w-lg w-full">
        <svg className="w-16 h-16 text-green-500 mx-auto mb-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-4">
          ¡Gracias por participar!
        </h1>
        <p className="text-gray-600 text-lg mb-8">
          Tus respuestas han sido enviadas con éxito y serán tratadas de forma anónima y confidencial.
        </p>
        <p className="text-gray-600 mb-8">
          Apreciamos mucho tu tiempo y tu contribución.
        </p>
        {/* Opcional: Enlace para volver a alguna página principal o cerrar */}
        {/* <Link href="/" className="mt-6 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition duration-150 ease-in-out">
          Volver al inicio
        </Link> */}
         <p className="text-sm text-gray-500 mt-8">
          Puedes cerrar esta ventana.
        </p>
      </div>
      <footer className="mt-12 text-center text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} Poder Judicial de la Nación. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
} 