'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface AudioPlayerProps {
  src: string
  title?: string
  className?: string
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function AudioPlayer({ src, title, className = '' }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => { if (!isDragging) setCurrentTime(audio.currentTime) }
    const onLoadedMetadata = () => setDuration(audio.duration)
    const onEnded = () => { setIsPlaying(false); setCurrentTime(0) }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
    }
  }, [isDragging])

  const togglePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play()
      setIsPlaying(true)
    }
  }, [isPlaying])

  const seekTo = useCallback((clientX: number) => {
    const bar = progressRef.current
    const audio = audioRef.current
    if (!bar || !audio || !duration) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const newTime = ratio * duration
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }, [duration])

  const handleProgressClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    seekTo(e.clientX)
  }, [seekTo])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setIsDragging(true)
    seekTo(e.clientX)

    const onMove = (ev: PointerEvent) => seekTo(ev.clientX)
    const onUp = () => {
      setIsDragging(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [seekTo])

  return (
    <div
      className={`flex items-center gap-3 rounded-full bg-gray-100 dark:bg-gray-800/80 px-3 py-2 select-none ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground text-background shrink-0 hover:opacity-80 transition-opacity"
        aria-label={isPlaying ? 'Pause' : 'Spel av'}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isPlaying ? (
            <motion.svg
              key="pause"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.15 }}
              width="14" height="14" viewBox="0 0 14 14" fill="currentColor"
            >
              <rect x="2" y="1" width="3.5" height="12" rx="1" />
              <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
            </motion.svg>
          ) : (
            <motion.svg
              key="play"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.15 }}
              width="14" height="14" viewBox="0 0 14 14" fill="currentColor"
            >
              <path d="M3 1.5v11l9-5.5z" />
            </motion.svg>
          )}
        </AnimatePresence>
      </button>

      {/* Progress bar */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className="text-[11px] tabular-nums text-muted-foreground w-8 text-right shrink-0">
          {formatTime(currentTime)}
        </span>
        <div
          ref={progressRef}
          className="flex-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full cursor-pointer relative group"
          onClick={handleProgressClick}
          onPointerDown={handlePointerDown}
        >
          <div
            className="absolute inset-y-0 left-0 bg-foreground rounded-full transition-[width] duration-75"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
            style={{ left: `${progress}%`, transform: `translate(-50%, -50%)` }}
          />
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground w-8 shrink-0">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  )
}
