import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function TermsAndConditions() {
  const navigate = useNavigate()

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold">Términos y Condiciones</h1>
      </div>

      <div className="card space-y-6 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
        <p className="text-xs text-gray-400">Última actualización: Marzo 2026</p>

        <section>
          <h2 className="text-base font-bold text-gray-800 dark:text-white mb-2">1. Aceptación de los Términos</h2>
          <p>
            Al registrarte y utilizar JOSSFITness, aceptas estos Términos y Condiciones en su totalidad.
            Si no estás de acuerdo, no deberás utilizar la aplicación.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-800 dark:text-white mb-2">2. Naturaleza del Servicio</h2>
          <p>
            JOSSFITness es una <strong>herramienta de guía y seguimiento de entrenamiento físico</strong>.
            La app genera rutinas de ejercicio basadas en los datos proporcionados por el usuario y algoritmos
            de programación de entrenamiento.
          </p>
          <p className="mt-2">
            <strong>JOSSFITness NO es un servicio médico, de diagnóstico ni de prescripción.</strong> Las
            rutinas generadas, incluyendo las adaptadas a condiciones médicas (modo adaptativo), son
            orientativas y no sustituyen la opinión de un profesional de la salud.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-800 dark:text-white mb-2">3. Responsabilidad del Usuario</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>El usuario es el único responsable de su salud y bienestar físico al realizar cualquier ejercicio.</li>
            <li>El usuario debe consultar con un médico antes de iniciar cualquier programa de ejercicio, especialmente si tiene condiciones de salud preexistentes.</li>
            <li>El usuario se compromete a proporcionar información veraz sobre su estado de salud, condiciones médicas, medicamentos y limitaciones.</li>
            <li>El usuario reconoce que el ejercicio físico conlleva riesgos inherentes, incluyendo pero no limitado a lesiones musculares, articulares, cardiovasculares y otros.</li>
            <li>El usuario debe detener inmediatamente el ejercicio si experimenta dolor, mareo, dificultad para respirar u otros síntomas adversos.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-800 dark:text-white mb-2">4. Modo Adaptativo — Condiciones Médicas</h2>
          <p>
            El modo adaptativo ajusta las rutinas según condiciones de salud reportadas. Este modo:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>No constituye</strong> un diagnóstico médico ni una prescripción terapéutica.</li>
            <li><strong>No reemplaza</strong> la supervisión de un profesional de la salud.</li>
            <li>Las alertas de seguridad son informativas y basadas en guías generales, no en la evaluación individual del usuario.</li>
            <li>El usuario <strong>debe obtener autorización médica</strong> antes de seguir cualquier rutina adaptativa, especialmente en casos de riesgo alto o crítico.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-800 dark:text-white mb-2">5. Datos Personales y Médicos</h2>
          <p>
            JOSSFITness recopila datos personales (nombre, email, datos físicos) y opcionalmente datos
            de salud (condiciones médicas, medicamentos, limitaciones) para personalizar la experiencia.
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Los datos de salud se almacenan de forma segura y se utilizan exclusivamente para la generación de rutinas.</li>
            <li>No compartimos datos de salud con terceros.</li>
            <li>El usuario puede eliminar sus datos en cualquier momento contactando a soporte.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-800 dark:text-white mb-2">6. Limitación de Responsabilidad</h2>
          <p>
            JOSSFITness, sus creadores, administradores y colaboradores <strong>no son responsables</strong> por:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Lesiones o daños resultantes del uso de las rutinas generadas.</li>
            <li>Complicaciones de salud derivadas de no seguir las recomendaciones médicas.</li>
            <li>Resultados de entrenamiento que no cumplan las expectativas del usuario.</li>
            <li>El uso inadecuado de la aplicación o la omisión de información médica relevante.</li>
          </ul>
          <p className="mt-2">
            El uso de JOSSFITness es bajo la <strong>total responsabilidad del usuario</strong>.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-800 dark:text-white mb-2">7. Recomendaciones de Seguridad</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Siempre calienta antes de entrenar y enfría al terminar.</li>
            <li>Mantén una hidratación adecuada durante el ejercicio.</li>
            <li>Usa técnica correcta en todos los ejercicios.</li>
            <li>Progresa gradualmente en peso e intensidad.</li>
            <li>Descansa lo suficiente entre sesiones de entrenamiento.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-800 dark:text-white mb-2">8. Propiedad Intelectual</h2>
          <p>
            Todo el contenido de JOSSFITness (diseño, código, algoritmos, marca) es propiedad de sus
            creadores. No está permitida la reproducción, distribución o modificación sin autorización.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-800 dark:text-white mb-2">9. Modificaciones</h2>
          <p>
            Nos reservamos el derecho de modificar estos términos en cualquier momento.
            Los cambios serán notificados a través de la aplicación.
          </p>
        </section>

        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-400 text-center">
            JOSSFITness — Plataforma de Entrenamiento, Salud y Rendimiento
          </p>
        </div>
      </div>
    </div>
  )
}
