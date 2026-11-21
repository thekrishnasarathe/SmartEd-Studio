import React from 'react';
import SheetViewer from '../components/SheetViewer.jsx';
import QuestionGradingCard from '../components/QuestionGradingCard.jsx';

export default function VerificationWorkspace({
  submission,
  activeQuestion,
  setActiveQuestion,
  onUpdateAnswer,
  onAddStamp,
}) {
  if (!submission) return null;
  return (
    <div className="max-w-[1600px] mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-132px)]">
      <div className="lg:col-span-6 h-full overflow-hidden">
        <SheetViewer
          submission={submission}
          activeQuestion={activeQuestion}
          onSelectQuestion={setActiveQuestion}
          onAddStamp={onAddStamp}
        />
      </div>
      <div className="lg:col-span-6 h-full overflow-y-auto space-y-3 pr-1">
        {(submission.answers || []).map((ans) => (
          <QuestionGradingCard
            key={ans.id}
            answer={ans}
            isSelected={activeQuestion === ans.question_number}
            onSelect={setActiveQuestion}
            onUpdateAnswer={onUpdateAnswer}
          />
        ))}
      </div>
    </div>
  );
}
