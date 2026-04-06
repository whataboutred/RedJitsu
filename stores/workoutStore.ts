import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Types
export interface WorkoutSet {
  id: string;
  weight: number;
  reps: number;
  isWarmup: boolean;
  isCompleted: boolean;
  restTimerSeconds?: number;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSet[];
  notes?: string;
  isExpanded: boolean;
  lastWorkoutData?: {
    date: string;
    sets: { weight: number; reps: number }[];
  };
}

export interface ActiveWorkout {
  id: string;
  startedAt: string;
  title: string;
  notes: string;
  location: string;
  exercises: WorkoutExercise[];
  templateId?: string;
}

export interface WorkoutSummary {
  duration: number;
  totalVolume: number;
  totalSets: number;
  totalReps: number;
  exerciseCount: number;
  prs: { exerciseName: string; weight: number; reps: number; type: string }[];
}

interface WorkoutState {
  // Active workout
  activeWorkout: ActiveWorkout | null;
  isWorkoutActive: boolean;
  restTimer: { isRunning: boolean; seconds: number; exerciseId?: string };
  workoutSummary: WorkoutSummary | null;

  // Actions
  startWorkout: (title?: string, templateId?: string) => void;
  endWorkout: () => void;
  cancelWorkout: () => void;

  // Workout metadata
  setWorkoutTitle: (title: string) => void;
  setWorkoutNotes: (notes: string) => void;
  setWorkoutLocation: (location: string) => void;

  // Exercise management
  addExercise: (exerciseId: string, exerciseName: string, lastWorkoutData?: WorkoutExercise['lastWorkoutData']) => void;
  removeExercise: (exerciseId: string) => void;
  reorderExercises: (fromIndex: number, toIndex: number) => void;
  toggleExerciseExpanded: (exerciseId: string) => void;
  setExerciseNotes: (exerciseId: string, notes: string) => void;

  // Set management
  addSet: (exerciseId: string, prefillFromLast?: boolean) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  updateSet: (exerciseId: string, setId: string, updates: Partial<WorkoutSet>) => void;
  toggleSetCompleted: (exerciseId: string, setId: string) => void;
  toggleSetWarmup: (exerciseId: string, setId: string) => void;
  copyPreviousSet: (exerciseId: string, setId: string) => void;

  // Rest timer
  startRestTimer: (seconds: number, exerciseId?: string) => void;
  stopRestTimer: () => void;
  tickRestTimer: () => void;

  // Summary
  calculateSummary: () => WorkoutSummary;
  setWorkoutSummary: (summary: WorkoutSummary | null) => void;

  // Template loading
  loadFromTemplate: (exercises: { exerciseId: string; exerciseName: string; sets: number; reps: number }[]) => void;
}

const generateId = () => crypto.randomUUID();

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      activeWorkout: null,
      isWorkoutActive: false,
      restTimer: { isRunning: false, seconds: 0 },
      workoutSummary: null,

      startWorkout: (title = '', templateId) => {
        set({
          activeWorkout: {
            id: generateId(),
            startedAt: new Date().toISOString(),
            title,
            notes: '',
            location: '',
            exercises: [],
            templateId,
          },
          isWorkoutActive: true,
          workoutSummary: null,
        });
      },

      endWorkout: () => {
        const summary = get().calculateSummary();
        set({
          workoutSummary: summary,
          isWorkoutActive: false,
          restTimer: { isRunning: false, seconds: 0 },
        });
      },

      cancelWorkout: () => {
        set({
          activeWorkout: null,
          isWorkoutActive: false,
          restTimer: { isRunning: false, seconds: 0 },
          workoutSummary: null,
        });
      },

      setWorkoutTitle: (title) => {
        set((state) => ({
          activeWorkout: state.activeWorkout
            ? { ...state.activeWorkout, title }
            : null,
        }));
      },

      setWorkoutNotes: (notes) => {
        set((state) => ({
          activeWorkout: state.activeWorkout
            ? { ...state.activeWorkout, notes }
            : null,
        }));
      },

      setWorkoutLocation: (location) => {
        set((state) => ({
          activeWorkout: state.activeWorkout
            ? { ...state.activeWorkout, location }
            : null,
        }));
      },

      addExercise: (exerciseId, exerciseName, lastWorkoutData) => {
        set((state) => {
          if (!state.activeWorkout) return state;

          const newExercise: WorkoutExercise = {
            id: generateId(),
            exerciseId,
            exerciseName,
            sets: [],
            isExpanded: true,
            lastWorkoutData,
          };

          // Auto-add first set, prefilled from last workout if available
          if (lastWorkoutData && lastWorkoutData.sets.length > 0) {
            const lastSet = lastWorkoutData.sets[0];
            newExercise.sets.push({
              id: generateId(),
              weight: lastSet.weight,
              reps: lastSet.reps,
              isWarmup: false,
              isCompleted: false,
            });
          } else {
            newExercise.sets.push({
              id: generateId(),
              weight: 0,
              reps: 0,
              isWarmup: false,
              isCompleted: false,
            });
          }

          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: [...state.activeWorkout.exercises, newExercise],
            },
          };
        });
      },

      removeExercise: (exerciseId) => {
        set((state) => {
          if (!state.activeWorkout) return state;
          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: state.activeWorkout.exercises.filter(
                (e) => e.id !== exerciseId
              ),
            },
          };
        });
      },

      reorderExercises: (fromIndex, toIndex) => {
        set((state) => {
          if (!state.activeWorkout) return state;
          const exercises = [...state.activeWorkout.exercises];
          const [removed] = exercises.splice(fromIndex, 1);
          exercises.splice(toIndex, 0, removed);
          return {
            activeWorkout: { ...state.activeWorkout, exercises },
          };
        });
      },

      toggleExerciseExpanded: (exerciseId) => {
        set((state) => {
          if (!state.activeWorkout) return state;
          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: state.activeWorkout.exercises.map((e) =>
                e.id === exerciseId ? { ...e, isExpanded: !e.isExpanded } : e
              ),
            },
          };
        });
      },

      setExerciseNotes: (exerciseId, notes) => {
        set((state) => {
          if (!state.activeWorkout) return state;
          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: state.activeWorkout.exercises.map((e) =>
                e.id === exerciseId ? { ...e, notes } : e
              ),
            },
          };
        });
      },

      addSet: (exerciseId, prefillFromLast = true) => {
        set((state) => {
          if (!state.activeWorkout) return state;

          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: state.activeWorkout.exercises.map((e) => {
                if (e.id !== exerciseId) return e;

                let newSet: WorkoutSet = {
                  id: generateId(),
                  weight: 0,
                  reps: 0,
                  isWarmup: false,
                  isCompleted: false,
                };

                // Prefill from previous set or last workout
                if (prefillFromLast) {
                  if (e.sets.length > 0) {
                    const lastSet = e.sets[e.sets.length - 1];
                    newSet.weight = lastSet.weight;
                    newSet.reps = lastSet.reps;
                  } else if (e.lastWorkoutData && e.lastWorkoutData.sets.length > 0) {
                    newSet.weight = e.lastWorkoutData.sets[0].weight;
                    newSet.reps = e.lastWorkoutData.sets[0].reps;
                  }
                }

                return { ...e, sets: [...e.sets, newSet] };
              }),
            },
          };
        });
      },

      removeSet: (exerciseId, setId) => {
        set((state) => {
          if (!state.activeWorkout) return state;
          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: state.activeWorkout.exercises.map((e) =>
                e.id === exerciseId
                  ? { ...e, sets: e.sets.filter((s) => s.id !== setId) }
                  : e
              ),
            },
          };
        });
      },

      updateSet: (exerciseId, setId, updates) => {
        // Clamp weight and reps to reasonable ranges
        const clamped = { ...updates };
        if (clamped.weight !== undefined) {
          clamped.weight = Math.min(9999, Math.max(0, clamped.weight));
        }
        if (clamped.reps !== undefined) {
          clamped.reps = Math.min(999, Math.max(0, Math.round(clamped.reps)));
        }

        set((state) => {
          if (!state.activeWorkout) return state;
          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: state.activeWorkout.exercises.map((e) =>
                e.id === exerciseId
                  ? {
                      ...e,
                      sets: e.sets.map((s) =>
                        s.id === setId ? { ...s, ...clamped } : s
                      ),
                    }
                  : e
              ),
            },
          };
        });
      },

      toggleSetCompleted: (exerciseId, setId) => {
        set((state) => {
          if (!state.activeWorkout) return state;
          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: state.activeWorkout.exercises.map((e) =>
                e.id === exerciseId
                  ? {
                      ...e,
                      sets: e.sets.map((s) =>
                        s.id === setId
                          ? { ...s, isCompleted: !s.isCompleted }
                          : s
                      ),
                    }
                  : e
              ),
            },
          };
        });
      },

      toggleSetWarmup: (exerciseId, setId) => {
        set((state) => {
          if (!state.activeWorkout) return state;
          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: state.activeWorkout.exercises.map((e) =>
                e.id === exerciseId
                  ? {
                      ...e,
                      sets: e.sets.map((s) =>
                        s.id === setId ? { ...s, isWarmup: !s.isWarmup } : s
                      ),
                    }
                  : e
              ),
            },
          };
        });
      },

      copyPreviousSet: (exerciseId, setId) => {
        set((state) => {
          if (!state.activeWorkout) return state;
          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: state.activeWorkout.exercises.map((e) => {
                if (e.id !== exerciseId) return e;

                const setIndex = e.sets.findIndex((s) => s.id === setId);
                if (setIndex <= 0) return e;

                const prevSet = e.sets[setIndex - 1];
                return {
                  ...e,
                  sets: e.sets.map((s, i) =>
                    i === setIndex
                      ? { ...s, weight: prevSet.weight, reps: prevSet.reps }
                      : s
                  ),
                };
              }),
            },
          };
        });
      },

      startRestTimer: (seconds, exerciseId) => {
        set({ restTimer: { isRunning: true, seconds, exerciseId } });
      },

      stopRestTimer: () => {
        set({ restTimer: { isRunning: false, seconds: 0, exerciseId: undefined } });
      },

      tickRestTimer: () => {
        set((state) => {
          if (!state.restTimer.isRunning) return state;
          const newSeconds = state.restTimer.seconds - 1;
          if (newSeconds <= 0) {
            return { restTimer: { isRunning: false, seconds: 0, exerciseId: undefined } };
          }
          return { restTimer: { ...state.restTimer, seconds: newSeconds } };
        });
      },

      calculateSummary: () => {
        const state = get();
        if (!state.activeWorkout) {
          return {
            duration: 0,
            totalVolume: 0,
            totalSets: 0,
            totalReps: 0,
            exerciseCount: 0,
            prs: [],
          };
        }

        const startTime = new Date(state.activeWorkout.startedAt).getTime();
        const duration = Math.floor((Date.now() - startTime) / 1000 / 60); // minutes

        let totalVolume = 0;
        let totalSets = 0;
        let totalReps = 0;

        state.activeWorkout.exercises.forEach((exercise) => {
          exercise.sets
            .filter((s) => !s.isWarmup && s.isCompleted)
            .forEach((set) => {
              totalVolume += set.weight * set.reps;
              totalSets++;
              totalReps += set.reps;
            });
        });

        return {
          duration,
          totalVolume,
          totalSets,
          totalReps,
          exerciseCount: state.activeWorkout.exercises.length,
          prs: [], // PRs would be calculated by comparing to history
        };
      },

      setWorkoutSummary: (summary) => {
        set({ workoutSummary: summary });
      },

      loadFromTemplate: (exercises) => {
        set((state) => {
          if (!state.activeWorkout) return state;

          const newExercises: WorkoutExercise[] = exercises.map((ex) => ({
            id: generateId(),
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            isExpanded: true,
            sets: Array.from({ length: ex.sets }, () => ({
              id: generateId(),
              weight: 0,
              reps: ex.reps,
              isWarmup: false,
              isCompleted: false,
            })),
          }));

          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: newExercises,
            },
          };
        });
      },
    }),
    {
      name: 'workout-storage',
      partialize: (state) => ({
        activeWorkout: state.activeWorkout,
        isWorkoutActive: state.isWorkoutActive,
      }),
    }
  )
);
