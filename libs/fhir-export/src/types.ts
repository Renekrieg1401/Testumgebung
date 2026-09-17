/**
 * Entschlüsselte Assessment-Daten. Existiert ausschließlich clientseitig
 * nach Entschlüsselung mit dem DEK — verlässt den Browser/die App nur auf
 * expliziten Nutzerwunsch (Datenexport, § 630g BGB / DSGVO Art. 20).
 */
export interface AssessmentAnswerItem {
  readonly linkId: string;
  readonly questionText: string;
  readonly value: number;
}

export interface DecryptedAssessment {
  readonly id: string;
  readonly questionnaireCanonicalUrl: string;
  readonly subjectPseudonymId: string;
  readonly authoredAt: string;
  readonly items: readonly AssessmentAnswerItem[];
}
