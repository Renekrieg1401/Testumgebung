import { QuestionnaireResponseSchema, type QuestionnaireResponse } from './questionnaire-response.schema';
import type { DecryptedAssessment } from './types';

/**
 * Bildet ein entschlüsseltes Assessment auf eine FHIR-R4-
 * QuestionnaireResponse-Ressource ab (BfArM-DiPA-Interoperabilitätskriterium).
 * Läuft ausschließlich clientseitig auf bereits entschlüsselten Daten.
 */
export function toFhirQuestionnaireResponse(assessment: DecryptedAssessment): QuestionnaireResponse {
  const resource: QuestionnaireResponse = {
    resourceType: 'QuestionnaireResponse',
    id: assessment.id,
    questionnaire: assessment.questionnaireCanonicalUrl,
    status: 'completed',
    subject: { reference: `Patient/${assessment.subjectPseudonymId}` },
    authored: assessment.authoredAt,
    item: assessment.items.map((item) => ({
      linkId: item.linkId,
      text: item.questionText,
      answer: [{ valueDecimal: item.value }],
    })),
  };
  return QuestionnaireResponseSchema.parse(resource);
}
