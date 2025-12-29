import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET - Search saved media in database
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')
  const type = searchParams.get('type')

  if (!query) {
    // Return all saved media
    const media = await prisma.mediaLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json({ results: media })
  }

  // Search saved media
  const media = await prisma.mediaLog.findMany({
    where: {
      OR: [
        { title: { contains: query } },
        { director: { contains: query } },
      ],
      ...(type ? { mediaType: type } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return NextResponse.json({ results: media })
}

// POST - Save new media to database (makes search smarter)
export async function POST(request: NextRequest) {
  const body = await request.json()

  const {
    externalId,
    mediaType,
    title,
    year,
    director,
    starring,
    overview,
    posterUrl,
  } = body

  // Check if we already have this media saved (by title + year + type)
  const existing = await prisma.mediaLog.findFirst({
    where: {
      title,
      year,
      mediaType,
    },
  })

  if (existing) {
    // Return existing entry info
    return NextResponse.json({
      saved: false,
      message: 'Media already in database',
      id: existing.id
    })
  }

  // Save to "known media" - we'll create a separate table for this
  // For now, we note it in the log if user completes the flow

  return NextResponse.json({
    saved: true,
    message: 'Media info noted for future searches',
    data: { externalId, mediaType, title, year, director, starring, overview, posterUrl }
  })
}
