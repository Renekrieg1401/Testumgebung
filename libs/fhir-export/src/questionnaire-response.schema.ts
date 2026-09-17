import { z } from 'zod';

const FhirAnswerSchema = z.object({
  valueDecimal: z.number(),
});

const FhirItemSchema = z.object({
  linkId: z.string().min(1),
  text: z.string().min(1),
  answer: z.array(FhirAnswerSchema).min(1),
});

export const QuestionnaireResponseSchema = z.object({
  resourceType: z.literal('QuestionnaireResponse'),
  id: z.string().min(1),
  questionnaire: z.string().url(),
  status: z.literal('completed'),
  subject: z.object({ reference: z.string().min(1) }),
  authored: z.string().datetime(),
  item: z.array(FhirItemSchema).min(1),
});

export type QuestionnaireResponse = z.infer<typeof QuestionnaireResponseSchema>;
