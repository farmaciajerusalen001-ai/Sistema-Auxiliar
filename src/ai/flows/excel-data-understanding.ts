// excel-data-understanding.ts
'use server';

/**
 * @fileOverview Genkit flow for understanding the structure of Excel data upon import, 
 * identifying column headers and data types using an LLM.
 *
 * - excelDataUnderstanding - A function that takes excel data as input and returns a data type classification.
 * - ExcelDataUnderstandingInput - The input type for the excelDataUnderstanding function.
 * - ExcelDataUnderstandingOutput - The return type for the excelDataUnderstanding function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExcelDataUnderstandingInputSchema = z.object({
  excelData: z.string().describe('A tab-separated string of the Excel header row.'),
});
export type ExcelDataUnderstandingInput = z.infer<typeof ExcelDataUnderstandingInputSchema>;

const ExcelDataUnderstandingOutputSchema = z.object({
  columnDefinitions: z.array(
    z.object({
      header: z.string().describe('The column header from the input excelData.'),
      dataType: z.enum(['code', 'name', 'laboratory', 'quantity', 'unit', 'other']).describe('The classified data type for the column.'),
    })
  ).describe('An array of column definitions with header and data type.'),
});
export type ExcelDataUnderstandingOutput = z.infer<typeof ExcelDataUnderstandingOutputSchema>;

export async function excelDataUnderstanding(input: ExcelDataUnderstandingInput): Promise<ExcelDataUnderstandingOutput> {
  return excelDataUnderstandingFlow(input);
}

const excelDataUnderstandingPrompt = ai.definePrompt({
  name: 'excelDataUnderstandingPrompt',
  input: {schema: ExcelDataUnderstandingInputSchema},
  output: {schema: ExcelDataUnderstandingOutputSchema},
  prompt: `You are a data mapping specialist. Your task is to classify a list of tab-separated Excel headers based on a strict set of rules. For each header in the input, you MUST classify it into one of the following data types: 'code', 'name', 'laboratory', 'quantity', 'unit', 'other'.

Follow these exact mapping rules. Do not deviate.
- If the header is 'CODIGO', classify it as 'code'.
- If the header is 'DESCRIPCION', classify it as 'name'.
- If the header is 'FAMILIA', classify it as 'laboratory'.
- If the header is 'A PEDIR', classify it as 'quantity'.
- If the header is 'UNI.MED', classify it as 'unit'.
- For any other header (like 'VALOR UNIT.', 'EXISTENCIA', 'VTA.PROM.MENSUAL', 'COBERTURA', etc.), classify it as 'other'.

Analyze the following tab-separated Excel headers and produce a JSON output. The JSON object must contain a 'columnDefinitions' array, where each element is an object with the original 'header' and its classified 'dataType'.

Excel Headers:
{{{excelData}}}
`,
});

const excelDataUnderstandingFlow = ai.defineFlow(
  {
    name: 'excelDataUnderstandingFlow',
    inputSchema: ExcelDataUnderstandingInputSchema,
    outputSchema: ExcelDataUnderstandingOutputSchema,
  },
  async input => {
    const {output} = await excelDataUnderstandingPrompt(input);
    return output!;
  }
);
