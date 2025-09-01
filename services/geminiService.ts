
import { GoogleGenAI, Type } from "@google/genai";

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

export const processReceipt = async (imageFile: File): Promise<any> => {
  try {
    const imagePart = await fileToGenerativePart(imageFile);
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
          parts: [
            imagePart,
            { text: "Analyze this receipt image. Extract all line items with their descriptions and amounts, and suggest a category for the expense (e.g., Groceries, Food & Drink, Utilities, Transport, Shopping). Provide the output in the specified JSON format." }
          ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              description: "List of all detected line items from the receipt.",
              items: {
                type: Type.OBJECT,
                properties: {
                  description: {
                    type: Type.STRING,
                    description: "Description of the line item (e.g., 'Milk', 'Sales Tax')."
                  },
                  amount: {
                    type: Type.NUMBER,
                    description: "The numerical value of the line item."
                  }
                },
                propertyOrdering: ["description", "amount"],
              }
            },
            category: {
              type: Type.STRING,
              description: "A suggested expense category for this receipt."
            }
          },
          propertyOrdering: ["items", "category"],
        }
      }
    });

    const jsonString = response.text;
    const parsedResult = JSON.parse(jsonString);
    
    // The component will handle sanitization and total calculation.
    return parsedResult;

  } catch (error) {
    console.error("Error processing receipt with Gemini API:", error);
    if (error instanceof SyntaxError) {
        throw new Error("Failed to analyze the receipt. The AI returned an invalid data format.");
    }
    throw new Error("Failed to analyze the receipt. The AI model could not process the image.");
  }
};