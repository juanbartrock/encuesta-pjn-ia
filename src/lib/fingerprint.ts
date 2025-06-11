import FingerprintJS from '@fingerprintjs/fingerprintjs';
import type { Agent } from '@fingerprintjs/fingerprintjs';

let fpPromise: Promise<Agent> | null = null;

/**
 * Inicializa FingerprintJS una sola vez y reutiliza la instancia
 */
async function getFingerprintAgent(): Promise<Agent> {
  if (!fpPromise) {
    fpPromise = FingerprintJS.load();
  }
  return fpPromise;
}

/**
 * Genera un fingerprint único del navegador
 * @returns Promise<string> - El fingerprint único del navegador
 */
export async function generateBrowserFingerprint(): Promise<string> {
  try {
    const fp = await getFingerprintAgent();
    const result = await fp.get();
    return result.visitorId;
  } catch (error) {
    console.error('Error generando fingerprint:', error);
    // Fallback: genera un ID temporal si FingerprintJS falla
    return `fallback_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
}

/**
 * Obtiene el fingerprint específico para una encuesta desde localStorage
 * Si no existe, genera uno nuevo y lo guarda
 * @param surveyId - ID de la encuesta
 * @returns Promise<string> - El fingerprint para esta encuesta
 */
export async function getSurveyFingerprint(surveyId: string): Promise<string> {
  const storageKey = `survey_fingerprint_${surveyId}`;
  
  // Intentar obtener desde localStorage primero
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      return stored;
    }
  }
  
  // Si no existe, generar uno nuevo
  const fingerprint = await generateBrowserFingerprint();
  
  // Guardar en localStorage para persistencia
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(storageKey, fingerprint);
    } catch (error) {
      console.warn('No se pudo guardar fingerprint en localStorage:', error);
    }
  }
  
  return fingerprint;
} 