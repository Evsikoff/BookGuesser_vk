import React, { useState, useCallback, useEffect } from 'react';
import { Layout } from './components/Layout';
import { BookOption } from './components/BookOption';
import { BookAutocomplete } from './components/BookAutocomplete';
import { StatsModal } from './components/StatsModal';
import { fetchBookQuestion } from './services/geminiService';
import { Question, Book, GameStatus, FailedQuestion, Difficulty } from './types';
import { paragraphs } from './data/paragraphs';

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  [Difficulty.VERY_EASY]: 'Очень легкий',
  [Difficulty.EASY]: 'Легкий',
  [Difficulty.MEDIUM]: 'Средний',
  [Difficulty.HARD]: 'Сложный',
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  [Difficulty.VERY_EASY]: 'bg-green-500',
  [Difficulty.EASY]: 'bg-blue-500',
  [Difficulty.MEDIUM]: 'bg-orange-500',
  [Difficulty.HARD]: 'bg-red-600',
};

import { initVKBridge, isVKBridgeReady, storageGet, storageSet, showInterstitialAd } from './services/vkBridgeService';

const STORAGE_KEY = "bookguesser.correctParagraphIds";
const FAILED_STORAGE_KEY = "bookguesser.failedQuestions";
const QUESTION_COUNT_KEY = "bookguesser.questionCount";
const BEST_STREAK_KEY = "bookguesser.bestStreak";
const TOTAL_CORRECT_KEY = "bookguesser.totalCorrectAnswers";
const TOTAL_SCORE_KEY = "bookguesser.totalScore";

function loadFromLocalStorage() {
  let solvedParagraphIds: string[] = [];
  let failedQuestions: FailedQuestion[] = [];
  let questionCount = 0;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        solvedParagraphIds = parsed.filter((item) => typeof item === "string");
      }
    }
  } catch { /* ignore */ }

  try {
    const raw = localStorage.getItem(FAILED_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        failedQuestions = parsed.filter(
          (item) =>
            typeof item === "object" &&
            item !== null &&
            typeof item.paragraphId === "string" &&
            typeof item.failedAt === "number"
        );
      }
    }
  } catch { /* ignore */ }

  try {
    const raw = localStorage.getItem(QUESTION_COUNT_KEY);
    if (raw) questionCount = parseInt(raw, 10) || 0;
  } catch { /* ignore */ }

  let bestStreak = 0;
  let totalCorrectAnswers = 0;
  let totalScore = 0;

  try {
    const raw = localStorage.getItem(BEST_STREAK_KEY);
    if (raw) bestStreak = parseInt(raw, 10) || 0;
  } catch { /* ignore */ }

  try {
    const raw = localStorage.getItem(TOTAL_CORRECT_KEY);
    if (raw) totalCorrectAnswers = parseInt(raw, 10) || 0;
  } catch { /* ignore */ }

  try {
    const raw = localStorage.getItem(TOTAL_SCORE_KEY);
    if (raw) totalScore = parseInt(raw, 10) || 0;
  } catch { /* ignore */ }

  return { solvedParagraphIds, failedQuestions, questionCount, bestStreak, totalCorrectAnswers, totalScore };
}

const App: React.FC = () => {
  const [status, setStatus] = useState<GameStatus>(GameStatus.IDLE);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [isOpenQuestion, setIsOpenQuestion] = useState(false);
  const [solvedParagraphIds, setSolvedParagraphIds] = useState<string[]>([]);
  const [failedQuestions, setFailedQuestions] = useState<FailedQuestion[]>([]);
  const [bestStreak, setBestStreak] = useState(0);
  const [totalCorrectAnswers, setTotalCorrectAnswers] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [showStats, setShowStats] = useState(false);

  const difficultyStats = React.useMemo(() => {
    const stats: Record<Difficulty, { solved: number; total: number }> = {
      [Difficulty.VERY_EASY]: { solved: 0, total: 0 },
      [Difficulty.EASY]: { solved: 0, total: 0 },
      [Difficulty.MEDIUM]: { solved: 0, total: 0 },
      [Difficulty.HARD]: { solved: 0, total: 0 },
    };

    paragraphs.forEach((p) => {
      stats[p.difficulty].total += 1;
      if (solvedParagraphIds.includes(p.id)) {
        stats[p.difficulty].solved += 1;
      }
    });

    return stats;
  }, [solvedParagraphIds]);

  // uiBlocked=true until VK Bridge initialises and cloud data is loaded
  const [uiBlocked, setUiBlocked] = useState(true);

// Initialize VK Bridge, load cloud data (with localStorage fallback), then unblock UI
  useEffect(() => {
    const initialize = async () => {
      let loadedData = loadFromLocalStorage();

      const vkReady = await initVKBridge();

      if (vkReady) {
        try {
          const stored = await storageGet([
            STORAGE_KEY,
            FAILED_STORAGE_KEY,
            QUESTION_COUNT_KEY,
            BEST_STREAK_KEY,
            TOTAL_CORRECT_KEY,
            TOTAL_SCORE_KEY,
          ]);

          const hasCloudData = Object.values(stored).some((v) => v !== '');

          if (hasCloudData) {
            try {
              const cloudSolved = stored[STORAGE_KEY] ? JSON.parse(stored[STORAGE_KEY]) : undefined;
              const cloudFailed = stored[FAILED_STORAGE_KEY] ? JSON.parse(stored[FAILED_STORAGE_KEY]) : undefined;
              const cloudCount = stored[QUESTION_COUNT_KEY] ? parseInt(stored[QUESTION_COUNT_KEY], 10) : undefined;
              const cloudBestStreak = stored[BEST_STREAK_KEY] ? parseInt(stored[BEST_STREAK_KEY], 10) : undefined;
              const cloudTotalCorrect = stored[TOTAL_CORRECT_KEY] ? parseInt(stored[TOTAL_CORRECT_KEY], 10) : undefined;
              const cloudTotalScore = stored[TOTAL_SCORE_KEY] ? parseInt(stored[TOTAL_SCORE_KEY], 10) : undefined;

              loadedData = {
                solvedParagraphIds: Array.isArray(cloudSolved)
                  ? (cloudSolved as unknown[]).filter(
                      (i): i is string => typeof i === 'string'
                    )
                  : loadedData.solvedParagraphIds,
                failedQuestions: Array.isArray(cloudFailed)
                  ? (cloudFailed as unknown[]).filter(
                      (i): i is FailedQuestion =>
                        typeof i === 'object' &&
                        i !== null &&
                        typeof (i as FailedQuestion).paragraphId === 'string' &&
                        typeof (i as FailedQuestion).failedAt === 'number'
                    )
                  : loadedData.failedQuestions,
                questionCount: typeof cloudCount === 'number' && !isNaN(cloudCount)
                  ? cloudCount
                  : loadedData.questionCount,
                bestStreak: typeof cloudBestStreak === 'number' && !isNaN(cloudBestStreak)
                  ? cloudBestStreak
                  : loadedData.bestStreak,
                totalCorrectAnswers: typeof cloudTotalCorrect === 'number' && !isNaN(cloudTotalCorrect)
                  ? cloudTotalCorrect
                  : loadedData.totalCorrectAnswers,
                totalScore: typeof cloudTotalScore === 'number' && !isNaN(cloudTotalScore)
                  ? cloudTotalScore
                  : loadedData.totalScore,
              };
            } catch (e) {
              console.error('Failed to parse VK cloud data:', e);
            }
          }
        } catch (e) {
          console.error('Failed to load VK storage:', e);
        }
      }

      setSolvedParagraphIds(loadedData.solvedParagraphIds);
      setFailedQuestions(loadedData.failedQuestions);
      setQuestionCount(loadedData.questionCount);
      setBestStreak(loadedData.bestStreak);
      setTotalCorrectAnswers(loadedData.totalCorrectAnswers);
      setTotalScore(loadedData.totalScore);
      setUiBlocked(false);
    };

    initialize().catch((e) => {
      console.error('SDK initialization error:', e);
      const loadedData = loadFromLocalStorage();
      setSolvedParagraphIds(loadedData.solvedParagraphIds);
      setFailedQuestions(loadedData.failedQuestions);
      setQuestionCount(loadedData.questionCount);
      setBestStreak(loadedData.bestStreak);
      setTotalCorrectAnswers(loadedData.totalCorrectAnswers);
      setTotalScore(loadedData.totalScore);
      setUiBlocked(false);
    });
  }, []);

  // Persist to localStorage AND VK cloud storage simultaneously
  const persistData = useCallback((updates: {
    solvedParagraphIds?: string[];
    failedQuestions?: FailedQuestion[];
    questionCount?: number;
    bestStreak?: number;
    totalCorrectAnswers?: number;
    totalScore?: number;
  }) => {
    if (updates.solvedParagraphIds !== undefined) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updates.solvedParagraphIds));
      if (isVKBridgeReady()) {
        storageSet(STORAGE_KEY, JSON.stringify(updates.solvedParagraphIds));
      }
    }
    if (updates.failedQuestions !== undefined) {
      localStorage.setItem(FAILED_STORAGE_KEY, JSON.stringify(updates.failedQuestions));
      if (isVKBridgeReady()) {
        storageSet(FAILED_STORAGE_KEY, JSON.stringify(updates.failedQuestions));
      }
    }
    if (updates.questionCount !== undefined) {
      localStorage.setItem(QUESTION_COUNT_KEY, String(updates.questionCount));
      if (isVKBridgeReady()) {
        storageSet(QUESTION_COUNT_KEY, String(updates.questionCount));
      }
    }
    if (updates.bestStreak !== undefined) {
      localStorage.setItem(BEST_STREAK_KEY, String(updates.bestStreak));
      if (isVKBridgeReady()) {
        storageSet(BEST_STREAK_KEY, String(updates.bestStreak));
      }
    }
    if (updates.totalCorrectAnswers !== undefined) {
      localStorage.setItem(TOTAL_CORRECT_KEY, String(updates.totalCorrectAnswers));
      if (isVKBridgeReady()) {
        storageSet(TOTAL_CORRECT_KEY, String(updates.totalCorrectAnswers));
      }
    }
    if (updates.totalScore !== undefined) {
      localStorage.setItem(TOTAL_SCORE_KEY, String(updates.totalScore));
      if (isVKBridgeReady()) {
        storageSet(TOTAL_SCORE_KEY, String(updates.totalScore));
      }
    }
  }, []);

  const startNewRound = useCallback(async (
    overrideSolved?: string[],
    overrideFailed?: FailedQuestion[]
  ) => {
    const effectiveSolved = overrideSolved ?? solvedParagraphIds;
    const effectiveFailed = overrideFailed ?? failedQuestions;
    setStatus(GameStatus.LOADING);
    setSelectedBook(null);
    setError(null);
    try {
      const question = await fetchBookQuestion(effectiveSolved, effectiveFailed);
      if (!question) {
        setCurrentQuestion(null);
        setStatus(GameStatus.COMPLETED);
        return;
      }
      const nextCount = questionCount + 1;
      setQuestionCount(nextCount);
      persistData({ questionCount: nextCount });
      setIsOpenQuestion(
        question.difficulty === Difficulty.VERY_EASY ||
        question.difficulty === Difficulty.EASY
      );
      setCurrentQuestion(question);
      setStatus(GameStatus.PLAYING);
    } catch (err) {
      console.error(err);
      setError("Не удалось связаться с литературными архивами. Пожалуйста, попробуйте снова.");
      setStatus(GameStatus.IDLE);
    }
  }, [solvedParagraphIds, failedQuestions, questionCount, persistData]);

  const handleEnterLibrary = useCallback(() => {
    startNewRound();
  }, [startNewRound]);

  // Called when user clicks "Новая игра" — resets all progress and starts fresh
  const handleNewGame = useCallback(() => {
    setSolvedParagraphIds([]);
    setFailedQuestions([]);
    setQuestionCount(0);
    setBestStreak(0);
    setTotalCorrectAnswers(0);
    setTotalScore(0);
    persistData({
      solvedParagraphIds: [], failedQuestions: [], questionCount: 0,
      bestStreak: 0, totalCorrectAnswers: 0, totalScore: 0,
    });
    setScore(0);
    setStreak(0);
    setSelectedBook(null);
    setCurrentQuestion(null);
    setIsOpenQuestion(false);
    startNewRound([], []);
  }, [persistData, startNewRound]);

  const handleNextRound = useCallback(async () => {
    await showInterstitialAd();
    startNewRound();
  }, [startNewRound]);

  const handleSelect = (book: Book) => {
    if (status !== GameStatus.PLAYING || !currentQuestion) return;

    setSelectedBook(book);
    const isCorrect = book.id === currentQuestion.correctBook.id;

    if (isCorrect) {
      const basePoints = 100 + (streak * 25);
      const points = isOpenQuestion ? basePoints * 3 : basePoints;
      const newStreak = streak + 1;
      const newTotalScore = totalScore + points;
      const newTotalCorrect = totalCorrectAnswers + 1;
      const newBestStreak = Math.max(bestStreak, newStreak);

      setScore(prev => prev + points);
      setStreak(newStreak);
      setTotalScore(newTotalScore);
      setTotalCorrectAnswers(newTotalCorrect);
      setBestStreak(newBestStreak);

      persistData({
        totalScore: newTotalScore,
        totalCorrectAnswers: newTotalCorrect,
        ...(newBestStreak > bestStreak ? { bestStreak: newBestStreak } : {}),
      });

      setSolvedParagraphIds((prev) => {
        if (prev.includes(currentQuestion.paragraphId)) return prev;
        const next = [...prev, currentQuestion.paragraphId];
        persistData({ solvedParagraphIds: next });
        return next;
      });
      // Remove from failed list if it was there
      setFailedQuestions((prev) => {
        const filtered = prev.filter((f) => f.paragraphId !== currentQuestion.paragraphId);
        if (filtered.length !== prev.length) {
          persistData({ failedQuestions: filtered });
        }
        return filtered;
      });
    } else {
      setStreak(0);
      // Add or update in failed list with a new timestamp
      setFailedQuestions((prev) => {
        const now = Date.now();
        const existing = prev.find((f) => f.paragraphId === currentQuestion.paragraphId);
        let next: FailedQuestion[];
        if (existing) {
          next = prev.map((f) =>
            f.paragraphId === currentQuestion.paragraphId
              ? { ...f, failedAt: now }
              : f
          );
        } else {
          next = [...prev, { paragraphId: currentQuestion.paragraphId, failedAt: now }];
        }
        persistData({ failedQuestions: next });
        return next;
      });
    }

    setStatus(GameStatus.RESULT);
  };

  const resetProgress = useCallback(() => {
    setSolvedParagraphIds([]);
    setFailedQuestions([]);
    setQuestionCount(0);
    setBestStreak(0);
    setTotalCorrectAnswers(0);
    setTotalScore(0);
    persistData({
      solvedParagraphIds: [], failedQuestions: [], questionCount: 0,
      bestStreak: 0, totalCorrectAnswers: 0, totalScore: 0,
    });
    setIsOpenQuestion(false);
    setScore(0);
    setStreak(0);
    setSelectedBook(null);
    setCurrentQuestion(null);
    setStatus(GameStatus.IDLE);
  }, [persistData]);

  const handleBackToMenu = useCallback(() => {
    setStatus(GameStatus.IDLE);
  }, []);

  const isSelected = (book: Book) => selectedBook?.id === book.id;
  const isCorrect = (book: Book) => currentQuestion?.correctBook.id === book.id;

  return (
    <Layout>
      {/* Interaction blocker overlay — active while SDK is initialising */}
      {uiBlocked && (
        <div
          className="fixed inset-0 z-[9999]"
          style={{ pointerEvents: 'all', cursor: 'wait' }}
        />
      )}

      {status === GameStatus.IDLE && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-stone-100 text-center max-w-xl mx-auto">
          <div className="w-20 h-20 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6 shadow-inner">
            <i className="fa-solid fa-book-open"></i>
          </div>
          <h2 className="text-2xl font-bold text-stone-800 mb-4 serif">Добро пожаловать, Библиофил</h2>
          <p className="text-stone-600 mb-6 leading-relaxed">
            Я представлю вам один абзац из известного литературного произведения.
            Ваша задача — узнать книгу из 20 предложенных вариантов.
            Точность важна, а серии правильных ответов приносят бонусные очки.
          </p>

          {questionCount > 0 && (
            <div className="mb-6 p-4 bg-amber-50 rounded-2xl border border-amber-100 text-left">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-3">
                Ваш прогресс
              </p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xl font-bold text-stone-800">{totalScore.toLocaleString('ru-RU')}</div>
                  <div className="text-xs text-stone-500 mt-0.5">Счёт</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-stone-800">{solvedParagraphIds.length}</div>
                  <div className="text-xs text-stone-500 mt-0.5">Открыто книг</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-stone-800">{bestStreak}</div>
                  <div className="text-xs text-stone-500 mt-0.5">Лучшая серия</div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button
              onClick={handleEnterLibrary}
              className="w-full bg-amber-700 hover:bg-amber-800 text-white font-bold py-4 px-8 rounded-2xl transition-all shadow-lg hover:shadow-xl active:scale-95"
            >
              <i className="fa-solid fa-book-open mr-2"></i>
              Войти в библиотеку
            </button>
            <button
              onClick={handleNewGame}
              className="w-full bg-stone-800 hover:bg-stone-900 text-white font-bold py-4 px-8 rounded-2xl transition-all shadow-lg hover:shadow-xl active:scale-95"
            >
              <i className="fa-solid fa-rotate-right mr-2"></i>
              Новая игра
            </button>
            <button
              onClick={() => setShowStats(true)}
              className="w-full bg-white hover:bg-stone-50 text-stone-700 font-bold py-4 px-8 rounded-2xl transition-all shadow-sm border border-stone-200 hover:shadow-md active:scale-95"
            >
              <i className="fa-solid fa-chart-bar mr-2"></i>
              Статистика
            </button>
          </div>

          {error && <p className="mt-4 text-red-500 text-sm font-medium">{error}</p>}
        </div>
      )}

      {status === GameStatus.COMPLETED && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-stone-100 text-center max-w-xl mx-auto">
          <div className="w-20 h-20 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6 shadow-inner">
            <i className="fa-solid fa-crown"></i>
          </div>
          <h2 className="text-2xl font-bold text-stone-800 mb-4 serif">Поздравляем!</h2>
          <p className="text-stone-600 mb-8 leading-relaxed">
            Вы ответили правильно на все сложные отрывки. Вопросы закончились.
            Вы открыли {solvedParagraphIds.length} / {paragraphs.length} произведений.
          </p>
          <button
            onClick={resetProgress}
            className="w-full bg-stone-800 hover:bg-stone-900 text-white font-bold py-4 px-8 rounded-2xl transition-all shadow-lg hover:shadow-xl active:scale-95"
          >
            Играть заново
          </button>
        </div>
      )}

      {status === GameStatus.LOADING && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative w-24 h-24 mb-6">
             <div className="absolute inset-0 border-4 border-stone-200 rounded-full"></div>
             <div className="absolute inset-0 border-4 border-amber-700 rounded-full border-t-transparent animate-spin"></div>
             <div className="absolute inset-0 flex items-center justify-center text-amber-700 text-2xl">
               <i className="fa-solid fa-feather-pointed"></i>
             </div>
          </div>
          <p className="text-stone-500 font-medium animate-pulse">Советуемся с классиками...</p>
        </div>
      )}

      {(status === GameStatus.PLAYING || status === GameStatus.RESULT) && currentQuestion && (
        <div className="space-y-6">
          <div className={`flex justify-between items-center px-6 py-3 rounded-2xl shadow-sm border ${isOpenQuestion ? 'bg-amber-50 border-amber-200' : 'bg-white border-stone-100'}`}>
            <div className="flex items-center gap-4">
              <button
                onClick={handleBackToMenu}
                className="text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-2 group"
                title="В главное меню"
              >
                <i className="fa-solid fa-house text-sm group-hover:scale-110 transition-transform"></i>
              </button>
              <div className="h-4 w-px bg-stone-200"></div>
              <div className="flex items-center gap-2">
                <span className="text-stone-400 font-bold uppercase tracking-widest text-xs">Счет</span>
                <span className="text-xl font-bold text-stone-800">{score}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2 py-1 bg-stone-100 rounded-full">
                <i className="fa-solid fa-hashtag text-stone-400 text-xs"></i>
                <span className="text-stone-600 font-bold text-xs">{questionCount}</span>
              </div>
              {questionCount >= 3 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-stone-100 rounded-full">
                  <i className="fa-solid fa-bullseye text-stone-400 text-xs"></i>
                  <span className="text-stone-600 font-bold text-xs">
                    {Math.round((totalCorrectAnswers / questionCount) * 100)}%
                  </span>
                </div>
              )}
              {isOpenQuestion && (
                <div className="flex items-center gap-2 px-3 py-1 bg-amber-200 rounded-full border border-amber-300">
                  <i className="fa-solid fa-star text-amber-700 text-xs"></i>
                  <span className="text-amber-900 font-bold text-xs">x3 ОЧКОВ</span>
                </div>
              )}
              {streak > 0 && (
                <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 rounded-full border border-amber-100">
                  <i className="fa-solid fa-fire text-amber-600 text-xs"></i>
                  <span className="text-amber-800 font-bold text-xs">СЕРИЯ: {streak}</span>
                </div>
              )}
            </div>
          </div>

          <div className={`p-8 sm:p-12 rounded-3xl shadow-lg relative overflow-hidden group ${isOpenQuestion ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200' : 'bg-white border border-stone-100'}`}>
            <div className="absolute top-4 left-4 flex flex-wrap gap-2 z-20">
              {isOpenQuestion && (
                <div className="flex items-center gap-2 px-3 py-1 bg-amber-500 text-white rounded-full text-xs font-bold shadow-md">
                  <i className="fa-solid fa-lightbulb"></i>
                  <span>ОТКРЫТЫЙ ВОПРОС</span>
                </div>
              )}
              <div className={`flex items-center gap-2 px-3 py-1 ${DIFFICULTY_COLORS[currentQuestion.difficulty]} text-white rounded-full text-xs font-bold shadow-md`}>
                <i className="fa-solid fa-layer-group"></i>
                <span>{DIFFICULTY_LABELS[currentQuestion.difficulty]}</span>
              </div>
            </div>
            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none transition-transform group-hover:scale-110 duration-700">
              <i className={`fa-solid ${isOpenQuestion ? 'fa-brain' : 'fa-quote-right'} text-9xl`}></i>
            </div>
            <p className={`serif text-xl sm:text-2xl text-stone-800 leading-relaxed relative z-10 first-letter:text-5xl first-letter:font-bold first-letter:mr-3 first-letter:float-left italic ${isOpenQuestion ? 'first-letter:text-amber-600 mt-8' : 'first-letter:text-amber-800'}`}>
              {currentQuestion.paragraph}
            </p>
          </div>

          {isOpenQuestion ? (
            <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-amber-200">
              <p className="text-stone-600 mb-4 text-sm font-medium">
                <i className="fa-solid fa-keyboard mr-2 text-amber-600"></i>
                Введите название книги или имя автора для поиска:
              </p>
              <BookAutocomplete
                onSelect={handleSelect}
                disabled={status === GameStatus.RESULT}
                selectedBook={selectedBook}
                correctBook={currentQuestion.correctBook}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {currentQuestion.options.map((book, idx) => (
                <BookOption
                  key={`${book.id}-${idx}`}
                  book={book}
                  onClick={() => handleSelect(book)}
                  disabled={status === GameStatus.RESULT}
                  isSelected={isSelected(book)}
                  isCorrect={isCorrect(book)}
                />
              ))}
            </div>
          )}

          {status === GameStatus.RESULT && (
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-stone-200 flex flex-col items-center animate-slide-up z-50">
               <div className="max-w-4xl w-full flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {selectedBook?.id === currentQuestion.correctBook.id ? (
                      <div className="flex items-center gap-3 text-green-700">
                         <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <i className="fa-solid fa-check"></i>
                         </div>
                         <div className="flex flex-col">
                            <span className="font-bold">Великолепно!</span>
                            <span className="text-sm opacity-80">Вы отлично знаете эту главу.</span>
                         </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 text-red-700">
                         <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                            <i className="fa-solid fa-xmark"></i>
                         </div>
                         <div className="flex flex-col">
                            <span className="font-bold">Не совсем так.</span>
                            <span className="text-sm opacity-80">Это было произведение <span className="font-bold italic">«{currentQuestion.correctBook.title}»</span></span>
                         </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleNextRound}
                    className="w-full sm:w-auto bg-stone-800 hover:bg-stone-900 text-white font-bold py-3 px-12 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95"
                  >
                    Следующий отрывок
                  </button>
               </div>
            </div>
          )}
        </div>
      )}

      {showStats && (
        <StatsModal
          onClose={() => setShowStats(false)}
          totalScore={totalScore}
          questionCount={questionCount}
          totalCorrectAnswers={totalCorrectAnswers}
          bestStreak={bestStreak}
          solvedParagraphIdsCount={solvedParagraphIds.length}
          totalParagraphsCount={paragraphs.length}
          failedQuestionsCount={failedQuestions.length}
          difficultyStats={difficultyStats}
        />
      )}
    </Layout>
  );
};

export default App;
