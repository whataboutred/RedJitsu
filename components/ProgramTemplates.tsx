'use client'
import { useState } from 'react'
import { Dumbbell, Flame, Zap, Trophy, FileText, Info, ArrowRight, type LucideIcon } from 'lucide-react'

type ProgramTemplate = {
  id: string
  name: string
  description: string
  duration: string
  level: 'Beginner' | 'Intermediate' | 'Advanced'
  focus: string[]
  icon: LucideIcon
  days: Array<{
    name: string
    dows: number[]
    exercises: Array<{
      name: string
      sets: number
      reps: number | string
      category: string
    }>
  }>
}

const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    id: 'upper-lower',
    name: 'Upper/Lower Split',
    description: 'Classic 4-day split focusing on upper and lower body',
    duration: '4 days/week',
    level: 'Intermediate',
    focus: ['Strength', 'Muscle Building'],
    icon: Dumbbell,
    days: [
      {
        name: 'Upper A',
        dows: [1, 4], // Mon, Thu
        exercises: [
          { name: 'Bench Press', sets: 4, reps: '6-8', category: 'barbell' },
          { name: 'Bent Over Row', sets: 4, reps: '6-8', category: 'barbell' },
          { name: 'Overhead Press', sets: 3, reps: '8-10', category: 'barbell' },
          { name: 'Lat Pulldown', sets: 3, reps: '8-10', category: 'cable' },
          { name: 'Dips', sets: 3, reps: '10-12', category: 'other' },
          { name: 'Barbell Curls', sets: 3, reps: '10-12', category: 'barbell' }
        ]
      },
      {
        name: 'Lower A', 
        dows: [2, 5], // Tue, Fri
        exercises: [
          { name: 'Squat', sets: 4, reps: '6-8', category: 'barbell' },
          { name: 'Romanian Deadlift', sets: 4, reps: '8-10', category: 'barbell' },
          { name: 'Leg Press', sets: 3, reps: '12-15', category: 'machine' },
          { name: 'Leg Curls', sets: 3, reps: '12-15', category: 'machine' },
          { name: 'Calf Raises', sets: 4, reps: '15-20', category: 'machine' },
          { name: 'Plank', sets: 3, reps: '30-60s', category: 'other' }
        ]
      }
    ]
  },
  {
    id: 'push-pull-legs',
    name: 'Push/Pull/Legs',
    description: 'Popular 6-day split by movement patterns',
    duration: '6 days/week',
    level: 'Advanced', 
    focus: ['Muscle Building', 'Volume'],
    icon: Flame,
    days: [
      {
        name: 'Push',
        dows: [1, 4], // Mon, Thu
        exercises: [
          { name: 'Bench Press', sets: 4, reps: '6-8', category: 'barbell' },
          { name: 'Overhead Press', sets: 4, reps: '8-10', category: 'barbell' },
          { name: 'Incline Dumbbell Press', sets: 3, reps: '10-12', category: 'dumbbell' },
          { name: 'Dips', sets: 3, reps: '10-12', category: 'other' },
          { name: 'Lateral Raises', sets: 4, reps: '12-15', category: 'dumbbell' },
          { name: 'Tricep Extensions', sets: 3, reps: '12-15', category: 'cable' }
        ]
      },
      {
        name: 'Pull',
        dows: [2, 5], // Tue, Fri  
        exercises: [
          { name: 'Deadlift', sets: 4, reps: '5-6', category: 'barbell' },
          { name: 'Pull-ups', sets: 4, reps: '8-10', category: 'other' },
          { name: 'Bent Over Row', sets: 4, reps: '8-10', category: 'barbell' },
          { name: 'Lat Pulldown', sets: 3, reps: '10-12', category: 'cable' },
          { name: 'Face Pulls', sets: 3, reps: '15-20', category: 'cable' },
          { name: 'Barbell Curls', sets: 3, reps: '10-12', category: 'barbell' }
        ]
      },
      {
        name: 'Legs',
        dows: [3, 6], // Wed, Sat
        exercises: [
          { name: 'Squat', sets: 4, reps: '6-8', category: 'barbell' },
          { name: 'Romanian Deadlift', sets: 4, reps: '8-10', category: 'barbell' },
          { name: 'Bulgarian Split Squats', sets: 3, reps: '10-12', category: 'dumbbell' },
          { name: 'Leg Curls', sets: 3, reps: '12-15', category: 'machine' },
          { name: 'Leg Extensions', sets: 3, reps: '12-15', category: 'machine' },
          { name: 'Calf Raises', sets: 4, reps: '15-20', category: 'machine' }
        ]
      }
    ]
  },
  {
    id: 'full-body',
    name: 'Full Body',
    description: 'Efficient 3-day routine hitting all muscle groups',
    duration: '3 days/week',
    level: 'Beginner',
    focus: ['Strength', 'General Fitness'],
    icon: Zap,
    days: [
      {
        name: 'Full Body A',
        dows: [1, 3, 5], // Mon, Wed, Fri
        exercises: [
          { name: 'Squat', sets: 3, reps: '8-10', category: 'barbell' },
          { name: 'Bench Press', sets: 3, reps: '8-10', category: 'barbell' },
          { name: 'Bent Over Row', sets: 3, reps: '8-10', category: 'barbell' },
          { name: 'Overhead Press', sets: 3, reps: '10-12', category: 'barbell' },
          { name: 'Romanian Deadlift', sets: 3, reps: '10-12', category: 'barbell' },
          { name: 'Plank', sets: 3, reps: '30-45s', category: 'other' }
        ]
      }
    ]
  },
  {
    id: 'powerlifting',
    name: 'Powerlifting Focus',
    description: 'Strength-focused program for big 3 lifts',
    duration: '4 days/week', 
    level: 'Advanced',
    focus: ['Powerlifting', 'Max Strength'],
    icon: Trophy,
    days: [
      {
        name: 'Squat Focus',
        dows: [1], // Mon
        exercises: [
          { name: 'Squat', sets: 5, reps: '3-5', category: 'barbell' },
          { name: 'Front Squat', sets: 4, reps: '6-8', category: 'barbell' },
          { name: 'Romanian Deadlift', sets: 3, reps: '8-10', category: 'barbell' },
          { name: 'Leg Press', sets: 3, reps: '12-15', category: 'machine' },
          { name: 'Abs Wheel', sets: 3, reps: '10-15', category: 'other' }
        ]
      },
      {
        name: 'Bench Focus',
        dows: [2], // Tue
        exercises: [
          { name: 'Bench Press', sets: 5, reps: '3-5', category: 'barbell' },
          { name: 'Close Grip Bench', sets: 4, reps: '6-8', category: 'barbell' },
          { name: 'Bent Over Row', sets: 4, reps: '6-8', category: 'barbell' },
          { name: 'Dips', sets: 3, reps: '8-12', category: 'other' },
          { name: 'Face Pulls', sets: 3, reps: '15-20', category: 'cable' }
        ]
      },
      {
        name: 'Deadlift Focus',
        dows: [4], // Thu
        exercises: [
          { name: 'Deadlift', sets: 5, reps: '3-5', category: 'barbell' },
          { name: 'Deficit Deadlift', sets: 4, reps: '6-8', category: 'barbell' },
          { name: 'Bent Over Row', sets: 4, reps: '8-10', category: 'barbell' },
          { name: 'Good Mornings', sets: 3, reps: '10-12', category: 'barbell' },
          { name: 'Plank', sets: 3, reps: '45-60s', category: 'other' }
        ]
      },
      {
        name: 'Accessory',
        dows: [5], // Fri
        exercises: [
          { name: 'Overhead Press', sets: 4, reps: '6-8', category: 'barbell' },
          { name: 'Incline Dumbbell Press', sets: 3, reps: '10-12', category: 'dumbbell' },
          { name: 'Pull-ups', sets: 4, reps: '8-12', category: 'other' },
          { name: 'Barbell Curls', sets: 3, reps: '10-12', category: 'barbell' },
          { name: 'Tricep Extensions', sets: 3, reps: '10-12', category: 'cable' }
        ]
      }
    ]
  }
]

const LEVEL_COLORS = {
  'Beginner': 'bg-green-500/20 text-green-400 border-green-500/30',
  'Intermediate': 'bg-orange-500/20 text-orange-400 border-orange-500/30', 
  'Advanced': 'bg-red-500/20 text-red-400 border-red-500/30'
} as const

type ProgramTemplatesProps = {
  onSelectTemplate: (template: ProgramTemplate) => void
}

export default function ProgramTemplates({ onSelectTemplate }: ProgramTemplatesProps) {
  const [selectedLevel, setSelectedLevel] = useState<'All' | 'Beginner' | 'Intermediate' | 'Advanced'>('All')
  
  const filteredTemplates = PROGRAM_TEMPLATES.filter(template => 
    selectedLevel === 'All' || template.level === selectedLevel
  )

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-brand-red" />
          <span className="font-display uppercase text-lg text-white">Program Templates</span>
        </div>
        
        {/* Level Filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(['All', 'Beginner', 'Intermediate', 'Advanced'] as const).map(level => (
            <button
              key={level}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                selectedLevel === level 
                  ? 'bg-brand-red/20 border-brand-red text-white border' 
                  : 'bg-black/30 border border-white/10 text-white/70 hover:bg-black/50 hover:border-white/20'
              }`}
              onClick={() => setSelectedLevel(level)}
            >
              {level}
            </button>
          ))}
        </div>

        {/* Template Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTemplates.map(template => {
            const Icon = template.icon
            return (
            <button
              key={template.id}
              className="group text-left bg-black/30 hover:bg-black/40 rounded-2xl p-5 border border-white/10 hover:border-brand-red/30 transition-all duration-300"
              onClick={() => onSelectTemplate(template)}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-brand-red/15 flex items-center justify-center group-hover:bg-brand-red/25 transition-colors flex-shrink-0">
                  <Icon className="w-6 h-6 text-brand-red" />
                </div>
                <div>
                  <div className="font-semibold text-white/90 text-lg">{template.name}</div>
                  <div className="text-sm text-brand-red/80 font-medium">{template.duration}</div>
                </div>
              </div>

              <div className="text-sm text-white/80 mb-4 leading-relaxed">{template.description}</div>

              <div className="flex items-center flex-wrap gap-2 mb-4">
                <span className={`px-2 py-1 rounded-full text-xs border font-medium ${LEVEL_COLORS[template.level]}`}>
                  {template.level}
                </span>
                <div className="flex gap-1 flex-wrap">
                  {template.focus.map(focus => (
                    <span key={focus} className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full text-xs font-medium">
                      {focus}
                    </span>
                  ))}
                </div>
              </div>

              <div className="text-xs text-white/60 flex items-center justify-between">
                <span>
                  {template.days.length} training day{template.days.length !== 1 ? 's' : ''} • 
                  {template.days.reduce((acc, day) => acc + day.exercises.length, 0)} exercises
                </span>
                <span className="text-brand-red/70 group-hover:text-brand-red transition-colors inline-flex items-center gap-1">
                  Select <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
            )
          })}
        </div>

        <div className="text-xs text-white/60 mt-6 text-center bg-black/20 rounded-xl p-3 flex items-center justify-center gap-1.5">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          Templates include pre-configured exercises, sets, reps, and weekly schedules
        </div>
      </div>
    </div>
  )
}