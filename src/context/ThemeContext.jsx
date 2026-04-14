import { createContext, useState, useContext } from "react"

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState("neutral")

  const toggleClient = () => setMode("client")
  const toggleContractor = () => setMode("contractor")

  const themeStyles = {
    neutral: "bg-white text-gray-900",
    client: "bg-white text-gray-900",
    contractor: "bg-white text-gray-900"
  }

  const buttonStyles = {
    neutral: "bg-gray-600 hover:bg-gray-700 text-white",
    client: "bg-blue-600 hover:bg-blue-700 text-white",
    contractor: "bg-orange-500 hover:bg-orange-600 text-white"
  }

  const accentStyles = {
    neutral: "text-gray-600",
    client: "text-blue-700",
    contractor: "text-orange-600"
  }

  return (
    <ThemeContext.Provider value={{
      mode,
      toggleClient,
      toggleContractor,
      themeStyles,
      buttonStyles,
      accentStyles
    }}>
      <div className={`min-h-screen ${themeStyles[mode]}`}>
        {children}
      </div>
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}