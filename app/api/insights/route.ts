import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { buildAnalyticsDigest } from '@/lib/analyticsDigest'

const SYSTEM_PROMPT = `You are a strength & conditioning coach analyzing a trainee's workout data from the last 90 days. Give specific, actionable insights based on their actual numbers.

Structure your response with these sections using markdown headers:

## What's Going Well
Genuine praise for positive trends. Reference specific exercises and numbers.

## Areas to Improve
Specific callouts with actionable suggestions. Be honest but encouraging.

## Key Observation
One interesting pattern you notice in their data (training frequency, exercise selection, volume trends, etc.)

## This Week's Focus
One concrete thing to prioritize this week based on what the data shows.

Rules:
- Be concise — keep the total response under 250 words
- Reference actual exercise names, weights, and percentages from the data
- If data is sparse, acknowledge it and focus on what you can see
- Don't give generic fitness advice — only insights derived from their specific data
- Be encouraging but honest. Don't sugarcoat real issues.
- Use their actual numbers (weights, sessions, percentages) in your response`

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI insights not configured. Add ANTHROPIC_API_KEY to environment variables.' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const { accessToken } = body

    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Verify the user from the access token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Check for cached insight (less than 24 hours old)
    const { data: cached } = await supabase
      .from('ai_insights')
      .select('content, created_at')
      .eq('user_id', user.id)
      .eq('insight_type', 'full')
      .single()

    if (cached && !body.forceRefresh) {
      const cacheAge = Date.now() - new Date(cached.created_at).getTime()
      const twentyFourHours = 24 * 60 * 60 * 1000
      if (cacheAge < twentyFourHours) {
        return NextResponse.json({
          content: cached.content,
          cached: true,
          generatedAt: cached.created_at,
        })
      }
    }

    // Build the analytics digest
    const digest = await buildAnalyticsDigest(user.id, accessToken)

    // Check if there's enough data to analyze
    const totalActivity = digest.strength.totalWorkouts + digest.bjj.totalSessions + digest.cardio.totalSessions
    if (totalActivity === 0) {
      return NextResponse.json({
        content: "Not enough data yet! Log a few workouts, BJJ sessions, or cardio activities and come back for personalized insights.",
        cached: false,
        generatedAt: new Date().toISOString(),
      })
    }

    // Call Claude Haiku
    const anthropic = new Anthropic({ apiKey })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Here is my training data from the last 90 days:\n\n${JSON.stringify(digest, null, 2)}`,
        },
      ],
    })

    const content = message.content[0].type === 'text' ? message.content[0].text : ''

    // Cache the result (upsert)
    await supabase
      .from('ai_insights')
      .upsert(
        {
          user_id: user.id,
          insight_type: 'full',
          content,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,insight_type' }
      )

    return NextResponse.json({
      content,
      cached: false,
      generatedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Insights API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate insights' },
      { status: 500 }
    )
  }
}
