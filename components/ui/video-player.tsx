'use client'

import { useState } from 'react'

export default function Component() {
  const [error, setError] = useState(false)

  return (
    <div className="relative w-full">
      {!error ? (
        <video
          src="https://i.imgur.com/cfiUflt.webm"
          autoPlay
          loop
          muted
          playsInline
          onError={() => setError(true)}
          className="w-full rounded-lg my-5"
        />
      ) : (
        <div className="w-full rounded-lg bg-muted p-4 my-5 text-center">
          <p className="text-muted-foreground">Video failed to load</p>
        </div>
      )}
    </div>
  )
}