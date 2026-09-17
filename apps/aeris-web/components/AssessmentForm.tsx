'use client';

import { useState, type SyntheticEvent, type JSX } from 'react';
import {
  ASSESSMENT_QUESTIONS,
  type AssessmentAnswers,
  type AssessmentQuestionMeta,
} from '../lib/assessments/model';

interface AssessmentFormProps {
  readonly onSubmit: (answers: AssessmentAnswers) => Promise<void>;
}

const DEFAULT_VALUE = 5;

interface QuestionSliderProps {
  readonly question: AssessmentQuestionMeta;
  readonly value: number;
  readonly onChange: (value: number) => void;
}

function QuestionSlider({ question, value, onChange }: QuestionSliderProps): JSX.Element {
  return (
    <div className="range-row-group">
      <label htmlFor={question.key}>{question.label}</label>
      <div className="range-row">
        <input
          id={question.key}
          type="range"
          min={0}
          max={10}
          step={1}
          value={value}
          onChange={(event) => {
            onChange(Number(event.target.value));
          }}
        />
        <output htmlFor={question.key}>{value}</output>
      </div>
      <p className="hint scale-help">{question.helpText}</p>
    </div>
  );
}

export function AssessmentForm({ onSubmit }: AssessmentFormProps): JSX.Element {
  const [values, setValues] = useState<AssessmentAnswers>({
    belastung: DEFAULT_VALUE,
    erschoepfung: DEFAULT_VALUE,
    selbstsorge: DEFAULT_VALUE,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    setIsSubmitting(true);
    void onSubmit(values).finally(() => {
      setIsSubmitting(false);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card" aria-labelledby="assessment-form-heading">
      <h2 id="assessment-form-heading" className="section-title">
        Kurz-Belastungscheck
      </h2>
      {ASSESSMENT_QUESTIONS.map((question) => (
        <QuestionSlider
          key={question.key}
          question={question}
          value={values[question.key]}
          onChange={(value) => {
            setValues((previous) => ({ ...previous, [question.key]: value }));
          }}
        />
      ))}
      <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
        {isSubmitting ? 'Wird gespeichert …' : 'Verschlüsselt speichern'}
      </button>
    </form>
  );
}
