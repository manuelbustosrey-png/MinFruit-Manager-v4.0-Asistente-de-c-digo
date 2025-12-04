import { GoogleGenAI } from "@google/genai";
import { ProductionLot } from '../types';

const apiKey = process.env.API_KEY || '';

export const analyzeYield = async (lot: ProductionLot, producerName: string): Promise<string> => {
    if (!apiKey) {
        return "Clave API de Gemini no configurada. No se puede realizar el análisis.";
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        
        const prompt = `
            Actúa como un ingeniero agrónomo experto en procesos de postcosecha y calidad de fruta.
            Analiza los siguientes datos de un lote de producción de fruta:
            
            Productor: ${producerName}
            Kilos Netos Ingresados: ${lot.totalInputNetWeight.toFixed(2)} kg
            
            Producción Exportable (Embalaje): ${lot.producedKilos.toFixed(2)} kg
            Congelado (IQF): ${lot.iqfKilos.toFixed(2)} kg
            Merma (Pérdida Natural): ${lot.mermaKilos.toFixed(2)} kg
            Desecho (Basura): ${lot.wasteKilos.toFixed(2)} kg
            
            Rendimiento Global: ${lot.yieldPercentage.toFixed(2)}%

            Por favor, entrega un reporte breve (máximo 3 párrafos) en texto plano que incluya:
            1. Evaluación de la eficiencia del proceso.
            2. Si el nivel de merma/desecho es preocupante comparado con estándares de la industria frutícola (asume estándares generales de berries o carozos).
            3. Una recomendación para mejorar el rendimiento.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text || "No se pudo generar el análisis.";
    } catch (error) {
        console.error("Error calling Gemini:", error);
        return "Error al conectar con el servicio de IA. Intente nuevamente más tarde.";
    }
};