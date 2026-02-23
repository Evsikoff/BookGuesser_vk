import React from 'react';

interface StatsModalProps {
  onClose: () => void;
  totalScore: number;
  questionCount: number;
  totalCorrectAnswers: number;
  bestStreak: number;
  solvedParagraphIdsCount: number;
  totalParagraphsCount: number;
  failedQuestionsCount: number;
}

const StatRow: React.FC<{ icon: string; label: string; value: string; color?: string }> = ({
  icon, label, value, color = 'text-stone-800',
}) => (
  <div className="flex items-center justify-between py-2.5 border-b border-stone-100 last:border-0">
    <div className="flex items-center gap-3 text-stone-500">
      <i className={`fa-solid ${icon} w-4 text-center text-sm`}></i>
      <span className="text-sm font-medium">{label}</span>
    </div>
    <span className={`font-bold text-sm ${color}`}>{value}</span>
  </div>
);

export const StatsModal: React.FC<StatsModalProps> = ({
  onClose,
  totalScore,
  questionCount,
  totalCorrectAnswers,
  bestStreak,
  solvedParagraphIdsCount,
  totalParagraphsCount,
  failedQuestionsCount,
}) => {
  const accuracy = questionCount > 0
    ? `${Math.round((totalCorrectAnswers / questionCount) * 100)}%`
    : '—';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl border border-stone-100 w-full max-w-sm p-8 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100 transition-colors"
          aria-label="Закрыть"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>

        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3 shadow-inner">
            <i className="fa-solid fa-chart-bar"></i>
          </div>
          <h2 className="text-xl font-bold text-stone-800 serif">Статистика</h2>
        </div>

        <div>
          <StatRow
            icon="fa-trophy"
            label="Общий счёт"
            value={totalScore.toLocaleString('ru-RU')}
            color="text-amber-700"
          />
          <StatRow
            icon="fa-circle-question"
            label="Всего вопросов"
            value={String(questionCount)}
          />
          <StatRow
            icon="fa-check"
            label="Правильных ответов"
            value={String(totalCorrectAnswers)}
            color="text-green-700"
          />
          <StatRow
            icon="fa-bullseye"
            label="Точность"
            value={accuracy}
          />
          <StatRow
            icon="fa-fire"
            label="Лучшая серия"
            value={String(bestStreak)}
            color="text-orange-600"
          />
          <StatRow
            icon="fa-book"
            label="Открыто произведений"
            value={`${solvedParagraphIdsCount} / ${totalParagraphsCount}`}
          />
          <StatRow
            icon="fa-rotate"
            label="На повторении"
            value={String(failedQuestionsCount)}
            color={failedQuestionsCount > 0 ? 'text-red-600' : 'text-stone-800'}
          />
        </div>
      </div>
    </div>
  );
};
