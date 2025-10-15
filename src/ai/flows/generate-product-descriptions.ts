'use server';

/**
 * @fileOverview A flow for generating product descriptions based on available data.
 *
 * - generateProductDescription - A function that generates a product description.
 * - GenerateProductDescriptionInput - The input type for the generateProductDescription function.
 * - GenerateProductDescriptionOutput - The return type for the generateProductDescription function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateProductDescriptionInputSchema = z.object({
  productCode: z.string().describe('The product code or identifier.'),
  productName: z.string().describe('The name of the product.'),
  unit: z.string().describe('The current unit of the product (e.g., caja, tableta).'),
  quantityRequested: z.number().describe('The quantity requested for the product.'),
  laboratory: z.string().describe('The laboratory that produces the product.'),
  drugstore: z.string().describe('The drugstore associated with the product.'),
});

export type GenerateProductDescriptionInput = z.infer<typeof GenerateProductDescriptionInputSchema>;

const GenerateProductDescriptionOutputSchema = z.object({
  suggestedDescription: z.string().describe('The generated product description.'),
});

export type GenerateProductDescriptionOutput = z.infer<typeof GenerateProductDescriptionOutputSchema>;

export async function generateProductDescription(input: GenerateProductDescriptionInput): Promise<GenerateProductDescriptionOutput> {
  return generateProductDescriptionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateProductDescriptionPrompt',
  input: {schema: GenerateProductDescriptionInputSchema},
  output: {schema: GenerateProductDescriptionOutputSchema},
  prompt: `You are an expert in writing product descriptions for pharmaceutical products.

  Based on the following information, generate a concise and informative product description. The description should highlight the key features and benefits of the product.

  Product Code: {{{productCode}}}
  Product Name: {{{productName}}}
  Unit: {{{unit}}}
  Quantity Requested: {{{quantityRequested}}}
  Laboratory: {{{laboratory}}}
  Drugstore: {{{drugstore}}}

  Focus on providing a description that is suitable for use in a pharmaceutical product catalog or inventory management system.
  The description should be no more than 100 words.
  `,
});

const generateProductDescriptionFlow = ai.defineFlow(
  {
    name: 'generateProductDescriptionFlow',
    inputSchema: GenerateProductDescriptionInputSchema,
    outputSchema: GenerateProductDescriptionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
