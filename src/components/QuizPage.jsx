import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuestionAnswers } from '../hooks/useUserData';
import { useAuth } from '../contexts/AuthContext';
import { useQuizManager, QUIZ_STATUS } from './QuizManager';
import { awardPoints, handleHighScore } from '../lib/userPoints';
import PointsAnimation from './PointsAnimation';

const QuizPage = ({ questions, onBack, isResuming = false, initialQuizData = null }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [quizData, setQuizData] = useState(null);
  const [flaggedQuestions, setFlaggedQuestions] = useState(new Set());
  const [showQuestionNavigation, setShowQuestionNavigation] = useState(false);
  const [isStopwatchHidden, setIsStopwatchHidden] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState(Date.now());
  const [showReviewPage, setShowReviewPage] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [quizInitialized, setQuizInitialized] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pointsAnimation, setPointsAnimation] = useState({ show: false, points: 0, action: '' });
  const [eliminationMode, setEliminationMode] = useState(false);
  const [eliminatedOptions, setEliminatedOptions] = useState({});

  // Use refs to capture current values for cleanup function
  const quizDataRef = useRef(null);
  const userAnswersRef = useRef({});
  const currentQuestionIndexRef = useRef(0);
  const flaggedQuestionsRef = useRef(new Set());
  const elapsedTimeRef = useRef(0);
  const showResultsRef = useRef(false);
  const isFinishingRef = useRef(false);
  const hasUnsavedChangesRef = useRef(false);
  const eliminationModeRef = useRef(false);
  const eliminatedOptionsRef = useRef({});

  // Update refs when state changes
  useEffect(() => {
    quizDataRef.current = quizData;
  }, [quizData]);

  useEffect(() => {
    userAnswersRef.current = userAnswers;
  }, [userAnswers]);

  useEffect(() => {
    currentQuestionIndexRef.current = currentQuestionIndex;
  }, [currentQuestionIndex]);

  useEffect(() => {
    flaggedQuestionsRef.current = flaggedQuestions;
  }, [flaggedQuestions]);

  useEffect(() => {
    elapsedTimeRef.current = elapsedTime;
  }, [elapsedTime]);

  useEffect(() => {
    showResultsRef.current = showResults;
  }, [showResults]);

  useEffect(() => {
    isFinishingRef.current = isFinishing;
  }, [isFinishing]);

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    eliminationModeRef.current = eliminationMode;
  }, [eliminationMode]);

  useEffect(() => {
    eliminatedOptionsRef.current = eliminatedOptions;
  }, [eliminatedOptions]);

  // Get user for display name and points
  const { user } = useAuth();

  // Use new QuizManager
  const { quizManager, allQuizzesLoading } = useQuizManager();
  const { data: questionAnswers, upsertData: upsertQuestionAnswers } = useQuestionAnswers();

  // Award points and show animation
  const awardPointsAndAnimate = async (actionType, additionalData = {}) => {
    if (!user?.id) return;
    
    try {
      const result = await awardPoints(user.id, actionType, additionalData);
      if (result.success && result.pointsAwarded !== 0) {
        setPointsAnimation({
          show: true,
          points: result.pointsAwarded,
          action: actionType
        });
      }
    } catch (error) {
      console.error('Error awarding points:', error);
    }
  };

  // Handle points animation completion
  const handlePointsAnimationComplete = () => {
    setPointsAnimation({ show: false, points: 0, action: '' });
  };

  // Get user display name
  const getUserDisplayName = () => {
    if (!user) return 'User';
    
    // Try to get name from user metadata first
    if (user.user_metadata?.name) {
      return user.user_metadata.name;
    }
    
    // Fall back to email prefix
    if (user.email) {
      const emailPrefix = user.email.split('@')[0];
      // Capitalize first letter and replace dots/underscores with spaces
      return emailPrefix
        .replace(/[._]/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
    
    return 'User';
  };

  // Initialize start time – paused quizzes resume from stored timeSpent only
  useEffect(() => {
    if (isResuming && initialQuizData) {
      const previouslySpent = initialQuizData.timeSpent || 0; // seconds already spent before leaving
      const now = Date.now();
      // Treat the quiz as "paused" while user was away: start counting from now
      setStartTime(now - previouslySpent * 1000);
      setElapsedTime(previouslySpent);
    } else {
      // Fresh quiz starts now
      const now = Date.now();
      setStartTime(now);
      setElapsedTime(0);
    }
  }, [isResuming, initialQuizData]);

  /* ---------------------------------------------
      🔄  Persist timer – fixes reset on tab switch
  ----------------------------------------------*/
  // Load persisted startTime on mount if same quizId
  useEffect(() => {
    if (!quizData) return;

    const key = `satlog:quiz:${quizData.id}:startTime`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const storedStart = parseInt(stored, 10);
      if (!isNaN(storedStart)) {
        setStartTime(storedStart);
        const now = Date.now();
        setElapsedTime(Math.floor((now - storedStart)/1000));
      }
    }
  }, [quizData]);

  // Save startTime whenever it is set
  useEffect(() => {
    if (quizData && startTime) {
      localStorage.setItem(`satlog:quiz:${quizData.id}:startTime`, String(startTime));
    }
  }, [quizData, startTime]);

  // Timer effect - pause when showing results or component unmounts
  useEffect(() => {
    if (showResults) {
      return; // Don't run timer when showing results
    }
    
    const timer = setInterval(() => {
      const now = Date.now();
      const calculatedElapsed = Math.floor((now - startTime) / 1000);
      setElapsedTime(calculatedElapsed);
      // Keep quizData.timeSpent updated for persistence/resume accuracy
      setQuizData(prev => prev ? { ...prev, timeSpent: calculatedElapsed } : prev);
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime, showResults]);

  // Only save when user navigates away (component unmounts)
  useEffect(() => {
    return () => {
      // This cleanup function runs when component unmounts
      // Use refs to capture current values without dependencies
      const currentQuizData = quizDataRef.current;
      const currentUserAnswers = userAnswersRef.current;
      const currentQuestionIdx = currentQuestionIndexRef.current;
      const currentFlaggedQuestions = flaggedQuestionsRef.current;
      const currentElapsedTime = elapsedTimeRef.current;
      const currentShowResults = showResultsRef.current;
      const currentIsFinishing = isFinishingRef.current;
      const isAlreadyCompleted = currentQuizData?.status === QUIZ_STATUS.COMPLETED;
      
      // Save if we have quiz data and user has made any progress (answered questions or spent time)
      const hasProgress = currentQuizData && 
        currentQuizData.questions && 
        !currentShowResults && 
        !currentIsFinishing && 
        !isAlreadyCompleted && 
        (Object.keys(currentUserAnswers).length > 0 || currentElapsedTime > 0);
      
      if (hasProgress) {
        console.log('🚪 Saving quiz progress on exit...', {
          quizId: currentQuizData.id,
          answeredCount: Object.keys(currentUserAnswers).length,
          timeSpent: currentElapsedTime
        });
        
        const updatedQuizData = {
          ...currentQuizData,
          userAnswers: currentUserAnswers,
          currentQuestionIndex: currentQuestionIdx,
          flaggedQuestions: Array.from(currentFlaggedQuestions),
          eliminationMode: eliminationModeRef.current,
          eliminatedOptions: eliminatedOptionsRef.current,
          lastUpdated: new Date().toISOString(),
          timeSpent: currentElapsedTime
        };
        
        // Save immediately when unmounting
        quizManager.saveQuiz(updatedQuizData).catch(error => {
          console.error('Error saving progress on exit:', error);
        });

        // Remove persisted startTime so elapsed clock doesn't keep growing while away
        if (currentQuizData?.id) {
          localStorage.removeItem(`satlog:quiz:${currentQuizData.id}:startTime`);
        }
      }
    };
  }, []); // Empty dependency array to prevent re-runs

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper function to normalize question format
  const normalizeQuestion = (question) => {
    // Handle legacy questions that only have questionText (no separate passage)
    if (!question.passageText && question.questionText) {
      // For legacy questions, treat questionText as passage if it's long
      if (question.questionText.length > 200) {
        return {
          ...question,
          passageText: question.questionText,
          questionText: 'Which choice completes the text with the most logical and precise word or phrase?',
          options: question.options || Object.values(question.answerChoices || {}),
          correctAnswer: question.answerChoices ? question.answerChoices[question.correctAnswer] : question.correctAnswer
        };
      }
    }
    
    // Convert answerChoices format to options format if needed
    if (question.answerChoices && !question.options) {
      return {
        ...question,
        options: Object.values(question.answerChoices),
        correctAnswer: question.answerChoices[question.correctAnswer] || question.correctAnswer
      };
    }
    return question;
  };

  // Reset quizInitialized when starting a new quiz session
  useEffect(() => {
    // Reset initialization state when questions change or resuming state changes
    setQuizInitialized(false);
    setHasUnsavedChanges(false); // Reset unsaved changes state
  }, [questions, isResuming, initialQuizData]);

  // Initialize quiz data
  useEffect(() => {
    // Only run if not initialized
    if (quizInitialized) {
      return;
    }

    // If resuming, we can proceed even if loading (we have the data)
    if (isResuming && initialQuizData) {
      console.log('🔄 Resuming existing quiz:', {
        quizId: initialQuizData.id,
        quizNumber: initialQuizData.quizNumber
      });
      // Resume existing quiz
      setQuizData(initialQuizData);
      setUserAnswers(initialQuizData.userAnswers || {});
      setCurrentQuestionIndex(initialQuizData.currentQuestionIndex || 0);
      setFlaggedQuestions(new Set(initialQuizData.flaggedQuestions || []));
      setEliminationMode(initialQuizData.eliminationMode || false);
      setEliminatedOptions(initialQuizData.eliminatedOptions || {});
      setQuizInitialized(true);
      return;
    }

    // For new quizzes, wait for loading to complete and quizManager to be available
    if (allQuizzesLoading || !quizManager) {
      console.log('⏳ Waiting for data to load or QuizManager to be available...', {
        allQuizzesLoading,
        quizManagerAvailable: !!quizManager
      });
      return;
    }

    if (!questions || questions.length === 0) {
      console.error('❌ No questions provided to QuizPage');
      onBack();
      return;
    }

    // Additional safety check: don't initialize if we're finishing or showing results
    if (isFinishing || showResults) {
      return;
    }

    console.log('🆕 Starting new quiz');
    // Start new quiz - normalize all questions
    const normalizedQuestions = questions.map(normalizeQuestion);

    // Use QuizManager to create new quiz with proper numbering
    const newQuizData = quizManager.createNewQuiz(normalizedQuestions);
    
    console.log('📦 New quiz data created:', {
      quizId: newQuizData.id,
      quizNumber: newQuizData.quizNumber,
      questionsCount: newQuizData.questions.length,
      startTime: newQuizData.startTime
    });
    
    setQuizData(newQuizData);
    setQuizInitialized(true); // Mark as initialized
  }, [
    questions,
    isResuming,
    initialQuizData,
    quizInitialized,
    isFinishing,
    showResults,
    onBack,
    allQuizzesLoading,
    quizManager // Add quizManager to dependencies
  ]);

  // Track unsaved changes - only when user makes changes from the current state
  useEffect(() => {
    if (quizData && Object.keys(userAnswers).length > 0) {
      // Only set as unsaved if we're not just resuming with existing answers
      // or if the user has made changes beyond what was already saved
      const originalAnswers = quizData.userAnswers || {};
      const hasNewChanges = Object.keys(userAnswers).some(key => 
        userAnswers[key] !== originalAnswers[key]
      );
      
      if (hasNewChanges) {
        setHasUnsavedChanges(true);
      }
    }
  }, [userAnswers, quizData]);

  const currentQuestion = quizData?.questions?.[currentQuestionIndex];

  const handleAnswerSelect = (answer) => {
    if (!currentQuestion) return;

    const isCorrect = answer === currentQuestion.correctAnswer;
    
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: answer
    }));

    setQuizData(prev => ({
      ...prev,
      questions: prev.questions.map((q, index) => 
        index === currentQuestionIndex 
          ? { ...q, userAnswer: answer, isCorrect }
          : q
      )
    }));
  };

  const handleFlagQuestion = () => {
    if (!currentQuestion) return;
    
    setFlaggedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(currentQuestion.id)) {
        newSet.delete(currentQuestion.id);
      } else {
        newSet.add(currentQuestion.id);
      }
      return newSet;
    });
  };

  const toggleEliminationMode = () => {
    setEliminationMode(prev => !prev);
  };

  const handleEliminateOption = (option) => {
    if (!currentQuestion) return;
    
    const questionId = currentQuestion.id;
    const currentEliminated = eliminatedOptions[questionId] || [];
    
    setEliminatedOptions(prev => ({
      ...prev,
      [questionId]: currentEliminated.includes(option)
        ? currentEliminated.filter(o => o !== option)
        : [...currentEliminated, option]
    }));
  };

  const navigateToQuestion = (index) => {
    setCurrentQuestionIndex(index);
    setShowQuestionNavigation(false);
  };

  const handleFinishQuiz = async () => {
    console.log('🔴 handleFinishQuiz called!');
    console.log('🔍 Checking quizData:', !!quizData);
    console.log('🔍 Checking quizData.questions:', !!quizData?.questions);
    console.log('🔍 Checking isFinishing:', isFinishing);
    
    if (!quizData || !quizData.questions || isFinishing) {
      console.log('❌ Early return - missing data or already finishing');
      return;
    }
    
    console.log('✅ Passed initial checks, proceeding with quiz completion...');
    
    console.log('🏁 ========== FINISH QUIZ START ==========');
    console.log('📊 Quiz data before finishing:', {
      quizId: quizData.id,
      quizNumber: quizData.quizNumber,
      questionsCount: quizData.questions.length,
      answeredCount: Object.keys(userAnswers).length
    });
    
    setIsFinishing(true);
    try {
      // 1. Sync all answers from userAnswers to quizData.questions and recalculate isCorrect
      const syncedQuestions = quizData.questions.map(q => {
        const userAnswer = userAnswers[q.id] ?? q.userAnswer;
        // Try to convert userAnswer to letter if possible
        let userAnswerLetter = userAnswer;
        if (q.answerChoices && userAnswer && !['A', 'B', 'C', 'D'].includes(userAnswer)) {
          for (const [letter, text] of Object.entries(q.answerChoices)) {
            if (text === userAnswer) {
              userAnswerLetter = letter;
              break;
            }
          }
        }
        const correctLetter = q.answerChoices && q.correctAnswer && !['A', 'B', 'C', 'D'].includes(q.correctAnswer)
          ? Object.entries(q.answerChoices).find(([letter, text]) => text === q.correctAnswer)?.[0] || q.correctAnswer
          : q.correctAnswer;
        const isCorrect = userAnswerLetter === correctLetter;
        return {
          ...q,
          userAnswer: userAnswerLetter,
          isCorrect
        };
      });

      // 2. Use QuizManager to finish the quiz
      console.log('⏱️ Finishing quiz with elapsed time:', elapsedTime);
      console.log('📝 QuizManager available:', !!quizManager);
      
      if (!quizManager) {
        throw new Error('QuizManager not available');
      }
      
      const completedQuiz = await quizManager.finishQuiz(quizData, syncedQuestions, userAnswers, flaggedQuestions, elapsedTime);
      
      console.log('✅ Quiz completed successfully:', {
        quizId: completedQuiz.id,
        quizNumber: completedQuiz.quizNumber,
        score: completedQuiz.score,
        status: completedQuiz.status
      });

      // 3. Award points for completing the quiz
      await awardPointsAndAnimate('COMPLETE_QUIZ', { score: completedQuiz.score });
      
      // 4. Award bonus points for high score if applicable
      if (completedQuiz.score >= 90) {
        // Increment the local high score counter
        handleHighScore();
        
        // Small delay to show the completion animation first
        setTimeout(() => {
          awardPointsAndAnimate('HIGH_SCORE_BONUS', { score: completedQuiz.score });
        }, 1000);
      }

      // 5. Update question answers for analytics
      const currentAnswers = questionAnswers || {};
      const updatedAnswers = { ...currentAnswers };
      syncedQuestions.forEach(question => {
        if (question.userAnswer) {
          if (!updatedAnswers[question.id]) {
            updatedAnswers[question.id] = [];
          }
          
          // Remove existing answer for this quiz
          updatedAnswers[question.id] = updatedAnswers[question.id].filter(
            answer => answer.quizId !== completedQuiz.id
          );
          
          // Add new answer
          updatedAnswers[question.id].push({
            quizId: completedQuiz.id,
            answer: question.userAnswer,
            isCorrect: question.isCorrect,
            date: completedQuiz.date
          });
        }
      });
      
      await upsertQuestionAnswers(updatedAnswers);
      
      console.log('🏁 ========== FINISH QUIZ COMPLETED SUCCESSFULLY ==========');
      
      // Clear any stored resume data
      localStorage.removeItem('satlog:resumeQuizId');
      
      // Log the final quiz state for debugging
      console.log('📊 Final completed quiz state:', {
        id: completedQuiz.id,
        quizNumber: completedQuiz.quizNumber,
        status: completedQuiz.status,
        score: completedQuiz.score,
        totalQuestions: completedQuiz.totalQuestions,
        correctAnswers: completedQuiz.correctAnswers
      });
      
      // Update local state & refs so unmount cleanup sees the COMPLETED status
      setQuizData(completedQuiz);
      quizDataRef.current = completedQuiz;
      
      // Navigate back to selector with a small delay to ensure all data is saved
      setTimeout(() => {
        console.log('🔄 Navigating back to selector...');
        onBack();
      }, 500);
      
    } catch (error) {
      console.error('❌ ========== FINISH QUIZ FAILED ==========');
      console.error('Error details:', error);
      console.error('Error stack:', error.stack);
      
      // Show user-friendly error message
      alert('There was an error completing the quiz. Please try again.');
      
      // Still navigate back to prevent getting stuck
      onBack();
    } finally {
      setIsFinishing(false);
    }
  };

  const getProgressSegmentColor = (index) => {
    if (index < currentQuestionIndex) {
      return 'blue'; // Completed
    } else if (index === currentQuestionIndex) {
      return 'yellow'; // Current
    } else {
      return 'gray'; // Not reached
    }
  };

  // Handle browser close/refresh
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      const currentQuizData = quizDataRef.current;
      const currentUserAnswers = userAnswersRef.current;
      const currentElapsedTime = elapsedTimeRef.current;
      const currentShowResults = showResultsRef.current;
      const currentIsFinishing = isFinishingRef.current;
      
      // Save if we have quiz data and user has made any progress
      const hasProgress = currentQuizData && 
        currentQuizData.questions && 
        !currentShowResults && 
        !currentIsFinishing && 
        (Object.keys(currentUserAnswers).length > 0 || currentElapsedTime > 0);
      
      if (hasProgress) {
        console.log('🌐 Browser closing - saving quiz progress...');
        
        const updatedQuizData = {
          ...currentQuizData,
          userAnswers: currentUserAnswers,
          currentQuestionIndex: currentQuestionIndexRef.current,
          flaggedQuestions: Array.from(flaggedQuestionsRef.current),
          eliminationMode: eliminationModeRef.current,
          eliminatedOptions: eliminatedOptionsRef.current,
          lastUpdated: new Date().toISOString(),
          timeSpent: currentElapsedTime
        };
        
        // Use synchronous storage or send a beacon request
        // For now, we'll just log it since we can't do async operations in beforeunload
        console.log('📦 Quiz data to save:', updatedQuizData);
        
        // Show a warning to the user
        event.preventDefault();
        event.returnValue = 'You have unsaved quiz progress. Are you sure you want to leave?';
        return event.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  if (!quizData || !quizData.questions || !currentQuestion) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading quiz...</div>
      </div>
    );
  }

  if (showResults) {
    return (
      <div className="flex items-center justify-center p-4 h-screen">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Almost Done!</h2>
            <p className="text-gray-600">Here's how you performed</p>
        </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="text-center p-6 bg-blue-50 rounded-lg">
              <div className="text-4xl font-bold text-blue-600 mb-2">{quizData.score}%</div>
              <div className="text-gray-600 font-medium">Overall Score</div>
            </div>
            <div className="text-center p-6 bg-green-50 rounded-lg">
              <div className="text-4xl font-bold text-green-600 mb-2">
                {quizData.correctAnswers}
              </div>
              <div className="text-gray-600 font-medium">Correct Answers</div>
            </div>
            <div className="text-center p-6 bg-red-50 rounded-lg">
              <div className="text-4xl font-bold text-red-600 mb-2">
                {quizData.totalQuestions - quizData.correctAnswers}
              </div>
              <div className="text-gray-600 font-medium">Incorrect Answers</div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Quiz Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Questions:</span>
                <span className="font-medium ml-2">{quizData.totalQuestions}</span>
              </div>
              <div>
                <span className="text-gray-600">Time Spent:</span>
                <span className="font-medium ml-2">{formatTime(elapsedTime)}</span>
              </div>
              <div>
                <span className="text-gray-600">Flagged for Review:</span>
                <span className="font-medium ml-2">{flaggedQuestions.size}</span>
              </div>
              <div>
                <span className="text-gray-600">Completion:</span>
                <span className="font-medium ml-2">
                  {Math.round((quizData.totalQuestions - quizData.correctAnswers) / quizData.totalQuestions * 100)}%
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-center space-x-4">
            <button
              onClick={() => {
                setShowResults(false);
                setShowReviewPage(true);
              }}
              className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              Back to Review
            </button>
            <button
              onClick={handleFinishQuiz}
              disabled={isFinishing}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                isFinishing 
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isFinishing ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Finishing...</span>
                </div>
              ) : (
                'Finish Quiz'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Review Page
  if (showReviewPage) {
    return (
      <div className="bg-gray-100 dark:bg-gray-900 flex flex-col h-screen overflow-hidden transition-colors duration-300">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 sm:p-4 flex-shrink-0 relative transition-colors duration-300">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
            {/* Left side - Quiz info */}
            <div className="flex items-center sm:flex-1">
              <div>
                <h1 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white transition-colors duration-300">Quiz {quizData?.quizNumber ?? 'N/A'}</h1>
                <button className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center transition-colors duration-300">
                  Directions <span className="material-icons text-sm">arrow_drop_down</span>
                </button>
              </div>
            </div>
            
            {/* Center - Timer (on mobile, shows at top-right, on desktop in center) */}
            <div className="absolute top-3 right-3 sm:relative sm:top-auto sm:right-auto sm:flex-1 sm:flex sm:justify-center text-center">
              <div>
                <div className={`text-lg sm:text-2xl font-bold text-gray-900 dark:text-white transition-opacity duration-300 ${isStopwatchHidden ? 'opacity-0' : 'opacity-100'}`}>
                  {formatTime(elapsedTime)}
                </div>
                <button
                  onClick={() => setIsStopwatchHidden(!isStopwatchHidden)}
                  className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-300"
                >
                  {isStopwatchHidden ? 'Show' : 'Hide'}
                </button>
              </div>
            </div>
            
            {/* Right side - Tools (hidden on mobile) */}
            <div className="hidden sm:flex items-center space-x-4 sm:flex-1 sm:justify-end">
              <button className="text-sm text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white flex items-center transition-colors duration-300">
                <span className="material-icons mr-1">edit</span> Annotate
              </button>
              <button className="text-sm text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white flex items-center transition-colors duration-300">
                <span className="material-icons mr-1">more_vert</span> More
              </button>
            </div>
          </div>
        </header>

        {/* Review Content */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-800 transition-colors duration-300">
          {/* Check Your Work Section */}
          <div className="text-center py-4 sm:py-6 px-3 sm:px-0">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white mb-2 transition-colors duration-300">Check Your Work</h2>
            <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm mb-1 transition-colors duration-300">
              On test day, you won't be able to move on to the next module until time expires.
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm mb-4 sm:mb-6 transition-colors duration-300">
              For these practice questions, you can click <strong>Next</strong> when you're ready to move on.
            </p>
            
            {/* Separation Line */}
            <div className="w-full border-t border-gray-300 dark:border-gray-600 mb-4 sm:mb-6 transition-colors duration-300"></div>
          </div>

          {/* Question Grid Section */}
          <div className="flex-1 flex justify-center px-3 sm:px-6 lg:px-8 pb-4 sm:pb-6 lg:pb-8">
            <div className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg p-3 sm:p-6 lg:p-8 w-full max-w-5xl transition-colors duration-300">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-3">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white transition-colors duration-300">Section 1: Reading and Writing Module 1</h3>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                <div className="flex items-center text-xs sm:text-sm text-gray-700 dark:text-gray-300 transition-colors duration-300">
                  <span className="w-3 h-3 border-2 border-dashed border-gray-400 dark:border-gray-500 mr-2 transition-colors duration-300"></span>
                  <span>Unanswered</span>
                </div>
                <div className="flex items-center text-xs sm:text-sm text-gray-700 dark:text-gray-300 transition-colors duration-300">
                  <span className="material-icons text-base mr-1 text-red-500">bookmark</span>
                  <span>For Review</span>
                </div>
                {eliminationMode && (
                  <div className="flex items-center text-xs sm:text-sm text-gray-700 dark:text-gray-300 transition-colors duration-300">
                    <span className="material-icons text-base mr-1 text-red-500">close</span>
                    <span>Eliminated</span>
                  </div>
                )}
              </div>
              </div>

              {/* Progress Bar */}
              <div className="flex w-full mb-4 sm:mb-6">
                {quizData.questions.map((_, index) => (
                  <div 
                    key={index}
                    className={`h-2 flex-1 ${
                      index < currentQuestionIndex 
                        ? 'bg-blue-500' 
                        : index === currentQuestionIndex 
                        ? 'bg-yellow-400' 
                        : 'bg-gray-300'
                    }`}
                  />
                ))}
                </div>
                
              {/* Question Grid - Responsive columns */}
              <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-10 gap-2 sm:gap-3 mb-4 sm:mb-6 justify-items-center">
                {quizData.questions.map((question, index) => {
                  const isAnswered = userAnswers[question.id];
                  const isCurrent = index === currentQuestionIndex;
                  const isFlagged = flaggedQuestions.has(question.id);
                  const questionEliminatedOptions = eliminatedOptions[question.id] || [];
                  const hasEliminatedOptions = questionEliminatedOptions.length > 0;
                  
                  return (
                    <div
                      key={index}
                      onClick={() => {
                        setCurrentQuestionIndex(index);
                        setShowReviewPage(false);
                      }}
                      className={`relative p-1.5 sm:p-2 text-center rounded cursor-pointer border-2 transition-all w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center ${
                        isAnswered 
                          ? 'bg-blue-500 border-blue-500 text-white' 
                          : 'border-dashed border-gray-400 dark:border-gray-500 text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                      } ${isCurrent ? 'ring-2 ring-black dark:ring-white' : ''}`}
                    >
                      <span className="font-medium text-xs sm:text-sm">
                        {index + 1}
                      </span>
                      {isCurrent && (
                        <span className="material-icons absolute -top-5 sm:-top-6 left-1/2 transform -translate-x-1/2 text-black dark:text-white text-base sm:text-lg transition-colors duration-300">
                          location_on
                        </span>
                      )}
                      {isFlagged && (
                        <span className="material-icons absolute top-0.5 sm:top-1 right-0.5 sm:right-1 text-red-500 text-xs">
                          flag
                        </span>
                      )}
                      {hasEliminatedOptions && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-gray-400 dark:bg-gray-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs">✕</span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar - Review Page */}
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 sm:p-6 flex flex-col sm:flex-row sm:justify-between sm:items-center flex-shrink-0 transition-colors duration-300 gap-4 sm:gap-0">
          <div className="text-sm text-gray-700 dark:text-gray-300 transition-colors duration-300 text-center sm:text-left">
            Ready to submit your quiz?
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
            <button
              onClick={() => setShowReviewPage(false)}
              className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-300 w-full sm:w-auto"
            >
              Back to Questions
            </button>
            <button
              onClick={handleFinishQuiz}
              disabled={isFinishing}
              className={`px-8 py-3 rounded-lg text-sm font-medium transition-colors duration-300 shadow-lg hover:shadow-xl w-full sm:w-auto ${
                isFinishing 
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isFinishing ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Finishing...</span>
                </div>
              ) : (
                'Finish Quiz'
              )}
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex w-full flex-shrink-0">
          {quizData.questions.map((_, index) => (
            <div 
              key={index}
              className={`progress-bar-segment ${getProgressSegmentColor(index)}`}
            />
          ))}
        </div>

        {/* Points Animation */}
        {pointsAnimation.show && (
          <PointsAnimation
            pointsAwarded={pointsAnimation.points}
            actionType={pointsAnimation.action}
            onComplete={handlePointsAnimationComplete}
          />
        )}
      </div>
    );
  }

  return (
    <div className="bg-gray-100 dark:bg-gray-900 transition-colors duration-300 flex flex-col h-screen overflow-hidden pb-20 sm:pb-0">
      <style>{`
        .progress-bar-segment {
          height: 6px;
          flex-grow: 1;
        }
        .progress-bar-segment.blue {
          background-color: #3b82f6;
        }
        .progress-bar-segment.yellow {
          background-color: #facc15;
        }
        .progress-bar-segment.gray {
          background-color: #e5e7eb;
        }
        .question-option {
          display: flex;
          align-items: center;
          padding: 0.75rem 1rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          margin-bottom: 0.75rem;
          cursor: pointer;
          transition: all 0.2s ease-in-out;
          color: #374151;
        }
        .dark .question-option {
          border-color: #4b5563;
          color: #d1d5db;
        }
        .question-option:hover {
          background-color: #f3f4f6;
          border-color: #9ca3af;
        }
        .dark .question-option:hover {
          background-color: #374151;
          border-color: #6b7280;
        }
        .question-option.selected {
          background-color: #dbeafe;
          border-color: #3b82f6;
        }
        .dark .question-option.selected {
          background-color: #1e3a8a;
          border-color: #3b82f6;
        }
        .question-option.selected:hover {
          background-color: #bfdbfe;
          border-color: #2563eb;
        }
        .dark .question-option.selected:hover {
          background-color: #1e40af;
          border-color: #2563eb;
        }
        
        /* Eliminated option styles */
        .question-option.eliminated {
          opacity: 0.3;
          pointer-events: none;
          background-color: #f9fafb;
          border-color: #e5e7eb;
          position: relative;
          overflow: visible !important;
        }
        .dark .question-option.eliminated {
          opacity: 0.3;
          pointer-events: none;
          background-color: #374151;
          border-color: #4b5563;
          position: relative;
          overflow: visible !important;
        }
        .question-option.eliminated::after {
          content: '';
          position: absolute;
          top: 50%;
          left: -20px !important;
          right: -10px !important;
          height: 2px;
          background-color: #374151 !important;
          transform: translateY(-50%);
          z-index: 15 !important;
          margin: 0 !important;
          opacity: 1 !important;
        }
        .dark .question-option.eliminated::after {
          background-color: #9ca3af !important;
        }
        .question-option.eliminated .option-letter {
          background-color: #9ca3af;
          color: #6b7280;
          border-color: #9ca3af;
        }
        .dark .question-option.eliminated .option-letter {
          background-color: #6b7280;
          color: #9ca3af;
          border-color: #6b7280;
        }
        .question-option.eliminated:hover {
          background-color: #f9fafb;
          border-color: #e5e7eb;
          opacity: 0.3;
        }
        .dark .question-option.eliminated:hover {
          background-color: #374151;
          border-color: #4b5563;
          opacity: 0.3;
        }
        
        /* ABC button styles */
        .btn-default.btn-line-black.undo-btn {
          position: relative;
          overflow: hidden;
        }
        .option-letter {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 1.75rem;
          height: 1.75rem;
          border-radius: 50%;
          border: 1px solid #9ca3af;
          margin-right: 0.75rem;
          font-weight: 500;
          transition: all 0.2s ease-in-out;
          color: #374151;
        }
        .dark .option-letter {
          border-color: #6b7280;
          color: #d1d5db;
        }
        .question-option.selected .option-letter {
          background-color: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }
        /* Question box base styles - no hover effects */
        .question-box {
          border: 2px solid #e5e7eb;
          cursor: pointer;
          padding: 8px;
          margin: 4px;
          border-radius: 8px;
          min-height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #f9fafb;
          color: #374151;
          font-weight: 500;
          font-size: 14px;
          position: relative;
        }
        .dark .question-box {
          border-color: #4b5563;
          background-color: #374151;
          color: #d1d5db;
        }
        
        /* DISABLE ALL HOVER/FOCUS/ACTIVE EFFECTS */
        .question-box:hover,
        .question-box:focus,
        .question-box:active,
        .question-box:focus-visible,
        .question-box:focus-within {
          border-color: #e5e7eb !important;
          background-color: #f9fafb !important;
          color: #374151 !important;
          transform: none !important;
          box-shadow: none !important;
          outline: none !important;
        }
        .dark .question-box:hover,
        .dark .question-box:focus,
        .dark .question-box:active,
        .dark .question-box:focus-visible,
        .dark .question-box:focus-within {
          border-color: #4b5563 !important;
          background-color: #374151 !important;
          color: #d1d5db !important;
        }
        
        /* Current question indicator - only the arrow, same background */
        .question-box.current {
          /* Keep same colors as unanswered */
          border-color: #e5e7eb;
          background-color: #f9fafb;
          color: #374151;
        }
        .dark .question-box.current {
          border-color: #4b5563;
          background-color: #374151;
          color: #d1d5db;
        }
        .question-box.current::before {
          content: "\\e0c8";
          font-family: 'Material Icons';
          position: absolute;
          top: -24px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 24px;
          color: #374151; /* Dark icon for light mode */
        }
        .dark .question-box.current::before {
          color: #d1d5db; /* Light icon for dark mode */
        }
        .question-box.current:hover,
        .question-box.current:focus,
        .question-box.current:active,
        .question-box.current:focus-visible {
          border-color: #e5e7eb !important;
          background-color: #f9fafb !important;
          color: #374151 !important;
        }
        .dark .question-box.current:hover,
        .dark .question-box.current:focus,
        .dark .question-box.current:active,
        .dark .question-box.current:focus-visible {
          border-color: #4b5563 !important;
          background-color: #374151 !important;
          color: #d1d5db !important;
        }
        
        /* Answered questions - blue background */
        .question-box.answered {
          background-color: #3b82f6;
          border-color: #3b82f6;
          color: white;
        }
        .dark .question-box.answered {
          background-color: #2563eb;
          border-color: #2563eb;
          color: white;
        }
        .question-box.answered span {
          color: white;
        }
        .question-box.answered:hover,
        .question-box.answered:focus,
        .question-box.answered:active,
        .question-box.answered:focus-visible {
          background-color: #3b82f6 !important;
          border-color: #3b82f6 !important;
          color: white !important;
        }
        .dark .question-box.answered:hover,
        .dark .question-box.answered:focus,
        .dark .question-box.answered:active,
        .dark .question-box.answered:focus-visible {
          background-color: #2563eb !important;
          border-color: #2563eb !important;
          color: white !important;
        }
        
        /* Flagged questions - only add the flag, no background changes */
        .question-box.flagged::after {
          content: "🚩";
          position: absolute;
          top: 2px;
          right: 2px;
          font-size: 12px;
          color: #ef4444;
        }
        
        /* Make sure flagged unanswered questions keep their base colors */
        .question-box.flagged:not(.answered):not(.current) {
          border-color: #e5e7eb;
          background-color: #f9fafb;
          color: #374151;
        }
        .dark .question-box.flagged:not(.answered):not(.current) {
          border-color: #4b5563;
          background-color: #374151;
          color: #d1d5db;
        }
        
        /* Flagged + Answered combination - Higher specificity */
        .question-box.answered.flagged {
          background-color: #3b82f6 !important;
          border-color: #3b82f6 !important;
          color: white !important;
        }
        .dark .question-box.answered.flagged {
          background-color: #2563eb !important;
          border-color: #2563eb !important;
          color: white !important;
        }
        .question-box.answered.flagged:hover,
        .question-box.answered.flagged:focus,
        .question-box.answered.flagged:active,
        .question-box.answered.flagged:focus-visible {
          background-color: #3b82f6 !important;
          border-color: #3b82f6 !important;
          color: white !important;
        }
        .dark .question-box.answered.flagged:hover,
        .dark .question-box.answered.flagged:focus,
        .dark .question-box.answered.flagged:active,
        .dark .question-box.answered.flagged:focus-visible {
          background-color: #2563eb !important;
          border-color: #2563eb !important;
          color: white !important;
        }
        
        /* Flagged + Current combination - same as current, just adds flag */
        .question-box.current.flagged {
          border-color: #e5e7eb;
          background-color: #f9fafb;
          color: #374151;
        }
        .dark .question-box.current.flagged {
          border-color: #4b5563;
          background-color: #374151;
          color: #d1d5db;
        }
        
        /* Questions with eliminated options */
        .question-box.has-eliminated {
          border-color: #9ca3af;
          background-color: #f3f4f6;
        }
        .dark .question-box.has-eliminated {
          border-color: #6b7280;
          background-color: #4b5563;
        }
        .question-box.has-eliminated:hover,
        .question-box.has-eliminated:focus,
        .question-box.has-eliminated:active,
        .question-box.has-eliminated:focus-visible {
          border-color: #9ca3af !important;
          background-color: #f3f4f6 !important;
        }
        .dark .question-box.has-eliminated:hover,
        .dark .question-box.has-eliminated:focus,
        .dark .question-box.has-eliminated:active,
        .dark .question-box.has-eliminated:focus-visible {
          border-color: #6b7280 !important;
          background-color: #4b5563 !important;
        }
      `}</style>

      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 sm:p-4 flex-shrink-0 relative transition-colors duration-300">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
          {/* Left side - Quiz info */}
          <div className="flex items-center sm:flex-1">
            <div>
              <h1 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white transition-colors duration-300">Quiz {quizData?.quizNumber ?? 'N/A'}</h1>
              <button className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center transition-colors duration-300">
                Directions <span className="material-icons text-sm">arrow_drop_down</span>
              </button>
            </div>
          </div>
          
          {/* Center - Timer (on mobile, shows at top-right, on desktop in center) */}
          <div className="absolute top-3 right-3 sm:relative sm:top-auto sm:right-auto sm:flex-1 sm:flex sm:justify-center text-center">
            <div>
              <div className={`text-lg sm:text-2xl font-bold text-gray-900 dark:text-white transition-opacity duration-300 ${isStopwatchHidden ? 'opacity-0' : 'opacity-100'}`}>
                {formatTime(elapsedTime)}
              </div>
              <button
                onClick={() => setIsStopwatchHidden(!isStopwatchHidden)}
                className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-300"
              >
                {isStopwatchHidden ? 'Show' : 'Hide'}
              </button>
            </div>
          </div>
          
          {/* Right side - Tools (hidden on mobile) */}
          <div className="hidden sm:flex items-center space-x-4 sm:flex-1 sm:justify-end">
            <button className="text-sm text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white flex items-center transition-colors duration-300">
              <span className="material-icons mr-1">edit</span> Annotate
            </button>
            <button className="text-sm text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white flex items-center transition-colors duration-300">
              <span className="material-icons mr-1">more_vert</span> More
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* Left Side - Passage */}
        <div className="w-full md:w-1/2 p-3 sm:p-4 overflow-y-auto bg-white dark:bg-gray-800 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700 transition-colors duration-300 flex flex-col">
          <div className="flex justify-between items-center mb-3 sm:mb-4 flex-shrink-0">
            <p className="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-300"> </p>
            <button className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors duration-300 hidden sm:block">
              <span className="material-icons">fullscreen</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {/* Allow both passage image and text. Always display image first if present */}
            {currentQuestion.passageImage && (
              <img
                src={currentQuestion.passageImage}
                alt="Passage"
                className="max-h-60 sm:max-h-80 rounded shadow border mb-2 mx-auto w-full object-contain"
              />
            )}
            {currentQuestion.passageText && (
              <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 transition-colors duration-300 leading-relaxed">
                {currentQuestion.passageText}
              </p>
            )}
            {!currentQuestion.passageText && !currentQuestion.passageImage && (
              <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 transition-colors duration-300 leading-relaxed">
                {currentQuestion.questionText}
              </p>
            )}
          </div>
        </div>

        {/* Right Side - Question and Options */}
        <div className="w-full md:w-1/2 p-3 sm:p-4 overflow-y-auto bg-white dark:bg-gray-800 transition-colors duration-300 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 sm:mb-4 flex-shrink-0 gap-2">
            <div className="flex items-center">
              <span className="bg-black dark:bg-gray-700 text-white text-xs sm:text-sm font-semibold px-2 py-1 rounded-sm mr-2 transition-colors duration-300">
                {currentQuestionIndex + 1}
              </span>
              <button 
                onClick={handleFlagQuestion}
                className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white flex items-center transition-colors duration-300"
              >
                <span className={`material-icons text-base sm:text-lg mr-1 ${
                  flaggedQuestions.has(currentQuestion.id) ? 'text-red-500' : ''
                }`}>
                  {flaggedQuestions.has(currentQuestion.id) ? 'bookmark' : 'bookmark_border'}
                </span>
                <span className={flaggedQuestions.has(currentQuestion.id) ? 'text-red-500' : ''}>
                  Mark for Review
                </span>
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={toggleEliminationMode}
                className="btn-default btn-line-black undo-btn text-xs sm:text-sm font-medium px-3 py-1 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center justify-center relative"
                style={{ minWidth: '38px', minHeight: '26px', height: '26px', padding: '0 10px' }}
              >
                <span style={{ position: 'relative', zIndex: 1 }}>ABC</span>
                {/* Diagonal X line overlay */}
                <svg width="100%" height="100%" viewBox="0 0 38 26" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}>
                  <line x1="2" y1="24" x2="36" y2="2" stroke="#333" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-3 sm:mb-4 transition-colors duration-300">
              {currentQuestion.passageText ? currentQuestion.questionText : 'Which choice completes the text with the most logical and precise word or phrase?'}
            </p>
            <div className="space-y-2 sm:space-y-3" style={{ overflow: 'visible' }}>
              {(currentQuestion.options || Object.values(currentQuestion.answerChoices || {})).map((option, index) => {
                const optionLetter = String.fromCharCode(65 + index); // A, B, C, D
                const isSelected = userAnswers[currentQuestion.id] === option;
                const isEliminated = eliminationMode && eliminatedOptions[currentQuestion.id]?.includes(option);
                
                return (
                  <div key={index} className="flex items-center space-x-3" style={{ overflow: 'visible' }}>
                    <div 
                      onClick={() => handleAnswerSelect(option)}
                      className={`question-option min-w-0 ${isSelected ? 'selected' : ''} ${isEliminated ? 'eliminated' : ''}`}
                      style={{ 
                        padding: '0.5rem 0.75rem',
                        width: eliminationMode ? 'calc(100% - 80px)' : '100%',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <span className="option-letter" style={{ width: '1.5rem', height: '1.5rem', marginRight: '0.5rem', flexShrink: 0 }}>{optionLetter}</span>
                      <span className="text-sm sm:text-base" style={{ flex: 1, minWidth: 0 }}>{option}</span>
                    </div>
                    
                    {eliminationMode && (
                      <button
                        onClick={() => handleEliminateOption(option)}
                        className={`elimination-btn rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all duration-200 flex-shrink-0 ${
                          isEliminated
                            ? 'bg-gray-400 border-gray-400 text-white px-2 py-1'
                            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-6 h-6'
                        }`}
                      >
                        {isEliminated ? 'undo' : optionLetter}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-3 sm:p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center flex-shrink-0 transition-colors duration-300 relative gap-3 sm:gap-0">
        <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 transition-colors duration-300 text-center sm:text-left sm:flex-1">Welcome, {getUserDisplayName()}</div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-0 sm:space-x-2 relative sm:flex-1 sm:justify-center">
          <button 
            onClick={() => setShowQuestionNavigation(!showQuestionNavigation)}
            className="bg-black dark:bg-gray-700 text-white px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors duration-300 w-full sm:w-auto"
          >
            Question {currentQuestionIndex + 1} of {quizData.questions.length}
            <span className="material-icons text-sm align-middle">arrow_drop_down</span>
          </button>
          
          {/* Question Navigation Modal - Positioned above the question button */}
          {showQuestionNavigation && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
              <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl w-[300px] sm:w-[420px] border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto transition-colors duration-300">
                <div className="flex justify-between items-center mb-4 sm:mb-6">
                  <h1 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white transition-colors duration-300">Quiz {quizData?.quizNumber ?? 'N/A'}</h1>
                  <button 
                    onClick={() => setShowQuestionNavigation(false)}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors duration-300"
                  >
                    <span className="material-icons">close</span>
                  </button>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6 pb-4 border-b border-gray-300 dark:border-gray-600 transition-colors duration-300 text-xs">
                  <div className="flex items-center text-gray-700 dark:text-gray-300 transition-colors duration-300">
                    <span className="material-icons text-base mr-2 text-blue-600">location_on</span>
                    <span>Current</span>
                  </div>
                  <div className="flex items-center text-gray-700 dark:text-gray-300 transition-colors duration-300">
                    <span className="material-icons text-base mr-2 text-gray-400">check_box_outline_blank</span>
                    <span>Unanswered</span>
                  </div>
                  <div className="flex items-center text-gray-700 dark:text-gray-300 transition-colors duration-300">
                    <span className="material-icons text-base mr-2 text-red-500">bookmark</span>
                    <span>For Review</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-1 mb-4 sm:mb-6 p-2">
                  {quizData.questions.map((question, index) => {
                    const isAnswered = userAnswers[question.id];
                    const isCurrent = index === currentQuestionIndex;
                    const isFlagged = flaggedQuestions.has(question.id);
                    
                    return (
                      <div
                        key={index}
                        onClick={() => navigateToQuestion(index)}
                        className={`question-box cursor-pointer ${
                          isCurrent ? 'current' : ''
                        } ${isAnswered ? 'answered' : ''} ${isFlagged ? 'flagged' : ''}`}
                        style={{ 
                          transition: 'none',
                          minHeight: '32px',
                          fontSize: '12px'
                        }}
                      >
                        <span className={`font-medium text-xs ${
                          isAnswered ? 'text-white dark:text-gray-800' : 
                          isCurrent ? 'text-white' : 
                          'text-gray-600 dark:text-gray-300'
                        }`}>
                          {index + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => {
                    setShowQuestionNavigation(false);
                    setShowReviewPage(true);
                  }}
                  className="w-full py-2 px-3 bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 border border-blue-600 dark:border-blue-400 rounded-full hover:bg-blue-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-150 ease-in-out text-xs sm:text-sm"
                >
                  Go to Review Page
                </button>
              </div>
            </div>
          )}
          
        </div>
        
        <div className="flex items-center space-x-2 w-full sm:w-auto sm:flex-1 sm:justify-end">
          <button
            onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
            disabled={currentQuestionIndex === 0}
            className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300 flex-1 sm:flex-initial"
          >
            Back
          </button>
          <button
            onClick={() => {
              if (currentQuestionIndex === quizData.questions.length - 1) {
                setShowReviewPage(true);
              } else {
                setCurrentQuestionIndex(currentQuestionIndex + 1);
              }
            }}
            className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium hover:bg-blue-700 transition-colors duration-300 flex-1 sm:flex-initial"
          >
            Next
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex w-full flex-shrink-0">
        {quizData.questions.map((_, index) => (
          <div 
            key={index}
            className={`progress-bar-segment ${getProgressSegmentColor(index)}`}
          />
        ))}
      </div>

      {/* Points Animation */}
      {pointsAnimation.show && (
        <PointsAnimation
          pointsAwarded={pointsAnimation.points}
          actionType={pointsAnimation.action}
          onComplete={handlePointsAnimationComplete}
        />
      )}
    </div>
  );
};

export default QuizPage; 