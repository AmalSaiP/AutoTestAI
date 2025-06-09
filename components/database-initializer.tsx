"use client"

import { useEffect } from "react"

export function DatabaseInitializer() {
  useEffect(() => {
    // Initialize database on app start
    fetch("/api/init-db", { method: "POST" })
      .then(() => console.log("Database initialized"))
      .catch((error) => console.error("Database initialization failed:", error))
  }, [])

  return null
}
