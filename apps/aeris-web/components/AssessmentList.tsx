import type { JSX } from 'react';
import { ASSESSMENT_QUESTIONS } from '../lib/assessments/model';
import type { AssessmentSummary } from '../lib/assessments/service';

interface AssessmentListProps {
  readonly items: readonly AssessmentSummary[];
  readonly onExport: (id: string) => void;
}

export function AssessmentList({ items, onExport }: AssessmentListProps): JSX.Element {
  if (items.length === 0) {
    return <p className="hint">Noch keine Einträge vorhanden.</p>;
  }
  return (
    <ul className="assessment-list">
      {items.map((item) => (
        <li key={item.id} className="card soft">
          <p className="muted">{new Date(item.authoredAt).toLocaleString('de-DE')}</p>
          <ul>
            {ASSESSMENT_QUESTIONS.map((question) => (
              <li key={question.key}>
                {question.label}: <strong>{item.answers[question.key]}</strong>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              onExport(item.id);
            }}
          >
            Als FHIR exportieren
          </button>
        </li>
      ))}
    </ul>
  );
}
