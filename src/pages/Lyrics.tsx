import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Loader } from '../components/Loader'
import { usePlaybackContext } from '../context/PlaybackContext/PlaybackContext'
import './Lyrics.css'
import { LyricLine } from '@jellyfin/sdk/lib/generated-client'

type LyricLineCue = { Position: number; EndPosition: number; Start: number; End: number }
type LyricLineData = LyricLine & { Cues?: LyricLineCue[] }

export const Lyrics = () => {
    const playback = usePlaybackContext()
    const audio = playback.audioRef as HTMLAudioElement | undefined

    const [currentTimeMs, setCurrentTimeMs] = useState<number | null>(null)
    const lineRefs = useRef<Array<HTMLDivElement | null>>([])

    const location = useLocation()

    const tickToTimeString = (raw: number) => {
        const ms = raw / 10000

        const totalCs = Math.round(ms / 10)

        const cs = totalCs % 100
        const totalSeconds = Math.floor(totalCs / 100)
        const seconds = totalSeconds % 60
        const totalMinutes = Math.floor(totalSeconds / 60)
        const minutes = totalMinutes % 60
        const hours = Math.floor(totalMinutes / 60)

        const hh = hours.toString().padStart(2, '0')
        const mm = minutes.toString().padStart(2, '0')
        const ss = seconds.toString().padStart(2, '0')
        const cc = cs.toString().padStart(2, '0')

        return (hours > 0 ? `${hh}:` : '') + `${mm}:${ss}.${cc}`
    }

    const timeDiff = (startTicks: number | null, timeMs: number | null) => {
        return (startTicks || 0) / 10000 - (timeMs || 0)
    }

    const lyrics = playback.currentTrackLyrics?.Lyrics as unknown as LyricLineData[] | undefined

    // Builds a list of relevant times to update currentTime
    const eventTimesMs = useMemo(() => {
        const rawTimes: number[] = []

        lyrics?.forEach(line => {
            if (typeof line.Start === 'number') rawTimes.push(line.Start / 10000)

            line.Cues?.forEach(cue => {
                if (typeof cue.Start === 'number') rawTimes.push(cue.Start / 10000)
                if (typeof cue.End === 'number') rawTimes.push(cue.End / 10000)
            })
        })

        // Deduplicate Times and sort
        return Array.from(new Set(rawTimes).values()).sort()
    }, [lyrics])

    const nextEventTimeMs = useMemo(() => {
        return eventTimesMs.find(t => t > (currentTimeMs || 0))
    }, [currentTimeMs, eventTimesMs])

    const isSynced = useMemo(() => {
        if (!lyrics || lyrics[0].Start === null || lyrics[0].Start === undefined) return false
        return true
    }, [lyrics])

    const isWordByWord = useMemo(() => {
        if (!lyrics || lyrics[0].Cues === null || lyrics[0].Cues?.length === 0) return false
        return true
    }, [lyrics])

    const currentLineIndex = useMemo(() => {
        if (!audio || !lyrics) return -1

        const index = lyrics.findIndex(line => timeDiff(line?.Start || 0, currentTimeMs) > 0)

        return lyrics ? (index >= 0 ? index - 1 : lyrics.length - 1) : -1
    }, [audio, lyrics, currentTimeMs])

    // Uses timeout for precise lyrics timing
    //  - Necessary because audio time updates happen every 200ms or so; too slow
    const nextLineTimeout: RefObject<NodeJS.Timeout | null> = useRef(null)
    const clearNextLineTimeout = () => {
        if (nextLineTimeout.current) {
            clearTimeout(nextLineTimeout.current)
            nextLineTimeout.current = null
        }
    }

    useEffect(() => {
        if (nextEventTimeMs === undefined || currentTimeMs === null) return

        const millis = nextEventTimeMs - currentTimeMs + 1

        if (millis > 0) {
            // Sets timeout to diff from next line and last currentTime update
            nextLineTimeout.current = setTimeout(() => {
                if (currentTimeMs && playback.isPlaying) setCurrentTimeMs(nextEventTimeMs + 1)
                clearNextLineTimeout()
            }, millis)
        }

        return clearNextLineTimeout
    }, [playback.isPlaying, currentTimeMs, currentLineIndex, nextEventTimeMs])

    useEffect(() => {
        clearNextLineTimeout()
    }, [audio, lyrics])

    useEffect(() => {
        if (!audio || !lyrics) return

        const updateCurrentTime = () => {
            if (!audio.duration) {
                setCurrentTimeMs(null)
                return
            }

            setCurrentTimeMs(audio?.currentTime * 1000 || 0)
        }

        audio.addEventListener('timeupdate', updateCurrentTime)
        audio.addEventListener('playing', updateCurrentTime)

        return () => {
            audio.removeEventListener('timeupdate', updateCurrentTime)
            audio.removeEventListener('playing', updateCurrentTime)
        }
    }, [audio, lyrics, currentLineIndex])

    const scrollToActiveLine = useCallback(
        (line: number, behavior: ScrollBehavior = 'smooth') => {
            if (!lyrics || line < 0) return

            const activeEl = lineRefs.current[line]
            if (!activeEl) return

            const rect = activeEl.getBoundingClientRect()
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop

            const headerHeight = document.querySelector<HTMLDivElement>('.main_header')?.offsetHeight || 0
            const footerHeight = document.querySelector<HTMLDivElement>('.main_footer')?.offsetHeight || 0
            const usableHeight = window.innerHeight - headerHeight - footerHeight

            const targetY = scrollTop + rect.top - (usableHeight / 2 - rect.height / 2) - headerHeight

            window.scrollTo({ top: targetY, behavior })
        },
        [lineRefs, lyrics]
    )

    const goToLine = useCallback(
        (index: number) => {
            const audio = playback.audioRef as HTMLAudioElement | undefined

            if (audio && lyrics && lyrics[index]?.Start) {
                setCurrentTimeMs(lyrics[index].Start / 10000)
                audio.currentTime = lyrics[index].Start / 10000000
                if (isSynced) scrollToActiveLine(index)
            }
        },
        [isSynced, lyrics, playback.audioRef, scrollToActiveLine]
    )

    const displayedLyricsLine = useCallback(
        (line: LyricLineData) => {
            if (!isWordByWord) return line.Text

            const cues = line.Cues ?? []
            if (cues.length === 0) return line.Text

            return cues.map((cue, i) => (
                <span
                    key={`cue-${line.Start}-${i}`}
                    className={'lyric-word' + (currentTimeMs && cue.Start / 10000 <= currentTimeMs ? ' active' : '')}
                    data-start={cue.Start ?? undefined}
                    data-end={cue.End ?? undefined}
                >
                    {line.Text?.slice(cue.Position, cue.EndPosition)}
                    {i < cues.length - 1 ? ' ' : ''}
                </span>
            ))
        },
        [isWordByWord, currentTimeMs]
    )

    const displayedLines = useMemo(() => {
        if (!lyrics) lineRefs.current = []

        return (
            lyrics?.map((line, index) => (
                <div
                    key={`lyrics-${playback.currentTrack?.Id}-${index}`}
                    className={'lyrics-line' + (currentLineIndex === index ? ' active' : '')}
                    ref={el => {
                        lineRefs.current[index] = el
                    }}
                    onClick={() => goToLine(index)}
                >
                    {isSynced && playback.lyricsTimestamps ? (
                        <div className="numbers">
                            {line.Start !== null && line.Start !== undefined && tickToTimeString(line.Start)}
                        </div>
                    ) : null}
                    <div className={'text' + (playback.centeredLyrics ? ' centered' : '')}>
                        {displayedLyricsLine(line)}
                    </div>
                </div>
            )) || null
        )
    }, [
        playback.currentTrack,
        goToLine,
        displayedLyricsLine,
        playback.lyricsTimestamps,
        playback.centeredLyrics,
        lyrics,
        currentLineIndex,
        isSynced,
    ])

    // Scroll on line change
    useEffect(() => {
        if (isSynced) scrollToActiveLine(currentLineIndex)
    }, [playback.currentTrack, lyrics, currentLineIndex, scrollToActiveLine, isSynced])

    // Scroll to top when audio source changes (new track)
    useEffect(() => {
        if (audio?.src) {
            window.scrollTo({ top: 0, behavior: 'auto' })
        }
    }, [audio?.src, location.pathname])

    return (
        <div className={'lyrics-page' + (lyrics ? ' active' : '') + (isSynced ? ' synced noSelect' : '')}>
            {(lyrics && displayedLines) || (
                <div className="empty">
                    {playback.currentTrackLyricsLoading ? <Loader /> : 'No lyrics found for this track'}
                </div>
            )}
        </div>
    )
}
