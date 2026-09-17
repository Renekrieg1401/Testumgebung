import { describe, expect, it } from 'vitest';
import { toFhirQuestionnaireResponse, type DecryptedAssessment } from '../src/index';

const SAMPLE_ASSESSMENT: DecryptedAssessment = {
  id: '33333333-3333-3333-3333-333333333333',
  questionnaireCanonicalUrl: 'https://aeris.dipa.de/fhir/Questionnaire/pflegebelastung-skala',
  subjectPseudonymId: 'pseudo-9f8e7d6c',
  authoredAt: '2026-01-01T10:00:00.000Z',
  items: [
    { linkId: 'q1', questionText: 'Wie belastet fühlen Sie sich heute?', value: 6 },
    { linkId: 'q2', questionText: 'Wie war Ihr Schlaf letzte Nacht?', value: 3 },
  ],
};

describe('toFhirQuestionnaireResponse', () => {
  it('bildet ein Assessment auf eine gültige QuestionnaireResponse ab', () => {
    const resource = toFhirQuestionnaireResponse(SAMPLE_ASSESSMENT);

    expect(resource.resourceType).toBe('QuestionnaireResponse');
    expect(resource.subject.reference).toBe('Patient/pseudo-9f8e7d6c');
    expect(resource.item).toHaveLength(2);
    expect(resource.item[0]?.answer[0]?.valueDecimal).toBe(6);
  });

  it('enthält keinen Klarnamen in der Subjekt-Referenz', () => {
    const resource = toFhirQuestionnaireResponse(SAMPLE_ASSESSMENT);
    expect(resource.subject.reference).not.toMatch(/[A-ZÄÖÜ][a-zäöüß]+ [A-ZÄÖÜ][a-zäöüß]+/);
  });
});
