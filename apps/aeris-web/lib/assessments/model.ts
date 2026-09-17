import { z } from 'zod';

export const CARE_BURDEN_QUESTIONNAIRE_URL =
  'https://aeris.dipa.de/fhir/Questionnaire/kurz-belastungscheck';

export const AssessmentAnswersSchema = z.object({
  belastung: z.number().min(0).max(10),
  erschoepfung: z.number().min(0).max(10),
  selbstsorge: z.number().min(0).max(10),
});
export type AssessmentAnswers = z.infer<typeof AssessmentAnswersSchema>;

export interface AssessmentQuestionMeta {
  readonly key: keyof AssessmentAnswers;
  readonly linkId: string;
  readonly label: string;
  readonly helpText: string;
}

export const ASSESSMENT_QUESTIONS: readonly AssessmentQuestionMeta[] = [
  {
    key: 'belastung',
    linkId: 'q1',
    label: 'Wie belastet fühlen Sie sich aktuell durch die Pflegesituation?',
    helpText: '0 = gar nicht belastet, 10 = extrem belastet',
  },
  {
    key: 'erschoepfung',
    linkId: 'q2',
    label: 'Wie erschöpft fühlen Sie sich körperlich?',
    helpText: '0 = gar nicht erschöpft, 10 = völlig erschöpft',
  },
  {
    key: 'selbstsorge',
    linkId: 'q3',
    label: 'Wie gut konnten Sie in der letzten Woche für sich selbst sorgen?',
    helpText: '0 = gar nicht, 10 = sehr gut',
  },
];
